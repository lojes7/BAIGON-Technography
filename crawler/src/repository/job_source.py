# 百工谱 — 数据访问层（SQLAlchemy 2.0 同步）
# gRPC server 是同步 worker 线程，同步 SQLAlchemy 天然匹配，无需事件循环桥接。
# ORM 实体在 src/entity/ 中定义，本层只做数据访问。

import logging

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import sessionmaker

from src.entity.job_source import JobSource
from src.service.Zhi_Lian_crawler import JobRecord
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


class JobSourceRepository:
    """job_sources 表数据访问（同步 SQLAlchemy）"""

    def __init__(self, dsn: str):
        # 同步引擎（psycopg2 驱动）；pool_pre_ping：取连接前验证，防 Postgres 重启后的僵尸连接
        self._engine = create_engine(dsn, pool_size=5, max_overflow=10, pool_pre_ping=True)
        self._session_factory = sessionmaker(bind=self._engine)
        logger.info("数据库引擎已就绪")

    def insert_job_sources(
        self,
        rows: list[JobRecord],
        embeddings: dict[int, list[float]] | None = None,
        embedding_error: str | None = None,
    ) -> int:
        """插入原始数据（clean_status='PENDING'），返回成功插入行数。

        每条记录使用各自的 trace_id（JobRecord.trace_id，爬虫生成时赋值），
        因为 job_sources 有 trace_id 唯一索引（idx_job_sources_trace_id），
        同批共享一个 trace_id 会导致只有第一条入库。
        """
        embeddings = embeddings or {}

        # 组装与 ORM 实体列对应的字段字典；AI 失败不阻止原始岗位入库。
        records = [
            {
                "id": snowflake.next_id(),  # 雪花 ID
                "trace_id": r.trace_id,
                "publish_date": r.publish_date,
                "source_platform": r.source_platform,
                "job_number": r.job_number,
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
                "job_description_vector": embeddings.get(r.trace_id),
                "embedding_status": self._initial_embedding_status(r, embeddings),
                "embedding_attempts": 1 if r.job_description and r.job_description.strip() else 0,
                # 重试字段暂时保留，但当前失败后不调度后续任务。
                "embedding_next_retry_at": None,
                "embedding_error": (
                    embedding_error[:2000]
                    if embedding_error
                    and r.job_description
                    and r.job_description.strip()
                    and r.trace_id not in embeddings
                    else None
                ),
                "clean_status": "PENDING",
            }
            for r in rows
        ]
        with self._session_factory() as session:
            # 普通批量 INSERT：每条 trace_id 独立（雪花 ID 不重复），
            # 表上 idx_job_sources_trace_id 部分唯一索引天然防重。
            # 注意：不能用 ON CONFLICT (trace_id)——部分唯一索引（WHERE deleted_at IS NULL）
            # 无法被 ON CONFLICT 匹配，会报 "no unique or exclusion constraint matching"。
            stmt = insert(JobSource).values(records)
            result = session.execute(stmt)
            inserted = result.rowcount
            session.commit()
        logger.info("job_sources 插入 %d 条", inserted)
        return inserted

    def get_existing_job_numbers(self, source_platform: str) -> set[str]:
        """按来源平台加载未删除岗位编号，供爬虫建立本次任务去重基线。"""
        with self._session_factory() as session:
            numbers = session.scalars(
                select(JobSource.job_number).where(
                    JobSource.source_platform == source_platform,
                    JobSource.job_number.is_not(None),
                    JobSource.deleted_at.is_(None),
                )
            ).all()
        return {number for number in numbers if number}

    @staticmethod
    def _initial_embedding_status(
        row: JobRecord,
        embeddings: dict[int, list[float]],
    ) -> str:
        """无 JD 无需生成向量；有 JD 时按本次 AI 调用结果设置状态。"""
        if not row.job_description or not row.job_description.strip():
            return "SUCCESS"
        return "SUCCESS" if row.trace_id in embeddings else "FAILED"

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
