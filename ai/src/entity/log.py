"""AI 服务业务审计日志 ORM 实体。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.entity.base import Base


class Log(Base):
    """映射 AI 独立数据库中的 ``logs`` 表。"""

    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )
    trace_id: Mapped[int | None] = mapped_column(BigInteger)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_name: Mapped[str] = mapped_column(String(64), nullable=False)
    user_ip: Mapped[str | None] = mapped_column(String(64))
    level: Mapped[str] = mapped_column(
        Enum("INFO", "ERROR", "WARNING", name="level", create_type=False),
        nullable=False,
    )
    request_method: Mapped[str | None] = mapped_column(
        Enum(
            "GET",
            "POST",
            "PUT",
            "DELETE",
            name="request_method",
            create_type=False,
        )
    )
    request_url: Mapped[str | None] = mapped_column(String(256))
    error_msg: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
