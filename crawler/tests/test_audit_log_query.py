"""crawler 审计日志查询：权限、筛选归一化与 gRPC 映射。"""

import unittest

from src.service.audit.log_query_service import AuditLogQueryService


class FakeRepository:
    def __init__(self):
        self.calls = []
        self.items = []

    def paged_search(self, **kwargs):
        self.calls.append(kwargs)
        return self.items, len(self.items)


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
if __name__ == "__main__":
    unittest.main()
