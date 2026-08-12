// 百工谱 — 进程内向量化任务状态快照
package com.baigon.occupation.service;

import java.time.OffsetDateTime;

public record EmbeddingTaskSnapshot(
        String status,
        String traceId,
        long total,
        long processed,
        long succeeded,
        long failed,
        String message,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt
) {
}
