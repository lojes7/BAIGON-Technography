# 百工谱 — crawler_service Kafka 生产者（桩）

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class KafkaProducerStub:
    """
    Kafka Producer 桩实现
    用于发送数据采集完成事件

    TODO: 实现实际的 Kafka 生产逻辑
    """

    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        logger.info("Kafka Producer 初始化: %s", bootstrap_servers)

    async def send_document_ingested(
        self, source_document_id: str, evidence_chain_id: str, document_count: int
    ):
        """发送文档采集完成事件"""
        message = {
            "message_id": str(uuid.uuid4()),
            "trace_id": str(uuid.uuid4()),
            "event_type": "baigon.crawler.document.ingested",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_service": "crawler-service",
            "payload": {
                "source_document_id": source_document_id,
                "evidence_chain_id": evidence_chain_id,
                "document_count": document_count,
            },
        }
        logger.info("Kafka 事件 (桩): %s", json.dumps(message, ensure_ascii=False))
        # TODO: producer.send(topic, value=message)
