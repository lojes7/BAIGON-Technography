# 百工谱 — ORM 声明基类

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 ORM 实体的声明基类"""
