# 百工谱 — Kafka 生产者
# 发送文档采集完成事件到 data-source 服务（携带清洗后每条记录的完整明细，
# data-source 据此写入 cleaned_job_sources 表）
# kafka-python 是同步库；gRPC handler 在 worker 线程中运行，可直接阻塞调用

import json
import logging
import uuid
from datetime import datetime, timezone

from kafka import KafkaProducer

from src.service.Zhi_Lian_crawler import JobRecord

logger = logging.getLogger(__name__)

# topic 与事件名一致（已确认决策）
TOPIC_DOCUMENT_INGESTED = "baigon.crawler.document.ingested"

# cleaned_job_sources 表的业务列（不含 id / 审核列，id 由 data-source 生成，
# review_status 等审核列由 data-source 管理，默认 PENDING）。
# trace_id 每条记录独立，data-source 据此关联原始记录。
_PAYLOAD_FIELDS = [
    "trace_id", "publish_date", "source_platform", "source_url", "city", "tags",
    "major", "nature", "salary", "job_name", "company_name",
    "company_size", "province", "education", "experience", "job_description",
]


def _record_to_dict(r: JobRecord) -> dict:
    """JobRecord → JSON 可序列化 dict（datetime 转 ISO 字符串）"""
    return {
        f: getattr(r, f).isoformat() if isinstance(getattr(r, f), datetime) else getattr(r, f)
        for f in _PAYLOAD_FIELDS
    }


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
        document_count: int,
        documents: list[JobRecord],
        user_id: int = 0,
        user_name: str = "system",
        user_ip: str | None = None,
    ) -> None:
        """发送文档采集完成事件

        事件 payload 携带每条清洗后记录的完整明细（documents 数组，
        每项对应 cleaned_job_sources 表的一行业务数据），
        以及操作者用户上下文（供 data-source 写日志/审计）。
        """
        message = {
            "message_id": str(uuid.uuid4()),
            "event_type": TOPIC_DOCUMENT_INGESTED,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_service": "crawler-service",
            "payload": {
                "document_count": document_count,
                # 操作者用户上下文（gateway 透传，供 data-source 写日志/审计）
                "user_id": user_id,
                "user_name": user_name,
                "user_ip": user_ip,
                # 清洗后明细：每条记录全字段（含各自 trace_id，对应 cleaned_job_sources 业务列）
                "documents": [_record_to_dict(d) for d in documents],
            },
        }
        self._producer.send(self._topic, value=message)
        self._producer.flush()  # 同步确认落盘，桩阶段保证消息不丢
        logger.info(
            "已发送事件 %s (count=%d)", TOPIC_DOCUMENT_INGESTED, document_count,
        )

    def close(self) -> None:
        self._producer.close()
        logger.info("Kafka 生产者已关闭")
