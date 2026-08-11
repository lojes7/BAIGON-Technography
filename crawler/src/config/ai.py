"""crawler 调用 AI 服务时使用的内部配置。"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AIConfig:
    """AI 嵌入参数。
    重试参数暂时保留作后续设计使用，当前运行链路不会读取或执行重试。
    """

    grpc_timeout_seconds: float = 30.0
    embedding_dimensions: int = 1024
    embedding_batch_size: int = 20

    # 预留的重试参数：当前不启动 worker，也不调度任何重试任务。
    embedding_retry_interval_seconds: float = 300.0
    embedding_retry_base_seconds: int = 300
    embedding_retry_max_seconds: int = 1800
    embedding_retry_max_attempts: int = 2
    embedding_claim_timeout_seconds: int = 300

    def __post_init__(self) -> None:
        """启动时校验配置文件中的静态参数。"""
        if self.embedding_dimensions != 1024:
            raise ValueError("embedding_dimensions 必须与 vector(1024) 保持一致")
        if self.grpc_timeout_seconds <= 0:
            raise ValueError("grpc_timeout_seconds 必须大于 0")
        if not 1 <= self.embedding_batch_size <= 100:
            raise ValueError("embedding_batch_size 必须在 1 到 100 之间")
        if self.embedding_retry_interval_seconds <= 0:
            raise ValueError("embedding_retry_interval_seconds 必须大于 0")
        if self.embedding_retry_base_seconds <= 0:
            raise ValueError("embedding_retry_base_seconds 必须大于 0")
        if self.embedding_retry_max_seconds < self.embedding_retry_base_seconds:
            raise ValueError(
                "embedding_retry_max_seconds 不能小于 embedding_retry_base_seconds"
            )
        if self.embedding_retry_max_attempts <= 0:
            raise ValueError("embedding_retry_max_attempts 必须大于 0")
        if self.embedding_claim_timeout_seconds <= 0:
            raise ValueError("embedding_claim_timeout_seconds 必须大于 0")


ai_config = AIConfig()
