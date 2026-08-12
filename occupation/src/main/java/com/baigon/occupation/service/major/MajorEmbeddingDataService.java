// 百工谱 — 专业名称向量化数据业务层
package com.baigon.occupation.service.major;

import com.baigon.occupation.entity.EmbeddingStatus;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MajorEmbeddingDataService implements EmbeddingDataService {

    private final MajorRepository repository;

    public MajorEmbeddingDataService(MajorRepository repository) {
        this.repository = repository;
    }

    @Override
    public EmbeddingResource resource() {
        return EmbeddingResource.MAJOR;
    }

    /** 启动时固定本轮候选快照，避免 FAILED 批次在同一轮被无限重复处理。 */
    @Override
    @Transactional(readOnly = true)
    public List<EmbeddingCandidate> findCandidates() {
        return repository.findByDeletedAtIsNullAndEmbeddingStatusNotOrderByIdAsc(EmbeddingStatus.SUCCESS)
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
                repository.countByDeletedAtIsNullAndEmbeddingStatus(EmbeddingStatus.SUCCESS),
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
