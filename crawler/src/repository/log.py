# 百工谱 — logs 表数据访问层（同步 SQLAlchemy）

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from src.entity.log import Log
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)

# 日志级别（与 init.sql 的 level 枚举一致）
LEVEL_INFO = "INFO"
LEVEL_WARNING = "WARNING"
LEVEL_ERROR = "ERROR"


class LogRepository:
    """logs 表数据访问（同步 SQLAlchemy）"""

    def __init__(self, dsn: str):
        # pool_pre_ping：取连接前验证，防 Postgres 重启后的僵尸连接
        self._engine = create_engine(dsn, pool_size=5, max_overflow=10, pool_pre_ping=True)
        self._session_factory = sessionmaker(bind=self._engine)
        logger.info("日志表引擎已就绪")

    def insert(
        self,
        *,
        trace_id: int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        level: str,
        request_method: str | None,
        request_url: str | None,
        error_msg: str | None,
        detail: str | None,
    ) -> None:
        """写入一条日志记录"""
        now = datetime.now(timezone.utc)
        log = Log(
            id=snowflake.next_id(),
            trace_id=trace_id,
            user_id=user_id,
            user_name=user_name,
            user_ip=user_ip,
            level=level,
            request_method=request_method,
            request_url=request_url,
            error_msg=error_msg,
            detail=detail,
            created_at=now,
            updated_at=now,
        )
        with self._session_factory() as session:
            session.add(log)
            session.commit()
        logger.info("已写入日志: level=%s user=%s(%d) trace=%s", level, user_name, user_id, trace_id)

    def paged_search(
        self,
        *,
        page: int,
        page_size: int,
        level: str | None,
        created_at_from: datetime | None,
        created_at_to: datetime | None,
        target_user_id: int | None,
    ) -> tuple[list[Log], int]:
        """按稳定倒序分页查询未软删除日志。"""
        filters = [Log.deleted_at.is_(None)]
        if level is not None:
            filters.append(Log.level == level)
        if created_at_from is not None:
            filters.append(Log.created_at >= created_at_from)
        if created_at_to is not None:
            filters.append(Log.created_at <= created_at_to)
        if target_user_id is not None:
            filters.append(Log.user_id == target_user_id)

        query = (
            select(Log)
            .where(*filters)
            .order_by(Log.created_at.desc(), Log.id.desc())
            .offset(page * page_size)
            .limit(page_size)
        )
        count_query = select(func.count()).select_from(Log).where(*filters)
        with self._session_factory() as session:
            items = list(session.scalars(query).all())
            total = int(session.scalar(count_query) or 0)
        return items, total

    def batch_get(self, ids: list[int]) -> list[Log]:
        """批量读取未软删除日志，顺序由业务层按请求 ID 恢复。"""
        query = select(Log).where(Log.deleted_at.is_(None), Log.id.in_(ids))
        with self._session_factory() as session:
            return list(session.scalars(query).all())

    def close(self) -> None:
        self._engine.dispose()
        logger.info("日志表引擎已关闭")
