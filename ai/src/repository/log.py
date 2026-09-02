"""AI 服务业务审计日志数据访问层。"""

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from src.entity.log import Log

logger = logging.getLogger(__name__)


class LogRepository:
    """使用同步 SQLAlchemy 2.0 与 psycopg2 写入 ``logs`` 表。"""

    def __init__(self, dsn: str):
        # 每次取连接前先探活，避免 PostgreSQL 重启后复用僵尸连接。
        self._engine = create_engine(
            dsn,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_timeout=1,
            connect_args={
                "connect_timeout": 2,
                # 日志写入必须快速失败，避免后台 worker 长时间占用关闭窗口。
                "options": "-c statement_timeout=2000 -c lock_timeout=1000",
            },
        )
        self._session_factory = sessionmaker(bind=self._engine)
        logger.info("AI 审计日志数据库引擎已就绪")

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
        """在独立事务中写入一条业务审计日志。"""
        now = datetime.now(timezone.utc)
        entity = Log(
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
            session.add(entity)
            session.commit()

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
        """按稳定倒序分页查询 AI 脱敏审计日志。"""
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
        """释放数据库连接池。"""
        self._engine.dispose()
        logger.info("AI 审计日志数据库引擎已关闭")
