# 百工谱 — 数据库访问层（asyncpg 连接池）
# 背景：gRPC server 是同步 worker 线程（线程内无事件循环），而 asyncpg 必须在事件循环内使用。
# 方案：启动时开一个后台线程跑 run_forever() 的事件循环，所有数据库操作经
# run_coroutine_threadsafe 投递到该循环，避免每次新建循环导致连接池无法复用。

import asyncio
import logging
import threading

import asyncpg

from src.service.fetcher import JobRecord
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)

# job_sources 全列插入（clean_status 首写 PENDING）
_INSERT_SQL = """
INSERT INTO job_sources (
    id, trace_id, publish_date, source_platform, source_url,
    city, tags, major, nature, salary,
    job_name, company_name, company_size, province, education,
    experience, job_description, clean_status
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15,
    $16, $17, $18
)
ON CONFLICT ("trace_id") DO NOTHING
"""

# 清洗成功后更新 clean_status
_UPDATE_CLEAN_SUCCESS_SQL = (
    "UPDATE job_sources SET clean_status = 'SUCCESS' WHERE trace_id = $1"
)


class Database:
    """asyncpg 连接池 + 持久事件循环线程"""

    def __init__(self, dsn: str, min_size: int = 1, max_size: int = 5):
        self._dsn = dsn
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, name="db-event-loop", daemon=True)
        self._thread.start()
        # 启动时创建连接池（失败抛异常 → main 中决定是否继续启动）
        self._pool: asyncpg.Pool = asyncio.run_coroutine_threadsafe(
            self._create_pool(min_size, max_size), self._loop
        ).result(timeout=10)
        logger.info("数据库连接池已就绪 (%s)", dsn)

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    async def _create_pool(self, min_size: int, max_size: int) -> asyncpg.Pool:
        return await asyncpg.create_pool(
            dsn=self._dsn, min_size=min_size, max_size=max_size
        )

    # ---- 同步门面（gRPC worker 线程直接调用） ----

    def insert_job_sources(self, rows: list[JobRecord], trace_id: int) -> int:
        """插入原始数据（clean_status='PENDING'），返回成功插入行数"""
        return asyncio.run_coroutine_threadsafe(
            self._insert(rows, trace_id), self._loop
        ).result(timeout=30)

    def mark_clean_success(self, trace_id: int) -> None:
        """清洗成功：clean_status PENDING → SUCCESS"""
        asyncio.run_coroutine_threadsafe(
            self._update_clean_status(trace_id), self._loop
        ).result(timeout=30)

    def close(self) -> None:
        """关闭连接池并停止事件循环线程"""
        try:
            asyncio.run_coroutine_threadsafe(
                self._shutdown(), self._loop
            ).result(timeout=10)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=5)
        logger.info("数据库连接池已关闭")

    # ---- 内部协程 ----

    async def _insert(self, rows: list[JobRecord], trace_id: int) -> int:
        # 组装元组（与 _INSERT_SQL 占位符顺序一致）
        params = [
            (
                snowflake.next_id(),  # id（雪花 ID）
                trace_id,
                r.publish_date,
                r.source_platform,
                r.source_url,
                r.city,
                r.tags,
                r.major,
                r.nature,
                r.salary,
                r.job_name,
                r.company_name,
                r.company_size,
                r.province,
                r.education,
                r.experience,
                r.job_description,
                "PENDING",  # clean_status
            )
            for r in rows
        ]
        async with self._pool.acquire() as conn:
            # executemany 无法返回每行影响数，改用逐条执行并累加
            inserted = 0
            for p in params:
                result = await conn.execute(_INSERT_SQL, *p)
                # "INSERT 0 1" 成功 / "INSERT 0 0" 冲突跳过
                if result.endswith(" 1"):
                    inserted += 1
        logger.info("job_sources 插入 %d 条（trace_id=%d）", inserted, trace_id)
        return inserted

    async def _update_clean_status(self, trace_id: int) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_UPDATE_CLEAN_SUCCESS_SQL, trace_id)
        logger.info("job_sources 清洗状态已置 SUCCESS（trace_id=%d）", trace_id)

    async def _shutdown(self) -> None:
        await self._pool.close()
