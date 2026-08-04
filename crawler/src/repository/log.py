# 百工谱 — logs 表数据访问层（同步 SQLAlchemy）

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine
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
        self._engine = create_engine(dsn, pool_size=5, max_overflow=10)
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

    def close(self) -> None:
        self._engine.dispose()
        logger.info("日志表引擎已关闭")
