# 百工谱 — ai_service 配置管理

import os


class Config:
    """从环境变量加载配置，所有敏感信息不设默认值"""

    def __init__(self):
        self.grpc_port: int = int(os.getenv("GRPC_PORT", "50053"))
        self.service_name: str = "ai_service"

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

        # LLM — 从 .env 注入，不设默认值
        self.llm_appid: str = os.getenv("APPID", "")
        self.llm_api_key: str = os.getenv("API_KEY", "")
        self.llm_api_secret: str = os.getenv("API_SECRET", "")
        self.llm_dashscope_api_key: str = os.getenv("DASHSCOPE_API_KEY", "")
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "")
        self.llm_model: str = os.getenv("LLM_MODEL", "")

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


config = Config()
