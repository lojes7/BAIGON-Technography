"""AI 服务业务审计日志服务。"""

import logging
import threading
import time
from queue import Empty, Full, Queue
from typing import Any

from src.repository.log import LogRepository

logger = logging.getLogger(__name__)

LEVEL_INFO = "INFO"
LEVEL_WARNING = "WARNING"
LEVEL_ERROR = "ERROR"
ALLOWED_REQUEST_METHODS = {"GET", "POST", "PUT", "DELETE"}
DEFAULT_QUEUE_SIZE = 256
DEFAULT_CLOSE_TIMEOUT_SECONDS = 3.0
WORKER_POLL_SECONDS = 0.05


class LogService:
    """封装日志写入；审计库故障不得影响 AI 主业务。"""

    def __init__(
        self,
        log_repository: LogRepository | Any,
        *,
        queue_size: int = DEFAULT_QUEUE_SIZE,
        close_timeout_seconds: float = DEFAULT_CLOSE_TIMEOUT_SECONDS,
    ):
        if queue_size <= 0:
            raise ValueError("queue_size 必须大于 0")
        self._repository = log_repository
        self._queue: Queue[dict[str, Any]] = Queue(maxsize=queue_size)
        self._close_timeout_seconds = max(0.0, close_timeout_seconds)
        self._state_lock = threading.Lock()
        self._accepting = True
        self._closing = threading.Event()
        self._close_deadline: float | None = None
        # 单后台线程严格串行写库，避免 gRPC worker 等待连接池或 PostgreSQL。
        self._worker = threading.Thread(
            target=self._run_worker,
            name="ai-audit-log-worker",
            daemon=True,
        )
        self._worker.start()

    def info(
        self,
        *,
        trace_id: str | int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None,
        request_url: str | None,
        detail: str | None = None,
    ) -> None:
        """记录成功业务调用。"""
        self._record(
            trace_id=trace_id,
            user_id=user_id,
            user_name=user_name,
            user_ip=user_ip,
            level=LEVEL_INFO,
            request_method=request_method,
            request_url=request_url,
            error_msg=None,
            detail=detail,
        )

    def warning(
        self,
        *,
        trace_id: str | int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None,
        request_url: str | None,
        error_msg: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录业务警告。"""
        self._record(
            trace_id=trace_id,
            user_id=user_id,
            user_name=user_name,
            user_ip=user_ip,
            level=LEVEL_WARNING,
            request_method=request_method,
            request_url=request_url,
            error_msg=error_msg,
            detail=detail,
        )

    def error(
        self,
        *,
        trace_id: str | int | None,
        user_id: int,
        user_name: str,
        user_ip: str | None,
        request_method: str | None,
        request_url: str | None,
        error_msg: str | None = None,
        detail: str | None = None,
    ) -> None:
        """记录失败业务调用。"""
        self._record(
            trace_id=trace_id,
            user_id=user_id,
            user_name=user_name,
            user_ip=user_ip,
            level=LEVEL_ERROR,
            request_method=request_method,
            request_url=request_url,
            error_msg=error_msg,
            detail=detail,
        )

    def _record(self, **kwargs: Any) -> None:
        """规范化后非阻塞入队；队列满时丢弃，绝不等待数据库。"""
        try:
            kwargs["trace_id"] = self._parse_trace_id(kwargs.get("trace_id"))
            kwargs["user_id"] = int(kwargs.get("user_id") or 0)
            kwargs["user_name"] = self._text(kwargs.get("user_name"), 64) or "system"
            kwargs["user_ip"] = self._text(kwargs.get("user_ip"), 64)
            kwargs["request_method"] = self._request_method(
                kwargs.get("request_method")
            )
            kwargs["request_url"] = self._text(kwargs.get("request_url"), 256)
            kwargs["error_msg"] = self._text(kwargs.get("error_msg"), 2000)
            kwargs["detail"] = self._text(kwargs.get("detail"), 2000)
        except Exception as exception:
            logger.error(
                "构造 AI 审计日志失败（已忽略，不影响业务）: type=%s",
                type(exception).__name__,
            )
            return

        with self._state_lock:
            if not self._accepting:
                logger.warning("AI 审计日志服务已关闭，当前记录已丢弃")
                return
            try:
                self._queue.put_nowait(kwargs)
            except Full:
                # 只报告容量问题，不打印本条审计字段或任何模型业务内容。
                logger.warning("AI 审计日志队列已满，当前记录已丢弃")

    def close(self, timeout_seconds: float | None = None) -> None:
        """停止接收并在有界时间内尽量写完队列中的审计日志。"""
        timeout = (
            self._close_timeout_seconds
            if timeout_seconds is None
            else max(0.0, timeout_seconds)
        )
        with self._state_lock:
            if self._accepting:
                self._accepting = False
                self._close_deadline = time.monotonic() + timeout
                self._closing.set()

        self._worker.join(timeout=timeout)
        if self._worker.is_alive():
            # worker 是 daemon；数据库超出驱动超时时也不会无限阻塞进程退出。
            logger.warning("AI 审计日志后台线程未在截止时间内退出")

    def _run_worker(self) -> None:
        """单线程消费队列；数据库异常只记录脱敏错误类型。"""
        while True:
            if self._should_stop_worker():
                return
            try:
                entry = self._queue.get(timeout=WORKER_POLL_SECONDS)
            except Empty:
                continue

            try:
                self._repository.insert(**entry)
            except Exception as exception:
                logger.error(
                    "写入 AI logs 表失败（已忽略，不影响业务）: type=%s",
                    type(exception).__name__,
                )
            finally:
                self._queue.task_done()

    def _should_stop_worker(self) -> bool:
        if not self._closing.is_set():
            return False
        if self._queue.empty():
            return True

        deadline = self._close_deadline
        if deadline is None or time.monotonic() < deadline:
            return False

        dropped = self._discard_pending()
        if dropped:
            logger.warning("AI 审计日志关闭超时，已丢弃 %d 条待写记录", dropped)
        return True

    def _discard_pending(self) -> int:
        """关闭超时后清空待处理队列，不输出任何记录内容。"""
        dropped = 0
        while True:
            try:
                self._queue.get_nowait()
            except Empty:
                return dropped
            self._queue.task_done()
            dropped += 1

    @staticmethod
    def _parse_trace_id(value: Any) -> int | None:
        """网关 trace_id 是字符串；仅合法 bigint 才写入公共日志结构。"""
        if value is None or str(value).strip() == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _request_method(value: Any) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip().upper()
        return normalized if normalized in ALLOWED_REQUEST_METHODS else None

    @staticmethod
    def _text(value: Any, limit: int) -> str | None:
        if value is None:
            return None
        text = str(value)
        return text[:limit]
