# 百工谱 — crawler_service Kafka 消费者（桩）

import logging

logger = logging.getLogger(__name__)


class KafkaConsumerStub:
    """
    Kafka Consumer 桩实现
    用于接收控制指令和数据源更新通知

    TODO: 实现实际的 Kafka 消费逻辑
    监听 topic: baigon.crawler.control.*
    """

    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        logger.info("Kafka Consumer 初始化: %s", bootstrap_servers)

    async def start(self):
        """启动消费者"""
        logger.info("Kafka Consumer 已启动（桩） — 等待实现")

    async def stop(self):
        """停止消费者"""
        logger.info("Kafka Consumer 已停止")
