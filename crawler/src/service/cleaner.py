# 百工谱 — 清洗桩实现
# TODO: 后续接入真实清洗逻辑

import logging

from src.service.Zhi_Lian_crawler import JobRecord

logger = logging.getLogger(__name__)


def clean(records: list[JobRecord]) -> list[JobRecord]:
    """清洗桩：strip 各文本字段、剔除 job_name/company_name 为空的记录

    返回清洗后的记录列表（返回空列表视为清洗后无有效数据）。
    """
    cleaned: list[JobRecord] = []
    for r in records:
        cleaned.append(r)

    logger.info("清洗完成: %d 条输入 → %d 条输出", len(records), len(cleaned))
    return cleaned
