"""岗位采集后的有界并发处理流水线。"""

import copy
import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Callable

from src.client.ai_grpc_client import AIGrpcClient
from src.kafka.producer import KafkaProducerClient
from src.repository.job_source import JobSourceRepository
from src.service.Zhi_Lian_crawler import JobRecord
from src.service.cleaner import clean
from src.service.log_service import LogService

logger = logging.getLogger(__name__)


class BatchSubmissionCancelled(RuntimeError):
    """停止事件触发后，尚未进入流水线的批次被取消。"""


@dataclass(frozen=True)
class BatchProcessingResult:
    """一个批次完成 DB/clean 屏障后的结果。"""

    inserted: int
    cleaned: list[JobRecord]
    kafka_delivery: Future | None


class RecordProcessingPipeline:
    """并行执行“AI+写库”和清洗，并在屏障后异步发送 Kafka。"""

    def __init__(
        self,
        repository: JobSourceRepository,
        producer: KafkaProducerClient,
        ai_client: AIGrpcClient,
        max_inflight_batches: int,
        log_service: LogService | None = None,
        on_persisted: Callable[[list[JobRecord]], None] | None = None,
        on_persist_failed: Callable[[list[JobRecord]], None] | None = None,
    ) -> None:
        if max_inflight_batches <= 0:
            raise ValueError("max_inflight_batches 必须大于 0")
        self._repository = repository
        self._producer = producer
        self._ai_client = ai_client
        self._log_service = log_service
        self._on_persisted = on_persisted
        self._on_persist_failed = on_persist_failed
        self._slots = threading.BoundedSemaphore(max_inflight_batches)
        self._coordinator_pool = ThreadPoolExecutor(
            max_workers=max_inflight_batches,
            thread_name_prefix="crawl-batch",
        )
        self._persist_pool = ThreadPoolExecutor(
            max_workers=max_inflight_batches,
            thread_name_prefix="crawl-persist",
        )
        self._clean_pool = ThreadPoolExecutor(
            max_workers=max_inflight_batches,
            thread_name_prefix="crawl-clean",
        )

    def submit(
        self,
        records: list[JobRecord],
        log_ctx: dict,
        stop_event: threading.Event | None = None,
    ) -> Future:
        """提交批次；队列满时施加背压，停止后不再接收尚未开始的批次。"""
        if not records:
            completed: Future = Future()
            completed.set_result(BatchProcessingResult(0, [], None))
            return completed

        while not self._slots.acquire(timeout=0.1):
            if stop_event and stop_event.is_set():
                raise BatchSubmissionCancelled("采集已停止，取消未开始的处理批次")
        if stop_event and stop_event.is_set():
            self._slots.release()
            raise BatchSubmissionCancelled("采集已停止，取消未开始的处理批次")

        future = self._coordinator_pool.submit(
            self._process_batch,
            list(records),
            dict(log_ctx),
        )
        future.add_done_callback(lambda _: self._slots.release())
        return future

    def close(self) -> None:
        """等待已进入流水线的小批次结束并释放线程池。"""
        self._coordinator_pool.shutdown(wait=True, cancel_futures=False)
        self._persist_pool.shutdown(wait=True, cancel_futures=False)
        self._clean_pool.shutdown(wait=True, cancel_futures=False)

    def _process_batch(
        self,
        records: list[JobRecord],
        log_ctx: dict,
    ) -> BatchProcessingResult:
        # 两个分支使用不同副本，避免未来清洗逻辑修改 JobRecord 产生数据竞争。
        persist_records = copy.deepcopy(records)
        clean_records = copy.deepcopy(records)
        persist_future = self._persist_pool.submit(
            self._embed_and_persist,
            persist_records,
            log_ctx,
        )
        clean_future = self._clean_pool.submit(clean, clean_records)

        try:
            inserted = persist_future.result()
        except Exception:
            # 确认另一个分支已退出，避免后台异常无人接收。
            try:
                clean_future.result()
            except Exception:
                pass
            if self._on_persist_failed:
                self._on_persist_failed(records)
            raise

        try:
            cleaned = clean_future.result()
        except Exception:
            trace_ids = [record.trace_id for record in records if record.trace_id]
            self._repository.mark_clean_failed(trace_ids)
            raise

        cleaned_trace_ids = {record.trace_id for record in cleaned if record.trace_id}
        all_trace_ids = {record.trace_id for record in records if record.trace_id}
        if cleaned_trace_ids:
            self._repository.mark_clean_success(list(cleaned_trace_ids))
        rejected_trace_ids = all_trace_ids - cleaned_trace_ids
        if rejected_trace_ids:
            self._repository.mark_clean_failed(list(rejected_trace_ids))

        kafka_delivery = None
        if cleaned:
            # Kafka 只能在 DB commit 与 clean 均成功后发送，避免消费者查询不到原始记录。
            kafka_delivery = self._producer.send_document_ingested(
                document_count=len(cleaned),
                documents=cleaned,
                user_id=log_ctx.get("user_id", 0),
                user_name=log_ctx.get("user_name", "system"),
                user_ip=log_ctx.get("user_ip"),
            )
        return BatchProcessingResult(inserted, cleaned, kafka_delivery)

    def _embed_and_persist(
        self,
        records: list[JobRecord],
        log_ctx: dict,
    ) -> int:
        described_records = [
            record
            for record in records
            if record.job_description and record.job_description.strip()
        ]
        embeddings: dict[int, list[float]] = {}
        embedding_error: str | None = None

        # if described_records:
        #     try:
        #         vectors = self._ai_client.embed_texts(
        #             [str(record.job_description) for record in described_records],
        #             log_ctx,
        #         )
        #         embeddings = {
        #             int(record.trace_id): vector
        #             for record, vector in zip(described_records, vectors, strict=True)
        #             if record.trace_id is not None
        #         }
        #     except Exception as exc:
        #         # AI 失败只记录 FAILED 与业务日志，不阻塞原始岗位入库，也不自动重试。
        #         embedding_error = str(exc)
        #         logger.exception("AI 嵌入失败，本批岗位将以 FAILED 状态入库")
        #         self._write_embedding_error(log_ctx, embedding_error)

        try:
            inserted = self._repository.insert_job_sources(
                records,
                embeddings=embeddings,
                embedding_error=embedding_error,
            )
        except Exception as exc:
            if not embeddings:
                raise
            # 向量类型/数值异常也不能阻止原始岗位落库；回退为 FAILED 状态。
            logger.exception("向量写库失败，本批岗位回退为 NULL 向量")
            self._write_embedding_error(log_ctx, f"向量写库失败: {exc}")
            inserted = self._repository.insert_job_sources(
                records,
                embeddings={},
                embedding_error=f"向量写库失败: {exc}",
            )
        if self._on_persisted:
            try:
                self._on_persisted(records)
            except Exception:
                # 内存去重状态故障不能回滚已经提交的数据库事务。
                logger.exception("数据库已提交，但更新任务内岗位去重状态失败")
        return inserted

    def _write_embedding_error(self, log_ctx: dict, error: str) -> None:
        """记录嵌入失败，不阻断原始岗位处理。"""
        if self._log_service is None:
            return
        self._log_service.error(
            trace_id=log_ctx.get("trace_id"),
            user_id=int(log_ctx.get("user_id") or 0),
            user_name=log_ctx.get("user_name") or "system",
            user_ip=log_ctx.get("user_ip"),
            request_method=log_ctx.get("request_method"),
            request_url=log_ctx.get("request_url"),
            error_msg=error[:2000],
            detail="job embedding failed",
        )
