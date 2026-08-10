"""crawler 采集任务的内部配置。"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CrawlConfig:
    """仅由 crawler 自身消费的采集参数。"""

    default_interval: str = "24h"
    max_documents_per_task: int = 1000

    def __post_init__(self) -> None:
        if self.max_documents_per_task <= 0:
            raise ValueError("max_documents_per_task 必须大于 0")


crawl_config = CrawlConfig()
