"""模拟注入异步分批处理测试。"""

import threading
import unittest
from concurrent.futures import Future

import grpc

from src.pb import crawler_pb2
from src.server.grpc_server import CrawlerServicer
from src.service.processing_pipeline import BatchProcessingResult


class AbortError(RuntimeError):
    """模拟 context.abort 的不返回行为。"""

    def __init__(self, code, details):
        super().__init__(details)
        self.code = code


class FakeContext:
    def abort(self, code, details):
        raise AbortError(code, details)


class FakePipeline:
    """立即完成每个批次，并记录后台提交大小。"""

    def __init__(self):
        self.batch_sizes: list[int] = []

    def submit(self, records, log_ctx, stop_event=None):
        self.batch_sizes.append(len(records))
        delivery: Future = Future()
        delivery.set_result("ack")
        result: Future = Future()
        result.set_result(
            BatchProcessingResult(
                inserted=len(records),
                cleaned=list(records),
                kafka_delivery=delivery,
            )
        )
        return result


class BlockingPipeline:
    """保持首批处理中，用于确认 gRPC 启动接口不会同步等待。"""

    def __init__(self):
        self.submitted = threading.Event()
        self.result: Future = Future()

    def submit(self, records, log_ctx, stop_event=None):
        self.submitted.set()
        return self.result


class FakeLogService:
    def __init__(self):
        self.infos: list[dict] = []
        self.errors: list[dict] = []

    def info(self, **options):
        self.infos.append(options)

    def error(self, **options):
        self.errors.append(options)

    def warning(self, **options):
        pass


def make_request(count: int):
    return crawler_pb2.IngestDataRequest(
        jobs=[
            crawler_pb2.IngestedJob(
                job_name=f"岗位-{index}",
                job_description="负责后端开发",
            )
            for index in range(count)
        ],
        trace_id="1001",
        user_id=7,
        user_name="admin",
    )


def make_servicer(pipeline=None):
    pipeline = pipeline or FakePipeline()
    log_service = FakeLogService()
    servicer = CrawlerServicer(
        db=object(),
        producer=object(),
        log_service=log_service,
        pipeline=pipeline,
        crawler=object(),
        max_documents=1000,
    )
    return servicer, pipeline, log_service


class IngestDataTest(unittest.TestCase):
    def test_returns_before_background_batch_finishes(self):
        pipeline = BlockingPipeline()
        servicer, _, _ = make_servicer(pipeline)

        response = servicer.IngestData(make_request(1), FakeContext())

        self.assertEqual(response.status, "running")
        self.assertTrue(pipeline.submitted.wait(timeout=1))
        self.assertTrue(servicer._worker.is_alive())
        delivery: Future = Future()
        delivery.set_result("ack")
        pipeline.result.set_result(
            BatchProcessingResult(
                inserted=1,
                cleaned=[],
                kafka_delivery=delivery,
            )
        )
        servicer._worker.join(timeout=2)
        self.assertFalse(servicer._worker.is_alive())

    def test_returns_running_and_processes_twenty_records_per_batch(self):
        servicer, pipeline, log_service = make_servicer()

        response = servicer.IngestData(make_request(45), FakeContext())

        self.assertEqual(response.status, "running")
        self.assertEqual(response.count, "0")
        self.assertEqual(response.trace_id, "1001")
        servicer._worker.join(timeout=2)
        self.assertFalse(servicer._worker.is_alive())
        self.assertEqual(pipeline.batch_sizes, [20, 20, 5])
        self.assertEqual(servicer._status["status"], "success")
        self.assertEqual(servicer._status["count"], "45")
        self.assertEqual(servicer._status["total_cleaned"], 45)
        self.assertEqual(servicer._status["progress"], 100)
        self.assertEqual(log_service.errors, [])

    def test_rejects_when_another_collection_task_is_running(self):
        servicer, _, _ = make_servicer()
        servicer._status["status"] = "running"

        with self.assertRaises(AbortError) as raised:
            servicer.IngestData(make_request(1), FakeContext())

        self.assertEqual(raised.exception.code, grpc.StatusCode.FAILED_PRECONDITION)


if __name__ == "__main__":
    unittest.main()
