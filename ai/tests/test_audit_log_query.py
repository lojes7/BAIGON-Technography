"""AI 审计日志查询：ADMIN 权限、筛选归一化与 gRPC 映射。"""

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from src.pb import audit_pb2
from src.server.grpc_server import AIServicer
from src.service.audit.log_query_service import AuditLogPage, AuditLogQueryService


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


class FakeLogService:
    def __init__(self):
        self.entries = []

    def info(self, **kwargs):
        self.entries.append(("INFO", kwargs))

    def error(self, **kwargs):
        self.entries.append(("ERROR", kwargs))


class AuditLogQueryServiceTest(unittest.TestCase):
    def test_admin_query_normalizes_filters(self):
        repository = FakeRepository()
        page = AuditLogQueryService(repository).paged_search(
            requester_role="ADMIN",
            page=2,
            page_size=25,
            level="error",
            created_at_from="2026-08-01T00:00:00Z",
            created_at_to="2026-08-31T23:59:59Z",
            target_user_id=0,
        )
        self.assertEqual((page.page, page.page_size), (2, 25))
        self.assertEqual(repository.calls[0]["level"], "ERROR")
        self.assertIsNone(repository.calls[0]["target_user_id"])

    def test_non_admin_is_rejected(self):
        service = AuditLogQueryService(FakeRepository())
        with self.assertRaises(PermissionError):
            service.paged_search(
                requester_role="DATA_ANALYST", page=0, page_size=20, level="",
                created_at_from="", created_at_to="", target_user_id=0,
            )

    def test_batch_get_deduplicates_and_preserves_request_order(self):
        repository = FakeRepository()
        repository.items = [SimpleNamespace(id=3), SimpleNamespace(id=9)]
        result = AuditLogQueryService(repository).batch_get(
            requester_role="ADMIN", ids=[9, 3, 9]
        )
        self.assertEqual([item.id for item in result], [9, 3])
        self.assertEqual(repository.calls[-1]["ids"], [9, 3])
        with self.assertRaises(PermissionError):
            AuditLogQueryService(repository).batch_get(
                requester_role="DATA_ANALYST", ids=[9]
            )
        with self.assertRaises(ValueError):
            AuditLogQueryService(repository).batch_get(
                requester_role="ADMIN", ids=[1] * 201
            )


class AIAuditLogGrpcTest(unittest.TestCase):
    def test_list_returns_ids_and_batch_returns_desensitized_details(self):
        item = SimpleNamespace(
            id=9007199254740993,
            trace_id=9007199254740995,
            user_id=7,
            user_name="管理员",
            user_ip="127.0.0.1",
            level="ERROR",
            request_method="POST",
            request_url="/internal/ai",
            error_msg="MODEL_UNAVAILABLE",
            detail="AnalyzeJobMatch 失败",
            created_at=datetime(2026, 8, 25, tzinfo=timezone.utc),
        )
        query_service = SimpleNamespace(
            paged_search=lambda **_kwargs: AuditLogPage([item], 1, 0, 20),
            batch_get=lambda **_kwargs: [item],
        )
        log_service = FakeLogService()
        servicer = AIServicer(
            model_service=object(),
            log_service=log_service,
            audit_log_query_service=query_service,
        )

        list_response = servicer.PagedSearchAuditLogs(
            audit_pb2.PagedSearchAuditLogsRequest(
                page=0, page_size=20, user_id=7, user_name="admin", user_role="ADMIN"
            ),
            context=SimpleNamespace(abort=lambda code, message: self.fail((code, message))),
        )

        self.assertEqual(list(list_response.audit_log_ids), [9007199254740993])
        self.assertEqual(len(list_response.detail_items), 0)

        detail_response = servicer.PagedSearchAuditLogs(
            audit_pb2.PagedSearchAuditLogsRequest(
                target_log_ids=[9007199254740993, 8],
                user_id=7,
                user_name="admin",
                user_role="ADMIN",
            ),
            context=SimpleNamespace(abort=lambda code, message: self.fail((code, message))),
        )
        self.assertEqual(detail_response.detail_items[0].id, 9007199254740993)
        self.assertEqual(detail_response.detail_items[0].error_msg, "MODEL_UNAVAILABLE")
        self.assertEqual(detail_response.detail_items[0].user_type, "")
        self.assertEqual(list(detail_response.missing_audit_log_ids), [8])
        self.assertEqual(log_service.entries[-1][0], "INFO")


if __name__ == "__main__":
    unittest.main()
