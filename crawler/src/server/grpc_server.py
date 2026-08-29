# 百工谱 — crawler_service gRPC 服务端实现
# 真实爬虫（DrissionPage）+ 后台异步执行：
# Crawl 启动后台线程立即返回；GetCrawlStatus 查进度；StopCrawl 立即停止。

import logging
import threading
from concurrent.futures import Future

import grpc

from src.config.ai import ai_config
from src.config.pipeline import pipeline_config
from src.kafka.producer import KafkaProducerClient
from src.pb import audit_pb2, crawler_pb2, crawler_pb2_grpc
from src.repository.job_source import JobSourceRepository
from src.service.log_service import LogService
from src.service.audit.log_query_service import AuditLogQueryService
from src.service.processing_pipeline import (
    BatchProcessingResult,
    BatchSubmissionCancelled,
    RecordProcessingPipeline,
)
from src.service.Zhi_Lian_crawler import JobRecord, ZhaopinCrawler, _parse_publish_date
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


class CrawlerServicer(crawler_pb2_grpc.CrawlerServiceServicer):
    """CrawlerService gRPC 实现（真实爬虫 + 后台异步）"""

    def __init__(
        self,
        db: JobSourceRepository,
        producer: KafkaProducerClient,
        log_service: LogService,
        pipeline: RecordProcessingPipeline,
        crawler: ZhaopinCrawler,
        max_documents: int,
        audit_log_query_service: AuditLogQueryService | None = None,
    ):
        self._db = db
        self._producer = producer
        self._log = log_service
        self._pipeline = pipeline
        self._max_documents = max_documents
        self._crawler = crawler
        self._audit_log_query_service = audit_log_query_service
        # 采集互斥锁：同一时间只允许一个采集任务
        self._lock = threading.Lock()
        # 停止信号（StopCrawl 设置，后台线程检查）
        self._stop_event: threading.Event | None = None
        # 后台爬取线程
        self._worker: threading.Thread | None = None
        # 进程内任务状态机（idle / running / stopping / success / failed / stopped）
        self._status = {
            "id": 0, "status": "idle", "count": "0", "message": "",
            "current_category": "", "progress": 0, "total_cleaned": 0,
        }

    def PagedSearchAuditLogs(self, request, context):
        """ADMIN 分页查询 crawler 独立数据库中的日志。"""
        log_ctx = {
            # gRPC 审计协议使用字符串承载雪花 ID，入库前恢复为整数。
            "trace_id": int(request.trace_id) if request.trace_id and request.trace_id.isdigit() else None,
            "user_id": request.user_id,
            "user_name": request.user_name or "system",
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }
        if self._audit_log_query_service is None:
            self._log.error(error_msg="query service unavailable", detail="paged search audit logs failed", **log_ctx)
            context.abort(grpc.StatusCode.UNAVAILABLE, "audit log query unavailable")

        try:
            if request.target_log_ids:
                items = self._audit_log_query_service.batch_get(
                    requester_role=request.user_role,
                    ids=list(request.target_log_ids),
                )
                found_ids = {item.id for item in items}
                response = audit_pb2.PagedSearchAuditLogsResponse(
                    detail_items=[self._audit_log_item(item) for item in items],
                    # 允许批次部分命中；缺失 ID 去重并保持首次请求顺序。
                    missing_audit_log_ids=[
                        item_id
                        for item_id in dict.fromkeys(request.target_log_ids)
                        if item_id not in found_ids
                    ],
                    total=len(items),
                    page=0,
                    page_size=len(items),
                )
                self._log.info(
                    detail=f"batch get crawler audit logs: total={len(items)}",
                    **log_ctx,
                )
                return response
            page = self._audit_log_query_service.paged_search(
                requester_role=request.user_role,
                page=request.page,
                page_size=request.page_size,
                level=request.level,
                created_at_from=request.created_at_from,
                created_at_to=request.created_at_to,
                target_user_id=request.target_user_id,
            )
            response = audit_pb2.PagedSearchAuditLogsResponse(
                audit_log_ids=[item.id for item in page.items],
                total=page.total,
                page=page.page,
                page_size=page.page_size,
            )
            self._log.info(detail=f"paged search crawler audit logs: total={page.total}", **log_ctx)
            return response
        except PermissionError:
            self._log.warning(error_msg="permission denied", detail="paged search audit logs denied", **log_ctx)
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "ADMIN role required")
        except ValueError as exception:
            self._log.warning(error_msg=str(exception)[:2000], detail="paged search audit logs invalid", **log_ctx)
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exception))
        except Exception as exception:
            logger.exception("分页查询 crawler 审计日志失败")
            self._log.error(error_msg=type(exception).__name__, detail="paged search audit logs failed", **log_ctx)
            context.abort(grpc.StatusCode.INTERNAL, "server error")

    @staticmethod
    def _audit_log_item(item):
        return audit_pb2.AuditLogItem(
            id=item.id,
            trace_id=item.trace_id or 0,
            user_id=item.user_id,
            user_name=item.user_name or "",
            user_type="",
            user_ip=item.user_ip or "",
            level=item.level or "",
            request_method=item.request_method or "",
            request_url=item.request_url or "",
            error_msg=item.error_msg or "",
            detail=item.detail or "",
            created_at=item.created_at.isoformat() if item.created_at else "",
        )

    # ============================================================
    # 采集
    # ============================================================
    def Crawl(self, request, context):
        """采集：启动后台线程异步爬取，立即返回"""
        # 1) 参数校验：仅支持 JOB
        if request.type and request.type != "JOB":
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"unsupported crawl type: {request.type}")

        # 2) 先校验任务参数，避免拒绝请求污染当前状态机。
        categories = list(request.categories) if request.categories else None
        max_documents = request.max_documents or self._max_documents
        if max_documents > self._max_documents:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"max_documents must be <= {self._max_documents}",
            )

        # 3) 任务 ID 当前复用全链路雪花 trace_id；REST 只以资源 ID 名义返回。
        trace_id = int(request.trace_id) if request.trace_id else snowflake.next_id()

        # 4) 互斥：已有任务在跑则拒绝（gateway 映射 403）
        with self._lock:
            if self._status["status"] in ("running", "stopping"):
                context.abort(grpc.StatusCode.FAILED_PRECONDITION, "a crawl task is already running")
            self._status = {"id": trace_id, "status": "running", "count": "0", "message": "",
                            "current_category": "", "progress": 0, "total_cleaned": 0}
            self._stop_event = threading.Event()

        # 日志上下文（gateway 透传的用户信息）
        log_ctx = {
            "trace_id": trace_id,
            "user_id": request.user_id,
            "user_name": request.user_name or "system",
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }

        # 5) 启动后台爬取线程（爬取参数由 ADMIN 前端传参）
        self._worker = threading.Thread(
            target=self._crawl_worker,
            args=(trace_id, log_ctx, categories, max_documents, self._stop_event),
            daemon=True,
        )
        self._worker.start()
        logger.info("后台爬取已启动: trace_id=%d, categories=%s", trace_id, categories or "全部")

        # 6) 启动命令只返回任务身份，详情由状态接口读取。
        return crawler_pb2.CrawlResponse(id=trace_id)

    # ============================================================
    # 后台爬取 worker
    # ============================================================
    # 公共处理流程：AI+落库 与清洗并行 → 状态更新 → Kafka 异步发送
    # 爬虫（_crawl_worker）与模拟注入（_ingest_worker）共用
    # ============================================================
    def _crawl_worker(self, trace_id: int, log_ctx: dict, categories: list[str] | None,
                      max_documents: int, stop_event: threading.Event) -> None:
        """后台线程：爬取 → 公共处理流程"""
        records: list[JobRecord] = []
        batch_futures: list[Future] = []
        try:
            def _submit_batch(batch: list[JobRecord]) -> None:
                """爬虫线程的批次回调：有界队列满时背压，停止后取消未开始批次。"""
                try:
                    future = self._pipeline.submit(batch, log_ctx, stop_event)
                    batch_futures.append(future)
                except BatchSubmissionCancelled:
                    self._crawler.release_records(batch)
                    logger.info("停止后取消未开始批次（%d 条）", len(batch))
                except Exception:
                    self._crawler.release_records(batch)
                    raise

            # 1) 爬取（真实爬虫 DrissionPage）
            records = self._crawler.run(
                categories=categories,
                max_documents=max_documents,
                stop_event=stop_event,
                on_batch=_submit_batch,
                batch_size=ai_config.embedding_batch_size,
            )
            if stop_event.is_set():
                logger.info("收到停止信号，开始等待已进入流水线的小批次安全结束")

            # 2) 等待已经进入流水线的批次；Kafka 在 DB/clean 屏障后异步发送。
            results = self._wait_for_batches(batch_futures)
            cleaned_count = sum(len(result.cleaned) for result in results)
            inserted_count = sum(result.inserted for result in results)

            # 3) 在任务结束前统一确认 Kafka ACK；这不会阻塞爬取下一页。
            self._confirm_kafka_deliveries(results)

            # 4) 更新状态
            with self._lock:
                if stop_event.is_set():
                    self._status.update(
                        status="stopped", count=str(inserted_count), message="stopped by user",
                        current_category="", progress=0, total_cleaned=cleaned_count,
                    )
                else:
                    self._status.update(
                        status="success", count=str(inserted_count), message="",
                        current_category="", progress=0, total_cleaned=cleaned_count,
                    )
            logger.info("采集任务完成: 入库 %d 条（trace_id=%d）", inserted_count, trace_id)

            # 5) 写业务日志
            self._log.info(
                detail=f"crawl success: {inserted_count} records, cleaned {cleaned_count}",
                **log_ctx,
            )
        except Exception as e:
            logger.exception("采集任务失败")
            with self._lock:
                self._status["status"] = "failed"
                self._status["message"] = str(e)
                self._status["current_category"] = ""
                self._status["progress"] = 0
            # 写业务日志
            self._log.error(
                error_msg=str(e)[:2000],
                detail="crawl failed",
                **log_ctx,
            )

    def _ingest_worker(
        self,
        trace_id: int,
        records: list[JobRecord],
        log_ctx: dict,
        stop_event: threading.Event,
    ) -> None:
        """后台分批处理模拟注入，避免大请求受同步 gRPC deadline 限制。"""
        batch_futures: list[Future] = []
        batch_size = ai_config.embedding_batch_size
        total_batches = (len(records) + batch_size - 1) // batch_size
        try:
            for start in range(0, len(records), batch_size):
                if stop_event.is_set():
                    logger.info("收到停止信号，取消尚未提交的注入批次")
                    break
                batch = records[start : start + batch_size]
                try:
                    batch_futures.append(
                        self._pipeline.submit(batch, log_ctx, stop_event)
                    )
                except BatchSubmissionCancelled:
                    logger.info("停止后取消未开始的注入批次（%d 条）", len(batch))
                    break

            results = self._wait_for_batches(
                batch_futures,
                total_batches=total_batches,
            )
            self._confirm_kafka_deliveries(results)
            inserted_count = sum(result.inserted for result in results)
            cleaned_count = sum(len(result.cleaned) for result in results)

            with self._lock:
                if stop_event.is_set():
                    self._status.update(
                        status="stopped",
                        message="stopped by user",
                        current_category="",
                    )
                else:
                    self._status.update(
                        status="success",
                        message="",
                        current_category="",
                        progress=100,
                    )
            logger.info(
                "模拟注入完成: 入库 %d 条（trace_id=%d）",
                inserted_count,
                trace_id,
            )
            self._log.info(
                detail=f"ingest success: {inserted_count} records, cleaned {cleaned_count}",
                **log_ctx,
            )
        except Exception as exception:
            logger.exception("模拟注入失败")
            with self._lock:
                self._status["status"] = "failed"
                self._status["message"] = str(exception)
                self._status["current_category"] = ""
            self._log.error(
                error_msg=str(exception)[:2000],
                detail="ingest failed",
                **log_ctx,
            )

    def _wait_for_batches(
        self,
        batch_futures: list[Future],
        total_batches: int | None = None,
    ) -> list[BatchProcessingResult]:
        """等待全部已接收批次，并在收齐结果后统一抛出首个错误。"""
        results: list[BatchProcessingResult] = []
        first_error: Exception | None = None
        for completed_batches, future in enumerate(batch_futures, start=1):
            try:
                result: BatchProcessingResult = future.result()
                results.append(result)
                with self._lock:
                    self._status["total_cleaned"] += len(result.cleaned)
                    self._status["count"] = str(
                        int(self._status["count"]) + result.inserted
                    )
            except Exception as exc:
                if first_error is None:
                    first_error = exc
            finally:
                if total_batches:
                    with self._lock:
                        self._status["progress"] = min(
                            100,
                            completed_batches * 100 // total_batches,
                        )
        if first_error is not None:
            raise first_error
        return results

    @staticmethod
    def _confirm_kafka_deliveries(results: list[BatchProcessingResult]) -> None:
        """在任务结束前统一确认已发送批次的 Kafka ACK。"""
        for result in results:
            if result.kafka_delivery is not None:
                result.kafka_delivery.result(
                    timeout=pipeline_config.kafka_delivery_timeout_seconds
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
            id=s["id"],
            status=s["status"],
            count=s["count"],
            message=s["message"],
            current_category=s["current_category"],
            progress=s["progress"],
            total_cleaned=s["total_cleaned"],
        )

    # ============================================================
    # 原始岗位追溯
    # ============================================================
    def GetJobSourceByTraceId(self, request, context):
        """按 trace_id 查询 job_sources 中的原始岗位。"""
        if request.trace_id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "trace_id must be positive")

        log_ctx = {
            "trace_id": request.trace_id,
            "user_id": request.user_id,
            "user_name": request.user_name or "system",
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }
        try:
            job = self._db.find_by_trace_id(request.trace_id)
        except Exception as exc:
            logger.exception("查询原始岗位失败: trace_id=%d", request.trace_id)
            self._log.error(
                error_msg=str(exc)[:2000],
                detail="get source job failed",
                **log_ctx,
            )
            context.abort(grpc.StatusCode.INTERNAL, "server error")

        if job is None:
            self._log.warning(
                error_msg="source job not found",
                detail="get source job not found",
                **log_ctx,
            )
            context.abort(grpc.StatusCode.NOT_FOUND, "source job not found")

        self._log.info(detail="get source job", **log_ctx)
        return crawler_pb2.GetJobSourceByTraceIdResponse(
            id=job.id,
            trace_id=job.trace_id or 0,
            publish_date=job.publish_date.isoformat() if job.publish_date else "",
            source_platform=job.source_platform or "",
            source_url=job.source_url or "",
            city=job.city or "",
            tags=job.tags or "",
            major=job.major or "",
            nature=job.nature or "",
            salary=job.salary or "",
            job_name=job.job_name or "",
            company_name=job.company_name or "",
            company_size=job.company_size or "",
            province=job.province or "",
            education=job.education or "",
            experience=job.experience or "",
            job_description=job.job_description or "",
            clean_status=job.clean_status or "",
        )

    # ============================================================
    # 停止
    # ============================================================
    def StopCrawl(self, request, context):
        """停止采集：设置停止信号，后台线程立即中断"""
        with self._lock:
            task_id = self._status["id"]
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
        return crawler_pb2.StopCrawlResponse(id=task_id)

    # ============================================================
    # 模拟采集：注入配置数据走完整链路（不真爬）
    # ============================================================
    def IngestData(self, request, context):
        """接收配置岗位并立即返回，由后台小批次执行完整处理流程。"""
        # 1) 参数校验：jobs 非空，且不超过服务内部任务上限。
        jobs = list(request.jobs)
        if not jobs:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "jobs must not be empty")
        if len(jobs) > self._max_documents:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"jobs count must be <= {self._max_documents}",
            )
        if any(not job.job_name.strip() for job in jobs):
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "job_name must not be empty",
            )

        # 2) trace_id + 日志上下文（gateway 透传）
        trace_id = int(request.trace_id) if request.trace_id else snowflake.next_id()
        log_ctx = {
            "trace_id": trace_id,
            "user_id": request.user_id,
            "user_name": request.user_name or "system",
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }

        # 3) 每条注入数据 → JobRecord（trace_id 各赋雪花 ID，publish_date 解析失败置 None）
        records = [
            JobRecord(
                publish_date=_parse_publish_date(job.publish_date),
                source_platform=job.source_platform.strip() or "手动注入",
                source_url=job.source_url or None,
                city=job.city or None,
                tags=job.tags or None,
                major=job.major or None,
                nature=job.nature or None,
                salary=job.salary or None,
                job_name=job.job_name.strip(),
                company_name=job.company_name or None,
                company_size=job.company_size or None,
                province=job.province or None,
                education=job.education or None,
                experience=job.experience or None,
                job_description=job.job_description or None,
                trace_id=snowflake.next_id(),
            )
            for job in jobs
        ]

        # 4) 与真实采集共用状态机，同一时间只允许一个采集或注入任务。
        with self._lock:
            if self._status["status"] in ("running", "stopping"):
                context.abort(
                    grpc.StatusCode.FAILED_PRECONDITION,
                    "a crawl or ingest task is already running",
                )
            self._status = {
                "id": trace_id,
                "status": "running",
                "count": "0",
                "message": "",
                "current_category": "",
                "progress": 0,
                "total_cleaned": 0,
            }
            self._stop_event = threading.Event()
            stop_event = self._stop_event

        # 5) 后台按 embedding_batch_size 分批，立即向 gateway 返回 running。
        self._worker = threading.Thread(
            target=self._ingest_worker,
            args=(trace_id, records, log_ctx, stop_event),
            daemon=True,
        )
        self._worker.start()
        logger.info("模拟注入已启动: trace_id=%d, count=%d", trace_id, len(records))
        self._log.info(
            detail=f"ingest started: {len(records)} records",
            **log_ctx,
        )
        return crawler_pb2.IngestDataResponse(id=trace_id)
