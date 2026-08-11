"""crawler 数据处理流水线的内部配置。"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PipelineConfig:
    """控制批次并发与 Kafka 确认等待时间。"""

    max_inflight_batches: int = 2
    kafka_delivery_timeout_seconds: float = 30.0

    def __post_init__(self) -> None:
        if self.max_inflight_batches <= 0:
            raise ValueError("max_inflight_batches 必须大于 0")
        if self.kafka_delivery_timeout_seconds <= 0:
            raise ValueError("kafka_delivery_timeout_seconds 必须大于 0")


pipeline_config = PipelineConfig()
