"""并发处理流水线与嵌入失败降级测试。"""

import threading
import unittest
from concurrent.futures import Future
from unittest.mock import patch

from src.config.ai import ai_config
from src.repository.job_source import JobSourceRepository
from src.service.Zhi_Lian_crawler import JobRecord
from src.service.processing_pipeline import (
    BatchSubmissionCancelled,
    RecordProcessingPipeline,
)


def make_record(
    trace_id: int = 1001,
    description: str | None = "负责后端开发",
) -> JobRecord:
    """创建最小岗位测试数据。"""
    return JobRecord(
        publish_date=None,
        source_platform="test",
        source_url="",
        city=None,
        tags=None,
        major=None,
        nature=None,
        salary=None,
        job_name="后端工程师",
        company_name=None,
        company_size=None,
        province=None,
        education=None,
        experience=None,
        job_description=description,
        trace_id=trace_id,
        job_number=str(trace_id),
    )


class FakeRepository:
    def __init__(self) -> None:
        self.insert_call = None
        self.clean_success: list[int] = []
        self.clean_failed: list[int] = []

    def insert_job_sources(self, rows, **options):
        self.insert_call = (rows, options)
        return len(rows)

    def mark_clean_success(self, trace_ids):
        self.clean_success.extend(trace_ids)

    def mark_clean_failed(self, trace_ids):
        self.clean_failed.extend(trace_ids)


class FakeProducer:
    def __init__(self) -> None:
        self.documents = []

    def send_document_ingested(self, **options):
        self.documents.extend(options["documents"])
        delivery: Future = Future()
        delivery.set_result("ack")
        return delivery


class FailingAIClient:
    def embed_texts(self, texts, log_ctx):
        raise RuntimeError("ai unavailable")


class FakeLogService:
    def __init__(self) -> None:
        self.errors: list[dict] = []

    def error(self, **options) -> None:
        self.errors.append(options)


class ProcessingPipelineTest(unittest.TestCase):
    def test_ai_failure_still_persists_and_sends_cleaned_event(self):
        repository = FakeRepository()
        producer = FakeProducer()
        persisted: list[JobRecord] = []
        log_service = FakeLogService()
        pipeline = RecordProcessingPipeline(
            repository=repository,
            producer=producer,
            ai_client=FailingAIClient(),
            max_inflight_batches=1,
            log_service=log_service,
            on_persisted=persisted.extend,
        )
        try:
            result = pipeline.submit([make_record()], {"user_id": 1}).result(timeout=2)
            result.kafka_delivery.result(timeout=1)
        finally:
            pipeline.close()

        options = repository.insert_call[1]
        self.assertEqual(options["embeddings"], {})
        self.assertIn("ai unavailable", options["embedding_error"])
        self.assertNotIn("embedding_retry_at", options)
        self.assertEqual(len(log_service.errors), 1)
        self.assertEqual(log_service.errors[0]["detail"], "job embedding failed")
        self.assertEqual(repository.clean_success, [1001])
        self.assertEqual(len(producer.documents), 1)
        self.assertEqual(len(persisted), 1)

    def test_embedding_and_cleaning_run_in_parallel(self):
        repository = FakeRepository()
        producer = FakeProducer()
        ai_started = threading.Event()
        clean_started = threading.Event()

        class CoordinatedAIClient:
            def embed_texts(self, texts, log_ctx):
                ai_started.set()
                if not clean_started.wait(timeout=1):
                    raise AssertionError("clean 分支没有并行启动")
                return [[0.0] * 1024 for _ in texts]

        def coordinated_clean(records):
            clean_started.set()
            if not ai_started.wait(timeout=1):
                raise AssertionError("AI 分支没有并行启动")
            return records

        pipeline = RecordProcessingPipeline(
            repository=repository,
            producer=producer,
            ai_client=CoordinatedAIClient(),
            max_inflight_batches=1,
        )
        try:
            with patch("src.service.processing_pipeline.clean", coordinated_clean):
                result = pipeline.submit([make_record()], {}).result(timeout=2)
        finally:
            pipeline.close()

        vectors = repository.insert_call[1]["embeddings"]
        self.assertEqual(len(vectors[1001]), 1024)
        self.assertEqual(result.inserted, 1)

    def test_vector_database_error_falls_back_to_null_vector_insert(self):
        class SuccessfulAIClient:
            def embed_texts(self, texts, log_ctx):
                return [[0.0] * 1024 for _ in texts]

        class VectorRejectingRepository(FakeRepository):
            def __init__(self):
                super().__init__()
                self.calls = []

            def insert_job_sources(self, rows, **options):
                self.calls.append(options)
                if options["embeddings"]:
                    raise ValueError("invalid vector")
                return len(rows)

        repository = VectorRejectingRepository()
        pipeline = RecordProcessingPipeline(
            repository=repository,
            producer=FakeProducer(),
            ai_client=SuccessfulAIClient(),
            max_inflight_batches=1,
        )
        try:
            result = pipeline.submit([make_record()], {}).result(timeout=2)
        finally:
            pipeline.close()

        self.assertEqual(result.inserted, 1)
        self.assertEqual(len(repository.calls), 2)
        self.assertTrue(repository.calls[0]["embeddings"])
        self.assertEqual(repository.calls[1]["embeddings"], {})
        self.assertIn("invalid vector", repository.calls[1]["embedding_error"])

    def test_stop_rejects_batch_that_has_not_started(self):
        pipeline = RecordProcessingPipeline(
            repository=FakeRepository(),
            producer=FakeProducer(),
            ai_client=FailingAIClient(),
            max_inflight_batches=1,
        )
        stop_event = threading.Event()
        stop_event.set()
        try:
            with self.assertRaises(BatchSubmissionCancelled):
                pipeline.submit([make_record()], {}, stop_event)
        finally:
            pipeline.close()


class EmbeddingStatusTest(unittest.TestCase):
    def test_description_without_vector_is_failed(self):
        """有 JD 但未生成向量时必须立即记为 FAILED。"""
        status = JobSourceRepository._initial_embedding_status(make_record(), {})
        self.assertEqual(status, "FAILED")

    def test_empty_description_does_not_require_embedding(self):
        status = JobSourceRepository._initial_embedding_status(
            make_record(description=None),
            {},
        )
        self.assertEqual(status, "SUCCESS")


class EmbeddingRetryConfigTest(unittest.TestCase):
    def test_reserved_retry_parameters_are_kept(self):
        """重试功能停用期间仍保留用户指定的参数。"""
        self.assertEqual(ai_config.grpc_timeout_seconds, 150)
        self.assertEqual(ai_config.embedding_retry_interval_seconds, 300)
        self.assertEqual(ai_config.embedding_retry_base_seconds, 300)
        self.assertEqual(ai_config.embedding_retry_max_seconds, 1800)
        self.assertEqual(ai_config.embedding_retry_max_attempts, 2)
        self.assertEqual(ai_config.embedding_claim_timeout_seconds, 300)


if __name__ == "__main__":
    unittest.main()
