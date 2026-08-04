# 百工谱 — 清洗桩实现
# TODO: 后续接入真实清洗逻辑（去重、字段标准化、NLP 抽取等），当前只做基础文本处理

import logging

from src.service.fetcher import JobRecord

logger = logging.getLogger(__name__)


def clean(records: list[JobRecord]) -> list[JobRecord]:
    """清洗桩：strip 各文本字段、剔除 job_name/company_name 为空的记录

    返回清洗后的记录列表（返回空列表视为清洗后无有效数据）。
    """
    cleaned: list[JobRecord] = []
    for r in records:
        # 文本字段去首尾空白
        r.job_name = (r.job_name or "").strip()
        r.company_name = (r.company_name or "").strip()
        r.job_description = (r.job_description or "").strip()
        r.tags = (r.tags or "").strip()
        r.experience = (r.experience or "").strip()
        # 剔除关键字段为空的记录
        if not r.job_name or not r.company_name:
            continue
        cleaned.append(r)

    logger.info("清洗完成: %d 条输入 → %d 条输出", len(records), len(cleaned))
    return cleaned
