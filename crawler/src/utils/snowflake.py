# 百工谱 — Snowflake ID 生成器（标准雪花算法）
# 64 位：1bit 符号 + 41bit 毫秒时间戳 + 10bit 机器ID + 12bit 序列号
# 用途：主键 / trace_id 生成（数据库列为 bigint）
# worker id 从环境变量 SNOWFLAKE_WORKER_ID 读取（未设置时默认 0）

import os
import threading
import time

# 位段划分
WORKER_ID_BITS = 10
SEQUENCE_BITS = 12
MAX_WORKER_ID = (1 << WORKER_ID_BITS) - 1
SEQUENCE_MASK = (1 << SEQUENCE_BITS) - 1
WORKER_ID_SHIFT = SEQUENCE_BITS
TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS

# 自定义纪元：2024-01-01 00:00:00 UTC，保证 ID 更短
EPOCH = 1704067200000


class SnowflakeIdGenerator:
    """雪花 ID 生成器（线程安全）"""

    def __init__(self, worker_id: int | None = None):
        if worker_id is None:
            worker_id = int(os.getenv("SNOWFLAKE_WORKER_ID", "0"))
        if worker_id < 0 or worker_id > MAX_WORKER_ID:
            worker_id = 0
        self._worker_id = worker_id
        self._sequence = 0
        self._last_ms = -1
        self._lock = threading.Lock()

    def next_id(self) -> int:
        """生成下一个雪花 ID（单机每毫秒最多 4096 个）"""
        with self._lock:
            ms = int(time.time() * 1000)

            # 时钟回拨：退让等待，避免 ID 重复
            if ms < self._last_ms:
                ms = self._last_ms

            if ms == self._last_ms:
                self._sequence = (self._sequence + 1) & SEQUENCE_MASK
                # 同毫秒序列号耗尽，等下一毫秒
                if self._sequence == 0:
                    while ms <= self._last_ms:
                        time.sleep(0.0001)
                        ms = int(time.time() * 1000)
            else:
                self._sequence = 0

            self._last_ms = ms
            return (
                ((ms - EPOCH) << TIMESTAMP_SHIFT)
                | (self._worker_id << WORKER_ID_SHIFT)
                | self._sequence
            )


# 全局单例
snowflake = SnowflakeIdGenerator()
