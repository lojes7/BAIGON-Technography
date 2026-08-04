# 百工谱 — Log ORM 实体
# 映射 crawler 库的 logs 表（与 crawler/init.sql 列一一对应）

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.entity.base import Base


class Log(Base):
    """logs 表 ORM 实体"""

    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trace_id: Mapped[int | None] = mapped_column(BigInteger)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_name: Mapped[str] = mapped_column(String(8), nullable=False)
    user_ip: Mapped[str | None] = mapped_column(String(64))
    # level / request_method 是 PostgreSQL enum，用字符串存枚举名
    level: Mapped[str] = mapped_column(String(32), nullable=False)
    request_method: Mapped[str | None] = mapped_column(String(32))
    request_url: Mapped[str | None] = mapped_column(String(256))
    error_msg: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
