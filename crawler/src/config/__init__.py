# 百工谱 — crawler_service 配置管理

import os


class Config:
    """加载公共配置与部署配置，内部调优参数放在独立配置模块。"""

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
        # 采集完成事件 topic（与事件名一致）
        self.kafka_topic_ingested: str = os.getenv(
            "KAFKA_TOPIC_INGESTED", "baigon.crawler.document.ingested"
        )

        # AI 嵌入服务：默认通过 Consul 发现，也可在本地调试时指定固定地址。
        self.ai_service_name: str = os.getenv("AI_SERVICE_NAME", "ai-service")
        self.ai_grpc_target: str = os.getenv("AI_GRPC_TARGET", "")

    @property
    def db_url_sync(self) -> str:
        """同步 SQLAlchemy DSN（psycopg2 驱动）"""
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


# 全局单例
config = Config()
