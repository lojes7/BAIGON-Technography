# 百工谱 — JobSource ORM 实体
# 映射 crawler 库的 job_sources 表（与 crawler/init.sql 列一一对应）

from sqlalchemy import BigInteger, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.entity.base import Base


class JobSource(Base):
    """job_sources 表 ORM 实体"""

    __tablename__ = "job_sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trace_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    publish_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_platform: Mapped[str] = mapped_column(String(32), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(512))
    city: Mapped[str | None] = mapped_column(String(64))
    tags: Mapped[str | None] = mapped_column(Text)
    major: Mapped[str | None] = mapped_column(String(64))
    nature: Mapped[str | None] = mapped_column(String(64))
    salary: Mapped[str | None] = mapped_column(String(64))
    job_name: Mapped[str | None] = mapped_column(String(64))
    company_name: Mapped[str | None] = mapped_column(String(64))
    company_size: Mapped[str | None] = mapped_column(String(64))
    province: Mapped[str | None] = mapped_column(String(64))
    education: Mapped[str | None] = mapped_column(String(64))
    experience: Mapped[str | None] = mapped_column(Text)
    job_description: Mapped[str | None] = mapped_column(Text)
    clean_status: Mapped[str | None] = mapped_column(String(32))
