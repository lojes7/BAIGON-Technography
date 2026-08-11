"""Kafka 岗位明细序列化测试。"""

import unittest

from src.kafka.producer import _record_to_dict
from src.service.Zhi_Lian_crawler import JobRecord


class KafkaPayloadTest(unittest.TestCase):
    def test_job_number_is_forwarded_to_data_source(self):
        """job_number 必须跟随内部事件进入 cleaned_job_sources。"""
        record = JobRecord(
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
            job_description=None,
            trace_id=1001,
            job_number="1001",
        )
        payload = _record_to_dict(record)

        self.assertEqual(payload["job_number"], "1001")


if __name__ == "__main__":
    unittest.main()
