"""AI 服务同步 SQLAlchemy ORM 声明基类。"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 AI ORM 实体共用的声明基类。"""
