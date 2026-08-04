# 百工谱 — 日志服务
# 封装写 logs 表：提供 info / warning / error 三个级别入口。
# 日志写入失败只记录 error，绝不抛出——日志不应阻断业务主流程。

import logging

from src.repository.log import LEVEL_ERROR, LEVEL_INFO, LEVEL_WARNING, LogRepository

logger = logging.getLogger(__name__)


class LogService:
    """业务日志服务（写入 logs 表）"""

    def __init__(self, log_repository: LogRepository):
        self._repo = log_repository

    def info(
        self,
        *,
        trace_id: int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None = None,
        request_url: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录 INFO 级日志"""
        self._record(
            level=LEVEL_INFO, trace_id=trace_id, user_id=user_id, user_name=user_name,
            user_ip=user_ip, request_method=request_method, request_url=request_url,
            error_msg=None, detail=detail,
        )

    def warning(
        self,
        *,
        trace_id: int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None = None,
        request_url: str | None = None,
        error_msg: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录 WARNING 级日志"""
        self._record(
            level=LEVEL_WARNING, trace_id=trace_id, user_id=user_id, user_name=user_name,
            user_ip=user_ip, request_method=request_method, request_url=request_url,
            error_msg=error_msg, detail=detail,
        )

    def error(
        self,
        *,
        trace_id: int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None = None,
        request_url: str | None = None,
        error_msg: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录 ERROR 级日志"""
        self._record(
            level=LEVEL_ERROR, trace_id=trace_id, user_id=user_id, user_name=user_name,
            user_ip=user_ip, request_method=request_method, request_url=request_url,
            error_msg=error_msg, detail=detail,
        )

    def _record(self, **kwargs) -> None:
        """统一写入入口：失败仅记 error，不抛出"""
        try:
            self._repo.insert(**kwargs)
        except Exception:
            logger.exception("写入 logs 表失败（已忽略，不影响业务）")
