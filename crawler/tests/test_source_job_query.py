"""crawler 原始岗位追溯接口测试。"""

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

import grpc

from src.pb import crawler_pb2
from src.server.grpc_server import CrawlerServicer


class AbortError(Exception):
    """测试上下文用的 gRPC abort 异常。"""

    def __init__(self, code, details):
        super().__init__(details)
        self.code = code


class FakeContext:
    def abort(self, code, details):
        raise AbortError(code, details)


class FakeRepository:
    def __init__(self, job):
        self.job = job
        self.trace_id = None

    def find_by_trace_id(self, trace_id):
        self.trace_id = trace_id
        return self.job


class FakeLogService:
    def __init__(self):
        self.infos = []
        self.warnings = []
        self.errors = []

    def info(self, **options):
        self.infos.append(options)

    def warning(self, **options):
        self.warnings.append(options)

    def error(self, **options):
        self.errors.append(options)


def make_servicer(job):
    repository = FakeRepository(job)
    log_service = FakeLogService()
    servicer = CrawlerServicer(
        db=repository,
        producer=object(),
        log_service=log_service,
        pipeline=object(),
        crawler=object(),
        max_documents=1000,
    )
    return servicer, repository, log_service


class SourceJobQueryTest(unittest.TestCase):
    def test_returns_job_source_fields_by_trace_id(self):
        job = SimpleNamespace(
            id=101,
            trace_id=9001,
            publish_date=datetime(2026, 8, 15, 8, 30, tzinfo=timezone.utc),
            source_platform="智联招聘",
            source_url="https://example.test/job/1",
            city="杭州",
            tags=None,
            major="计算机",
            nature="全职",
            salary="20K-30K",
            job_name="Java 工程师",
            company_name="百工谱",
            company_size="100-499人",
            province="浙江",
            education="本科",
            experience="3-5年",
            job_description="负责后端开发",
            clean_status="SUCCESS",
        )
        servicer, repository, log_service = make_servicer(job)

        response = servicer.GetJobSourceByTraceId(
            crawler_pb2.GetJobSourceByTraceIdRequest(
                trace_id=9001,
                user_id=7,
                user_name="reviewer",
            ),
            FakeContext(),
        )

        self.assertEqual(9001, repository.trace_id)
        self.assertEqual(101, response.id)
        self.assertEqual("Java 工程师", response.job_name)
        self.assertEqual("", response.tags)
        self.assertEqual("SUCCESS", response.clean_status)
        self.assertEqual(1, len(log_service.infos))

    def test_returns_not_found_when_trace_id_does_not_exist(self):
        servicer, _, log_service = make_servicer(None)

        with self.assertRaises(AbortError) as captured:
            servicer.GetJobSourceByTraceId(
                crawler_pb2.GetJobSourceByTraceIdRequest(trace_id=9002),
                FakeContext(),
            )

        self.assertEqual(grpc.StatusCode.NOT_FOUND, captured.exception.code)
        self.assertEqual(1, len(log_service.warnings))


if __name__ == "__main__":
    unittest.main()
