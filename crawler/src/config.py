# 百工谱 — crawler_service 配置管理

import os


class Config:
    """从环境变量加载配置，所有敏感信息不设默认值"""

    def __init__(self):
        # 服务配置
        self.grpc_port: int = int(os.getenv("GRPC_PORT", "50051"))
        self.service_name: str = "crawler-service"

        # Consul
        self.consul_addr: str = os.getenv("CONSUL_ADDR", "localhost:8500")

        # PostgreSQL — 密码等敏感字段用空字符串兜底，强制从 .env 注入
        self.db_host: str = os.getenv("DB_HOST", "localhost")
        self.db_port: int = int(os.getenv("DB_PORT", "5432"))
        self.db_name: str = os.getenv("DB_NAME", "baigon_crawler")
        self.db_user: str = os.getenv("DB_USER", "")
        self.db_password: str = os.getenv("DB_PASSWORD", "")

        # Kafka
        self.kafka_bootstrap_servers: str = os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )

        # 采集配置
        self.default_crawl_interval: str = os.getenv("CRAWL_INTERVAL", "24h")
        self.max_documents_per_task: int = int(
            os.getenv("MAX_DOCUMENTS_PER_TASK", "1000")
        )

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def db_url_sync(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


# 全局单例
config = Config()
