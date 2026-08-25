# 百工谱 — JobSource ORM 实体
# 映射 crawler 库的 job_sources 表（与 crawler/init.sql 列一一对应）

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from src.entity.base import Base

TASK_STATUS_ENUM = ENUM(
    "SUCCESS",
    "FAILED",
    "PENDING",
    name="task_status",
    create_type=False,
)


class JobSource(Base):
    """job_sources 表 ORM 实体"""

    __tablename__ = "job_sources"
    __table_args__ = (
        # 普通联合索引：job_number 是岗位业务身份，允许同一岗位保留多条记录。
        Index("idx_job_sources_platform_job_number", "source_platform", "job_number"),
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trace_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    publish_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 可空：解析失败诚实存 NULL
    source_platform: Mapped[str] = mapped_column(String(32), nullable=False)
    job_number: Mapped[str | None] = mapped_column(String(128))
    source_url: Mapped[str | None] = mapped_column(String(512))
    city: Mapped[str | None] = mapped_column(String(64))
    tags: Mapped[str | None] = mapped_column(Text)
    major: Mapped[str | None] = mapped_column(String(64))
    nature: Mapped[str | None] = mapped_column(String(64))
    salary: Mapped[str | None] = mapped_column(String(64))
    job_name: Mapped[str] = mapped_column(String(64), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(64))
    company_size: Mapped[str | None] = mapped_column(String(64))
    province: Mapped[str | None] = mapped_column(String(64))
    education: Mapped[str | None] = mapped_column(String(64))
    experience: Mapped[str | None] = mapped_column(Text)
    job_description: Mapped[str | None] = mapped_column(Text)
    job_description_vector: Mapped[list[float] | None] = mapped_column(Vector(1024))
    embedding_status: Mapped[str] = mapped_column(
        TASK_STATUS_ENUM,
        nullable=False,
        default="PENDING",
    )
    embedding_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding_next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding_error: Mapped[str | None] = mapped_column(Text)
    clean_status: Mapped[str | None] = mapped_column(TASK_STATUS_ENUM)
