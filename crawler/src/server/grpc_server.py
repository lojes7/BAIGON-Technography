# 百工谱 — crawler_service gRPC 服务端实现
# 真实爬虫（DrissionPage）+ 后台异步执行：
# Crawl 启动后台线程立即返回；GetCrawlStatus 查进度；StopCrawl 立即停止。

import logging
import threading

import grpc

from src.config import config
from src.kafka.producer import KafkaProducerClient
from src.pb import crawler_pb2, crawler_pb2_grpc
from src.repository.job_source import JobSourceRepository
from src.service.cleaner import clean
from src.service.log_service import LogService
from src.service.Zhi_Lian_crawler import ZhaopinCrawler
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


class CrawlerServicer(crawler_pb2_grpc.CrawlerServiceServicer):
    """CrawlerService gRPC 实现（真实爬虫 + 后台异步）"""

    def __init__(self, db: JobSourceRepository, producer: KafkaProducerClient,
                 log_service: LogService, max_documents: int):
        self._db = db
        self._producer = producer
        self._log = log_service
        self._max_documents = max_documents
        self._crawler = ZhaopinCrawler(config.crawler_progress_dir)
        # 采集互斥锁：同一时间只允许一个采集任务
        self._lock = threading.Lock()
        # 停止信号（StopCrawl 设置，后台线程检查）
        self._stop_event: threading.Event | None = None
        # 后台爬取线程
        self._worker: threading.Thread | None = None
        # 进程内任务状态机（idle / running / stopping / success / failed / stopped）
        self._status = {
            "status": "idle", "count": "0", "message": "",
            "current_category": "", "progress": 0, "total_cleaned": 0,
        }

    # ============================================================
    # 采集
    # ============================================================
    def Crawl(self, request, context):
        """采集：启动后台线程异步爬取，立即返回"""
        # 1) 参数校验：仅支持 JOB
        if request.type and request.type != "JOB":
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"unsupported crawl type: {request.type}")

        # 2) 互斥：已有任务在跑则拒绝（gateway 映射 403）
        with self._lock:
            if self._status["status"] in ("running", "stopping"):
                context.abort(grpc.StatusCode.FAILED_PRECONDITION, "a crawl task is already running")
            self._status = {"status": "running", "count": "0", "message": "",
                            "current_category": "", "progress": 0, "total_cleaned": 0}
            self._stop_event = threading.Event()

        # 3) trace_id：gateway 透传或本服务生成
        trace_id = int(request.trace_id) if request.trace_id else snowflake.next_id()
        # 日志上下文（gateway 透传的用户信息）
        log_ctx = {
            "trace_id": trace_id,
            "user_id": request.user_id,
            "user_name": request.user_name or "system",
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }

        # 4) 启动后台爬取线程（爬取参数由 ADMIN 前端传参）
        categories = list(request.categories) if request.categories else None
        max_documents = request.max_documents or self._max_documents
        # 约束：单分类最大条数上限 1000（防止一次性爬取过多）
        if max_documents > 1000:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "max_documents must be <= 1000")
        self._worker = threading.Thread(
            target=self._crawl_worker,
            args=(trace_id, log_ctx, categories, max_documents, self._stop_event),
            daemon=True,
        )
        self._worker.start()
        logger.info("后台爬取已启动: trace_id=%d, categories=%s", trace_id, categories or "全部")

        # 5) 立即返回（异步）
        return crawler_pb2.CrawlResponse(count="0", trace_id=str(trace_id), status="running")

    # ============================================================
    # 后台爬取 worker
    # ============================================================
    def _crawl_worker(self, trace_id: int, log_ctx: dict, categories: list[str] | None,
                      max_documents: int, stop_event: threading.Event) -> None:
        """后台线程：爬取 → 写 job_sources → 清洗 → Kafka 发送"""
        records: list = []
        try:
            # 1) 爬取（真实爬虫 DrissionPage）
            records = self._crawler.run(
                categories=categories,
                max_documents=max_documents,
                stop_event=stop_event,
            )
            if stop_event.is_set():
                # 用户主动停止：已抓数据照常入库
                logger.info("收到停止信号，已抓 %d 条，开始落库", len(records))

            # 2) 写入 job_sources（每条记录独立 trace_id，clean_status=PENDING）
            if records:
                self._db.insert_job_sources(records)

            # 3) 清洗
            cleaned = clean(records)

            # 4) 清洗成功：批量将各条 clean_status → SUCCESS
            trace_ids = [r.trace_id for r in records if r.trace_id]
            if trace_ids:
                self._db.mark_clean_success(trace_ids)

            # 5) 发送采集完成事件到 data-source（topic=baigon.crawler.document.ingested）
            if cleaned:
                self._producer.send_document_ingested(
                    document_count=len(cleaned),
                    documents=cleaned,
                    # 透传操作者用户上下文（gateway 从 JWT 解析）
                    user_id=log_ctx["user_id"],
                    user_name=log_ctx["user_name"],
                    user_ip=log_ctx["user_ip"],
                )

            # 6) 更新状态
            with self._lock:
                if stop_event.is_set():
                    self._status = {"status": "stopped", "count": str(len(cleaned)), "message": "stopped by user",
                                    "current_category": "", "progress": 0, "total_cleaned": len(cleaned)}
                else:
                    self._status = {"status": "success", "count": str(len(records)), "message": "",
                                    "current_category": "", "progress": 0, "total_cleaned": len(cleaned)}
            logger.info("采集任务完成: %d 条（trace_id=%d）", len(records), trace_id)

            # 7) 写业务日志
            self._log.info(
                detail=f"crawl success: {len(records)} records, cleaned {len(cleaned)}",
                **log_ctx,
            )
        except Exception as e:
            logger.exception("采集任务失败")
            with self._lock:
                self._status = {"status": "failed", "count": "0", "message": str(e),
                                "current_category": "", "progress": 0, "total_cleaned": 0}
            # 清洗失败：已入库记录 clean_status → FAILED（按各自 trace_id）
            trace_ids = [r.trace_id for r in records if r.trace_id]
            try:
                if trace_ids:
                    self._db.mark_clean_failed(trace_ids)
            except Exception:
                pass
            # 写业务日志
            self._log.error(
                error_msg=str(e)[:2000],
                detail="crawl failed",
                **log_ctx,
            )

    # ============================================================
    # 查询状态
    # ============================================================
    def GetCrawlStatus(self, request, context):
        """查询最近一次采集任务状态"""
        with self._lock:
            s = dict(self._status)
        # 写业务日志：查询状态
        self._log.info(
            trace_id=int(request.trace_id) if request.trace_id else None,
            user_id=request.user_id,
            user_name=request.user_name or "system",
            user_ip=request.user_ip,
            request_method=request.request_method,
            request_url=request.request_url,
            detail=f"get crawl status: {s['status']}",
        )
        return crawler_pb2.GetCrawlStatusResponse(
            status=s["status"],
            count=s["count"],
            message=s["message"],
            current_category=s["current_category"],
            progress=s["progress"],
            total_cleaned=s["total_cleaned"],
        )

    # ============================================================
    # 停止
    # ============================================================
    def StopCrawl(self, request, context):
        """停止采集：设置停止信号，后台线程立即中断"""
        with self._lock:
            if self._status["status"] in ("running",):
                self._status["status"] = "stopping"
                if self._stop_event:
                    self._stop_event.set()  # 立即生效
                logger.info("已发送停止信号，正在停止采集...")
            elif self._status["status"] == "stopping":
                logger.info("已在停止中")
            else:
                logger.info("当前无运行中的采集任务")

        # 写业务日志：停止采集
        self._log.warning(
            trace_id=int(request.trace_id) if request.trace_id else None,
            user_id=request.user_id,
            user_name=request.user_name or "system",
            user_ip=request.user_ip,
            request_method=request.request_method,
            request_url=request.request_url,
            detail="crawl stop requested",
        )
        return crawler_pb2.StopCrawlResponse(status="stopping")
