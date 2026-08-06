# 百工谱 — 数据访问层（SQLAlchemy 2.0 同步）
# gRPC server 是同步 worker 线程，同步 SQLAlchemy 天然匹配，无需事件循环桥接。
# ORM 实体在 src/entity/ 中定义，本层只做数据访问。

import logging

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import sessionmaker

from src.entity.job_source import JobSource
from src.service.Zhi_Lian_crawler import JobRecord
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


class JobSourceRepository:
    """job_sources 表数据访问（同步 SQLAlchemy）"""

    def __init__(self, dsn: str):
        # 同步引擎（psycopg2 驱动，依赖已在 requirements）
        self._engine = create_engine(dsn, pool_size=5, max_overflow=10)
        self._session_factory = sessionmaker(bind=self._engine)
        logger.info("数据库引擎已就绪")

    def insert_job_sources(self, rows: list[JobRecord]) -> int:
        """插入原始数据（clean_status='PENDING'），返回成功插入行数。

        每条记录使用各自的 trace_id（JobRecord.trace_id，爬虫生成时赋值），
        因为 job_sources 有 trace_id 唯一索引（idx_job_sources_trace_id），
        同批共享一个 trace_id 会导致只有第一条入库。
        """
        # 组装与 ORM 实体列对应的字段字典
        records = [
            {
                "id": snowflake.next_id(),  # 雪花 ID
                "trace_id": r.trace_id,
                "publish_date": r.publish_date,
                "source_platform": r.source_platform,
                "source_url": r.source_url,
                "city": r.city,
                "tags": r.tags,
                "major": r.major,
                "nature": r.nature,
                "salary": r.salary,
                "job_name": r.job_name,
                "company_name": r.company_name,
                "company_size": r.company_size,
                "province": r.province,
                "education": r.education,
                "experience": r.experience,
                "job_description": r.job_description,
                "clean_status": "PENDING",
            }
            for r in rows
        ]
        with self._session_factory() as session:
            # PostgreSQL dialect 的 insert ... on_conflict_do_nothing（按各自 trace_id 防重）
            stmt = insert(JobSource).values(records)
            stmt = stmt.on_conflict_do_nothing(index_elements=["trace_id"])
            result = session.execute(stmt)
            session.commit()
        inserted = result.rowcount
        logger.info("job_sources 插入 %d 条", inserted)
        return inserted

    def mark_clean_success(self, trace_ids: list[int]) -> None:
        """清洗成功：clean_status PENDING → SUCCESS（批量按 trace_id 列表）"""
        if not trace_ids:
            return
        with self._session_factory() as session:
            session.query(JobSource).filter(JobSource.trace_id.in_(trace_ids)).update(
                {"clean_status": "SUCCESS"}, synchronize_session=False
            )
            session.commit()
        logger.info("job_sources 清洗状态已置 SUCCESS（%d 条）", len(trace_ids))

    def mark_clean_failed(self, trace_ids: list[int]) -> None:
        """清洗失败：clean_status PENDING → FAILED（批量按 trace_id 列表）"""
        if not trace_ids:
            return
        with self._session_factory() as session:
            session.query(JobSource).filter(JobSource.trace_id.in_(trace_ids)).update(
                {"clean_status": "FAILED"}, synchronize_session=False
            )
            session.commit()
        logger.info("job_sources 清洗状态已置 FAILED（%d 条）", len(trace_ids))

    def close(self) -> None:
        """关闭引擎"""
        self._engine.dispose()
        logger.info("数据库引擎已关闭")
