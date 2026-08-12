// 百工谱 — 单一业务域的向量化数据操作契约
package com.baigon.occupation.service;

import java.util.List;

/** 专业域和职业域各自实现，后台任务协调器只依赖此跨域契约。 */
public interface EmbeddingDataService {

    EmbeddingResource resource();

    List<EmbeddingCandidate> findCandidates();

    void markAttemptStarted(List<Long> ids);

    void markSuccess(List<EmbeddingCandidate> batch, List<List<Float>> vectors);

    void markFailed(List<Long> ids, String error);

    Progress getProgress();

    record EmbeddingCandidate(long id, String name) {
    }

    record Progress(long embedded, long total) {
    }
}
