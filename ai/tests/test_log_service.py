"""AI 审计日志服务测试：只使用 fake repository，不连接数据库。"""

import unittest
from threading import Event
from time import monotonic

from src.service.log_service import LogService


class FakeLogRepository:
    def __init__(self, failure: Exception | None = None):
        self.failure = failure
        self.entries = []

    def insert(self, **kwargs):
        if self.failure is not None:
            raise self.failure
        self.entries.append(kwargs)


class BlockingLogRepository:
    """模拟数据库写入卡住，用于验证 RPC 线程只负责非阻塞入队。"""

    def __init__(self):
        self.started = Event()
        self.release = Event()
        self.entries = []

    def insert(self, **kwargs):
        self.started.set()
        self.release.wait(timeout=2)
        self.entries.append(kwargs)


class LogServiceTest(unittest.TestCase):
    def test_normalizes_audit_context_before_insert(self):
        repository = FakeLogRepository()
        service = LogService(repository)

        service.info(
            trace_id="123456",
            user_id=7,
            user_name="张三",
            user_ip="127.0.0.1",
            request_method="post",
            request_url="/api/auth/resumes/analyze-skills",
            detail="AnalyzeUserSkills 成功",
        )
        # close 会在有界时间内等待后台队列排空，避免竞态断言。
        service.close()

        self.assertEqual(len(repository.entries), 1)
        entry = repository.entries[0]
        self.assertEqual(entry["trace_id"], 123456)
        self.assertEqual(entry["request_method"], "POST")
        self.assertEqual(entry["level"], "INFO")
        self.assertIsNone(entry["error_msg"])

    def test_repository_failure_is_logged_and_not_raised(self):
        service = LogService(FakeLogRepository(RuntimeError("数据库不可用")))

        with self.assertLogs("src.service.log_service", level="ERROR") as captured:
            service.error(
                trace_id="not-a-number",
                user_id=7,
                user_name="张三",
                user_ip="127.0.0.1",
                request_method="POST",
                request_url="/api/jobs/8/match",
                error_msg="INTERNAL",
                detail="AnalyzeJobMatch 失败",
            )
            service.close()

        self.assertIn("已忽略，不影响业务", "\n".join(captured.output))

    def test_slow_repository_does_not_block_enqueue_and_full_queue_drops(self):
        repository = BlockingLogRepository()
        service = LogService(repository, queue_size=1)

        started_at = monotonic()
        service.info(
            trace_id="1",
            user_id=7,
            user_name="张三",
            user_ip="127.0.0.1",
            request_method="POST",
            request_url="/api/auth/resumes/analyze-skills",
            detail="AnalyzeUserSkills 成功",
        )
        self.assertLess(monotonic() - started_at, 0.5)
        self.assertTrue(repository.started.wait(timeout=1.0))

        # worker 正阻塞在第一条写库；第二条占满队列，第三条必须立即丢弃。
        service.info(
            trace_id="2",
            user_id=7,
            user_name="张三",
            user_ip="127.0.0.1",
            request_method="POST",
            request_url="/api/auth/resumes/analyze-skills",
            detail="AnalyzeUserSkills 成功",
        )
        private_text = "私密简历正文-不得进入告警"
        with self.assertLogs("src.service.log_service", level="WARNING") as captured:
            started_at = monotonic()
            service.info(
                trace_id="3",
                user_id=7,
                user_name="张三",
                user_ip="127.0.0.1",
                request_method="POST",
                request_url="/api/auth/resumes/analyze-skills",
                detail=private_text,
            )
            self.assertLess(monotonic() - started_at, 0.5)

        warnings = "\n".join(captured.output)
        self.assertIn("队列已满", warnings)
        self.assertNotIn(private_text, warnings)
        repository.release.set()
        service.close()
        self.assertEqual(len(repository.entries), 2)

    def test_close_is_bounded_when_repository_is_still_busy(self):
        repository = BlockingLogRepository()
        service = LogService(repository, close_timeout_seconds=0.02)
        service.info(
            trace_id="1",
            user_id=7,
            user_name="张三",
            user_ip="127.0.0.1",
            request_method="POST",
            request_url="/api/jobs/8/match",
            detail="AnalyzeJobMatch 成功",
        )
        self.assertTrue(repository.started.wait(timeout=1.0))

        with self.assertLogs("src.service.log_service", level="WARNING"):
            started_at = monotonic()
            service.close()
            elapsed = monotonic() - started_at
        self.assertLess(elapsed, 0.25)

        # 释放 fake 后再次有界等待，防止测试留下仍运行的 daemon worker。
        repository.release.set()
        service.close(timeout_seconds=0.5)


if __name__ == "__main__":
    unittest.main()
