"""基于 job_sources 岗位编号的去重状态测试。"""

import unittest

from src.service.Zhi_Lian_crawler import JobRecord, ZhaopinCrawler


def make_record(job_number: str) -> JobRecord:
    return JobRecord(
        publish_date=None,
        source_platform="test",
        source_url="",
        city=None,
        tags=None,
        major=None,
        nature=None,
        salary=None,
        job_name="测试岗位",
        company_name=None,
        company_size=None,
        province=None,
        education=None,
        experience=None,
        job_description="测试 JD",
        trace_id=1001,
        job_number=job_number,
    )


class CrawlerDedupTest(unittest.TestCase):
    def test_seen_numbers_are_loaded_from_database(self):
        loaded_platforms: list[str] = []

        def load_job_numbers(source_platform: str) -> set[str]:
            loaded_platforms.append(source_platform)
            return {"job-1"}

        crawler = ZhaopinCrawler(load_job_numbers)
        crawler._load_seen()

        self.assertEqual(loaded_platforms, ["智联招聘"])
        self.assertTrue(crawler._is_duplicate("job-1"))
        self.assertFalse(crawler._reserve_seen("job-1"))

    def test_persisted_number_remains_reserved_in_current_task(self):
        crawler = ZhaopinCrawler(lambda _: set())
        self.assertTrue(crawler._reserve_seen("job-2"))

        record = make_record("job-2")
        crawler.mark_records_persisted([record])
        crawler.release_records([record])

        self.assertTrue(crawler._is_duplicate("job-2"))

    def test_failed_database_batch_releases_reserved_number(self):
        crawler = ZhaopinCrawler(lambda _: set())
        self.assertTrue(crawler._reserve_seen("job-3"))
        crawler.release_records([make_record("job-3")])
        self.assertFalse(crawler._is_duplicate("job-3"))

if __name__ == "__main__":
    unittest.main()
