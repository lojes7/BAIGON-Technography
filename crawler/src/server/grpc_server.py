# 百工谱 — crawler_service gRPC 服务端实现
# stub 阶段同步执行：爬取(stub) → 写 job_sources → 清洗(stub) → Kafka 发送事件

import logging
import threading

import grpc

from src.kafka.producer import KafkaProducerClient
from src.pb import crawler_pb2, crawler_pb2_grpc
from src.dao.db import Database
from src.service.cleaner import clean
from src.service.fetcher import fetch_jobs
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


class CrawlerServicer(crawler_pb2_grpc.CrawlerServiceServicer):
    """CrawlerService gRPC 实现（stub 阶段同步执行；异步任务化留后续）"""

    def __init__(self, db: Database, producer: KafkaProducerClient, max_documents: int):
        self._db = db
        self._producer = producer
        self._max_documents = max_documents
        # 采集互斥锁：同一时间只允许一个采集任务
        self._lock = threading.Lock()
        # 进程内任务状态机（idle / running / success / failed / stopped）
        self._status = {"status": "idle", "count": "0", "message": ""}

    def Crawl(self, request, context):
        """采集：爬取(stub) → 写 job_sources → 清洗(stub) → Kafka 发送"""
        # 1) 参数校验：仅支持 JOB（空串也视为 JOB）
        if request.type and request.type != "JOB":
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"unsupported crawl type: {request.type}")

        # 2) 互斥：已有任务在跑则拒绝（gateway 映射 403）
        with self._lock:
            if self._status["status"] == "running":
                context.abort(grpc.StatusCode.FAILED_PRECONDITION, "a crawl task is already running")
            self._status = {"status": "running", "count": "0", "message": ""}

        # 3) trace_id：gateway 透传或本服务生成
        trace_id = int(request.trace_id) if request.trace_id else snowflake.next_id()

        try:
            # 4) 爬取（stub）
            records = fetch_jobs(self._max_documents)
            if not records:
                raise RuntimeError("fetcher returned no documents")

            # 5) 写入 job_sources（clean_status=PENDING）
            self._db.insert_job_sources(records, trace_id)

            # 6) 清洗（stub）
            cleaned = clean(records)

            # 7) 清洗成功：clean_status → SUCCESS
            self._db.mark_clean_success(trace_id)

            # 8) 发送采集完成事件到 data-source（topic=baigon.crawler.document.ingested）
            self._producer.send_document_ingested(
                source_document_id=str(snowflake.next_id()),
                evidence_chain_id=str(snowflake.next_id()),
                document_count=len(cleaned),
                trace_id=str(trace_id),
            )

            # 9) 更新状态并返回
            with self._lock:
                self._status = {"status": "success", "count": str(len(records)), "message": ""}
            logger.info("采集任务完成: %d 条（trace_id=%d）", len(records), trace_id)
            return crawler_pb2.CrawlResponse(count=str(len(records)), trace_id=str(trace_id))

        except grpc.RpcError:
            raise
        except Exception as e:
            logger.exception("采集任务失败")
            with self._lock:
                self._status = {"status": "failed", "count": "0", "message": str(e)}
            context.abort(grpc.StatusCode.INTERNAL, str(e))

    def GetCrawlStatus(self, request, context):
        """查询最近一次采集任务状态"""
        with self._lock:
            s = dict(self._status)
        return crawler_pb2.GetCrawlStatusResponse(
            status=s["status"], count=s["count"], message=s["message"]
        )

    def StopCrawl(self, request, context):
        """停止采集（stub 阶段仅置状态）"""
        with self._lock:
            self._status = {"status": "stopped", "count": self._status["count"], "message": "stopped by user"}
        logger.info("采集任务已停止")
        return crawler_pb2.StopCrawlResponse(status="stopped")
