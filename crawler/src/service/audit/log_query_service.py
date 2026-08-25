"""crawler 审计日志分页查询业务层。"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

ALLOWED_LEVELS = {"INFO", "WARNING", "ERROR"}
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class AuditLogPage:
    items: list[Any]
    total: int
    page: int
    page_size: int


class AuditLogQueryService:
    """只允许 ADMIN 查询 crawler 独立库，权限不依赖前端隐藏。"""

    def __init__(self, repository: Any):
        self._repository = repository

    def paged_search(
        self,
        *,
        requester_role: str,
        page: int,
        page_size: int,
        level: str,
        created_at_from: str,
        created_at_to: str,
        target_user_id: int,
    ) -> AuditLogPage:
        if requester_role != "ADMIN":
            raise PermissionError("ADMIN role required")
        normalized_page, normalized_size = self._page(page, page_size)
        normalized_level = self._level(level)
        time_from = self._time(created_at_from, "created_at_from")
        time_to = self._time(created_at_to, "created_at_to")
        if time_from is not None and time_to is not None and time_from > time_to:
            raise ValueError("created_at_from must not be after created_at_to")
        user_id = self._user_id(target_user_id)
        items, total = self._repository.paged_search(
            page=normalized_page,
            page_size=normalized_size,
            level=normalized_level,
            created_at_from=time_from,
            created_at_to=time_to,
            target_user_id=user_id,
        )
        return AuditLogPage(items, total, normalized_page, normalized_size)

    @staticmethod
    def _page(page: int, page_size: int) -> tuple[int, int]:
        if page < 0:
            raise ValueError("page must be >= 0")
        if page_size < 0 or page_size > MAX_PAGE_SIZE:
            raise ValueError("page_size must be between 1 and 100")
        return page, page_size or DEFAULT_PAGE_SIZE

    @staticmethod
    def _level(level: str) -> str | None:
        normalized = (level or "").strip().upper()
        if not normalized:
            return None
        if normalized not in ALLOWED_LEVELS:
            raise ValueError("invalid level")
        return normalized

    @staticmethod
    def _time(value: str, field_name: str) -> datetime | None:
        text = (value or "").strip()
        if not text:
            return None
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError as exception:
            raise ValueError(f"invalid {field_name}") from exception
        if parsed.tzinfo is None:
            raise ValueError(f"invalid {field_name}")
        return parsed

    @staticmethod
    def _user_id(value: int) -> int | None:
        if value == 0:
            return None
        if value < 0:
            raise ValueError("target_user_id must be > 0")
        return value
