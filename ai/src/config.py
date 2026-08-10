# 百工谱 — ai_service 配置管理

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ModelConfig:
    """模型地址、名称与能力边界，不通过 Docker Compose 注入。"""

    spark_base_url: str = "https://spark-api-open.xf-yun.com/agent/v1/"
    spark_model: str = "Spark-X2-Flash"
    dashscope_base_url: str = (
        "https://ws-02585sz1ly0611yl.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    )
    embedding_model: str = "qwen3.7-text-embedding"
    embedding_default_dimensions: int = 1024
    embedding_max_dimensions: int = 4096
    embedding_default_chunk_size: int = 20
    embedding_max_chunk_size: int = 100
    embedding_max_batch_size: int = 1000
    # 当前要求模型供应商调用只执行一次，关闭 OpenAI SDK 内置重试。
    provider_max_retries: int = 0


class Config:
    """加载公共配置、部署配置与密钥。"""

    def __init__(self):
        self.grpc_port: int = int(os.getenv("GRPC_PORT", "50053"))
        self.service_name: str = "ai-service"

        self.consul_addr: str = os.getenv("CONSUL_ADDR", "localhost:8500")

        # PostgreSQL — 密码等敏感字段用空字符串兜底，强制从 .env 注入
        self.db_host: str = os.getenv("DB_HOST", "localhost")
        self.db_port: int = int(os.getenv("DB_PORT", "5432"))
        self.db_name: str = os.getenv("DB_NAME", "baigon_ai")
        self.db_user: str = os.getenv("DB_USER", "")
        self.db_password: str = os.getenv("DB_PASSWORD", "")

        # Kafka
        self.kafka_bootstrap_servers: str = os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )

        # 旧版星火 WebSocket 凭据，暂时保留以兼容既有部署配置。
        self.llm_appid: str = os.getenv("APPID", "")
        self.llm_api_key: str = os.getenv("API_KEY", "")
        self.llm_api_secret: str = os.getenv("API_SECRET", "")

        # 讯飞星火 OpenAI 兼容接口：优先使用更明确的 SPARK_API_PASSWORD，
        # 同时兼容早期使用的 API_PASSWORD，方便存量环境平滑迁移。
        self.spark_api_password: str = os.getenv(
            "SPARK_API_PASSWORD", os.getenv("API_PASSWORD", "")
        )
        # 阿里云百炼 OpenAI 兼容接口（文本嵌入模型）。
        self.dashscope_api_key: str = os.getenv("DASHSCOPE_API_KEY", "")

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


config = Config()
model_config = ModelConfig()
