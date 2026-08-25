// 百工谱 — 规范技能名称批量向量化数据业务层
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingTaskManager.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SkillEmbeddingDataService implements EmbeddingDataService {

    private final SkillRepository repository;

    public SkillEmbeddingDataService(SkillRepository repository) {
        this.repository = repository;
    }

    @Override
    public Resource resource() {
        return Resource.SKILL;
    }

    /** 启动时固定未成功记录，失败批次留待下一次人工启动重试。 */
    @Override
    @Transactional(readOnly = true)
    public List<EmbeddingCandidate> findCandidates() {
        return repository.findByDeletedAtIsNullAndEmbeddingStatusNotOrderByIdAsc(TaskStatus.SUCCESS)
                .stream()
                .map(item -> new EmbeddingCandidate(item.getId(), item.getName()))
                .toList();
    }

    @Override
    @Transactional
    public void markAttemptStarted(List<Long> ids) {
        repository.markAttemptStarted(ids);
    }

    @Override
    @Transactional
    public void markSuccess(List<EmbeddingCandidate> batch, List<List<Float>> vectors) {
        validateCount(batch, vectors);
        for (int index = 0; index < batch.size(); index++) {
            long id = batch.get(index).id();
            if (repository.markSuccess(id, vectorLiteral(vectors.get(index))) != 1) {
                throw new IllegalStateException("embedding target disappeared: " + id);
            }
        }
    }

    @Override
    @Transactional
    public void markFailed(List<Long> ids, String error) {
        repository.markFailed(ids, truncate(error));
    }

    @Override
    @Transactional(readOnly = true)
    public Progress getProgress() {
        return new Progress(
                repository.countByDeletedAtIsNullAndEmbeddingStatus(TaskStatus.SUCCESS),
                repository.countByDeletedAtIsNull());
    }

    private void validateCount(List<EmbeddingCandidate> batch, List<List<Float>> vectors) {
        if (batch.size() != vectors.size()) {
            throw new IllegalArgumentException("embedding count does not match input count");
        }
    }

    private String vectorLiteral(List<Float> vector) {
        StringBuilder builder = new StringBuilder(vector.size() * 12).append('[');
        for (int index = 0; index < vector.size(); index++) {
            if (index > 0) {
                builder.append(',');
            }
            builder.append(vector.get(index));
        }
        return builder.append(']').toString();
    }

    private String truncate(String error) {
        String safe = error == null || error.isBlank() ? "unknown embedding error" : error;
        return safe.length() <= 2000 ? safe : safe.substring(0, 2000);
    }
}
