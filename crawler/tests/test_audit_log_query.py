"""crawler 审计日志查询：权限、筛选归一化与 gRPC 映射。"""

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from src.pb import audit_pb2
from src.service.audit.log_query_service import AuditLogPage, AuditLogQueryService

try:
    from src.server.grpc_server import CrawlerServicer
except ModuleNotFoundError as exception:
    if exception.name != "pgvector":
        raise
    # 本地只装轻量测试依赖时仍执行服务层测试；完整环境会执行 gRPC 契约测试。
    CrawlerServicer = None


class FakeRepository:
    def __init__(self):
        self.calls = []
        self.items = []

    def paged_search(self, **kwargs):
        self.calls.append(kwargs)
        return self.items, len(self.items)

    def batch_get(self, ids):
        self.calls.append({"ids": ids})
        return [item for item in self.items if item.id in ids]


class AuditLogQueryServiceTest(unittest.TestCase):
    def test_admin_query_normalizes_filters(self):
        repository = FakeRepository()
        service = AuditLogQueryService(repository)

        page = service.paged_search(
            requester_role="ADMIN",
            page=1,
            page_size=0,
            level="warning",
            created_at_from="2026-08-01T00:00:00Z",
            created_at_to="2026-08-31T23:59:59+00:00",
            target_user_id=123,
        )

        self.assertEqual(page.page_size, 20)
        self.assertEqual(repository.calls[0]["level"], "WARNING")
        self.assertEqual(repository.calls[0]["target_user_id"], 123)
        self.assertIsNotNone(repository.calls[0]["created_at_from"].tzinfo)

    def test_non_admin_is_rejected(self):
        service = AuditLogQueryService(FakeRepository())
        with self.assertRaises(PermissionError):
            service.paged_search(
                requester_role="STUDENT", page=0, page_size=20, level="",
                created_at_from="", created_at_to="", target_user_id=0,
            )

    def test_invalid_filters_are_rejected(self):
        service = AuditLogQueryService(FakeRepository())
        with self.assertRaises(ValueError):
            service.paged_search(
                requester_role="ADMIN", page=0, page_size=101, level="",
                created_at_from="", created_at_to="", target_user_id=0,
            )
        with self.assertRaises(ValueError):
            service.paged_search(
                requester_role="ADMIN", page=0, page_size=20, level="DEBUG",
                created_at_from="", created_at_to="", target_user_id=0,
            )

    def test_batch_get_deduplicates_and_preserves_request_order(self):
        repository = FakeRepository()
        repository.items = [type("Log", (), {"id": 3})(), type("Log", (), {"id": 9})()]
        result = AuditLogQueryService(repository).batch_get(
            requester_role="ADMIN", ids=[9, 3, 9]
        )
        self.assertEqual([item.id for item in result], [9, 3])
        self.assertEqual(repository.calls[-1]["ids"], [9, 3])

        with self.assertRaises(PermissionError):
            AuditLogQueryService(repository).batch_get(
                requester_role="STUDENT", ids=[9]
            )

        with self.assertRaises(ValueError):
            AuditLogQueryService(repository).batch_get(
                requester_role="ADMIN", ids=[1] * 201
            )


class FakeLogService:
    def __init__(self):
        self.entries = []

    def info(self, **kwargs):
        self.entries.append(("INFO", kwargs))

    def warning(self, **kwargs):
        self.entries.append(("WARNING", kwargs))

    def error(self, **kwargs):
        self.entries.append(("ERROR", kwargs))


@unittest.skipIf(CrawlerServicer is None, "本地未安装 crawler 完整 pgvector 依赖")
class CrawlerAuditLogGrpcTest(unittest.TestCase):
    def test_list_returns_ids_and_batch_returns_flat_details_with_missing_ids(self):
        item = SimpleNamespace(
            id=9007199254740993,
            trace_id=9007199254740995,
            user_id=7,
            user_name="管理员",
            user_ip="127.0.0.1",
            level="ERROR",
            request_method="POST",
            request_url="/internal/crawler",
            error_msg="CRAWL_FAILED",
            detail="crawl failed",
            created_at=datetime(2026, 8, 25, tzinfo=timezone.utc),
        )
        query_service = SimpleNamespace(
            paged_search=lambda **_kwargs: AuditLogPage([item], 1, 0, 20),
            batch_get=lambda **_kwargs: [item],
        )
        log_service = FakeLogService()
        servicer = CrawlerServicer(
            db=object(),
            producer=object(),
            log_service=log_service,
            pipeline=object(),
            crawler=object(),
            max_documents=100,
            audit_log_query_service=query_service,
        )
        context = SimpleNamespace(
            abort=lambda code, message: self.fail((code, message))
        )

        list_response = servicer.PagedSearchAuditLogs(
            audit_pb2.PagedSearchAuditLogsRequest(
                page=0, page_size=20, user_id=7, user_name="admin", user_role="ADMIN"
            ),
            context=context,
        )
        self.assertEqual(list(list_response.audit_log_ids), [9007199254740993])
        self.assertEqual(len(list_response.detail_items), 0)

        detail_response = servicer.PagedSearchAuditLogs(
            audit_pb2.PagedSearchAuditLogsRequest(
                target_log_ids=[9007199254740993, 8, 8],
                user_id=7,
                user_name="admin",
                user_role="ADMIN",
            ),
            context=context,
        )
        self.assertEqual(detail_response.detail_items[0].id, 9007199254740993)
        self.assertEqual(detail_response.detail_items[0].error_msg, "CRAWL_FAILED")
        self.assertEqual(detail_response.detail_items[0].user_type, "")
        self.assertEqual(list(detail_response.missing_audit_log_ids), [8])
        self.assertEqual(log_service.entries[-1][0], "INFO")


if __name__ == "__main__":
    unittest.main()
