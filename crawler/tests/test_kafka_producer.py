"""Kafka 岗位明细序列化测试。"""

import unittest
from datetime import datetime, timezone

from src.kafka.producer import _record_to_dict
from src.service.Zhi_Lian_crawler import JobRecord, _parse_publish_date


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

    def test_naive_publish_date_is_serialized_as_utc_without_time_shift(self):
        """无时区时间补 UTC，但不得改变源数据的墙上时间。"""
        payload = _record_to_dict(self._record(datetime(2026, 8, 25, 12, 0, 0)))

        self.assertEqual(payload["publish_date"], "2026-08-25T12:00:00+00:00")

    def test_publish_date_parser_returns_utc_aware_value(self):
        """入口解析即明确 UTC，源表与 Kafka 不再依赖数据库会话时区。"""
        parsed = _parse_publish_date("2026-08-25 12:00:00")

        self.assertEqual(parsed, datetime(2026, 8, 25, 12, 0, 0, tzinfo=timezone.utc))

    def test_aware_publish_date_keeps_original_timezone(self):
        """已带时区的时间不应被重新解释。"""
        payload = _record_to_dict(
            self._record(datetime(2026, 8, 25, 4, 0, 0, tzinfo=timezone.utc))
        )

        self.assertEqual(payload["publish_date"], "2026-08-25T04:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
