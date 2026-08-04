# 百工谱 — Kafka 生产者
# 发送文档采集完成事件到 data-source 服务（清洗后的数据由 data-source 落库 cleaned_job_sources）
# kafka-python 是同步库；gRPC handler 在 worker 线程中运行，可直接阻塞调用

import json
import logging
import uuid
from datetime import datetime, timezone

from kafka import KafkaProducer

logger = logging.getLogger(__name__)

# topic 与事件名一致
TOPIC_DOCUMENT_INGESTED = "baigon.crawler.document.ingested"


class KafkaProducerClient:
    """采集完成事件生产者"""

    def __init__(self, bootstrap_servers: str, topic: str = TOPIC_DOCUMENT_INGESTED):
        self._producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
            acks="all",  # 桩阶段确保投递；性能优化留后续
        )
        self._topic = topic
        logger.info("Kafka 生产者已初始化: %s (topic=%s)", bootstrap_servers, topic)

    def send_document_ingested(
        self,
        source_document_id: str,
        evidence_chain_id: str,
        document_count: int,
        trace_id: str,
    ) -> None:
        """发送文档采集完成事件（事件信封与桩保持一致，透传 trace_id）"""
        message = {
            "message_id": str(uuid.uuid4()),
            "trace_id": trace_id,
            "event_type": TOPIC_DOCUMENT_INGESTED,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_service": "crawler-service",
            "payload": {
                "source_document_id": source_document_id,
                "evidence_chain_id": evidence_chain_id,
                "document_count": document_count,
            },
        }
        self._producer.send(self._topic, value=message)
        self._producer.flush()  # 同步确认落盘，桩阶段保证消息不丢
        logger.info("已发送事件 %s (count=%d, trace_id=%s)", TOPIC_DOCUMENT_INGESTED, document_count, trace_id)

    def close(self) -> None:
        self._producer.close()
        logger.info("Kafka 生产者已关闭")
