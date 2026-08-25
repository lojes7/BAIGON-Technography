"""Kafka 岗位明细序列化测试。"""

import unittest
from datetime import datetime, timezone

from src.kafka.producer import _record_to_dict
from src.service.Zhi_Lian_crawler import JobRecord


class KafkaPayloadTest(unittest.TestCase):
    @staticmethod
    def _record(publish_date: datetime | None = None) -> JobRecord:
        return JobRecord(
            publish_date=publish_date,
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
            job_description=None,
            trace_id=1001,
            job_number="1001",
        )

    def test_job_number_is_forwarded_to_data_source(self):
        """job_number 必须跟随内部事件进入 cleaned_job_sources。"""
        record = self._record()
        payload = _record_to_dict(record)

        self.assertEqual(payload["job_number"], "1001")

    def test_naive_publish_date_is_serialized_with_china_timezone(self):
        """无时区的智联发布时间必须补 +08:00，避免消费端解析成 NULL。"""
        payload = _record_to_dict(self._record(datetime(2026, 8, 25, 12, 0, 0)))

        self.assertEqual(payload["publish_date"], "2026-08-25T12:00:00+08:00")

    def test_aware_publish_date_keeps_original_timezone(self):
        """已带时区的时间不应被重新解释。"""
        payload = _record_to_dict(
            self._record(datetime(2026, 8, 25, 4, 0, 0, tzinfo=timezone.utc))
        )

        self.assertEqual(payload["publish_date"], "2026-08-25T04:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
