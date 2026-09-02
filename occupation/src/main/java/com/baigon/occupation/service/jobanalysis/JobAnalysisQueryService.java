// 百工谱 — 岗位分析任务与子资源查询服务
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisMajorCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

@Service
@Transactional(readOnly = true)
public class JobAnalysisQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_LOOKUP_IDS = 200;

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisCandidateRepository candidateRepository;
    private final JobAnalysisMajorCandidateRepository majorCandidateRepository;
    private final JobAnalysisResultRepository resultRepository;

    public JobAnalysisQueryService(JobAnalysisTaskRepository taskRepository,
                                   JobAnalysisCandidateRepository candidateRepository,
                                   JobAnalysisMajorCandidateRepository majorCandidateRepository,
                                   JobAnalysisResultRepository resultRepository) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.majorCandidateRepository = majorCandidateRepository;
        this.resultRepository = resultRepository;
    }

    /** 任务生成状态与审核状态可独立组合筛选，不传 nullable enum 参数。 */
    public Page<JobAnalysisTask> list(int page,
                                      int pageSize,
                                      String taskStatus,
                                      String reviewStatus) {
        TaskStatus parsedTaskStatus = parseTaskStatus(taskStatus);
        ReviewStatus parsedReviewStatus = parseReviewStatus(reviewStatus);
        PageRequest pageable = pageable(page, pageSize);
        if (parsedTaskStatus != null && parsedReviewStatus != null) {
            return taskRepository.findByTaskStatusAndReviewStatusAndDeletedAtIsNull(
                    parsedTaskStatus, parsedReviewStatus, pageable);
        }
        if (parsedTaskStatus != null) {
            return taskRepository.findByTaskStatusAndDeletedAtIsNull(parsedTaskStatus, pageable);
        }
        if (parsedReviewStatus != null) {
            return taskRepository.findByReviewStatusAndDeletedAtIsNull(parsedReviewStatus, pageable);
        }
        return taskRepository.findByDeletedAtIsNull(pageable);
    }

    /** 任务详情只带任务本体与三类子资源 ID。 */
    public Optional<JobAnalysisDetail> detail(Long id) {
        long taskId = positiveId(id);
        return taskRepository.findByIdAndDeletedAtIsNull(taskId).map(task ->
                new JobAnalysisDetail(
                        task,
                        ids(candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(taskId)),
                        ids(majorCandidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(taskId)),
                        ids(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(taskId))));
    }

    public Lookup<JobAnalysisTask> lookupTasks(Collection<Long> ids) {
        return lookup(ids, taskRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobAnalysisTask::getId);
    }

    public Optional<JobAnalysisCandidate> getOccupationCandidate(Long id) {
        return candidateRepository.findByIdAndDeletedAtIsNull(positiveId(id));
    }

    public Lookup<JobAnalysisCandidate> lookupOccupationCandidates(Collection<Long> ids) {
        return lookup(ids, candidateRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobAnalysisCandidate::getId);
    }

    public Optional<JobAnalysisMajorCandidate> getMajorCandidate(Long id) {
        return majorCandidateRepository.findByIdAndDeletedAtIsNull(positiveId(id));
    }

    public Lookup<JobAnalysisMajorCandidate> lookupMajorCandidates(Collection<Long> ids) {
        return lookup(ids, majorCandidateRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobAnalysisMajorCandidate::getId);
    }

    public Optional<JobAnalysisResult> getResult(Long id) {
        return resultRepository.findByIdAndDeletedAtIsNull(positiveId(id));
    }

    public Lookup<JobAnalysisResult> lookupResults(Collection<Long> ids) {
        return lookup(ids, resultRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobAnalysisResult::getId);
    }

    private <T> Lookup<T> lookup(Collection<Long> values,
                                 Function<Collection<Long>, List<T>> loader,
                                 Function<T, Long> idExtractor) {
        LinkedHashSet<Long> requestedIds = normalizedIds(values);
        Map<Long, T> loadedById = new LinkedHashMap<>();
        loader.apply(requestedIds).forEach(item -> loadedById.put(idExtractor.apply(item), item));
        List<T> items = requestedIds.stream()
                .map(loadedById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<Long> missingIds = requestedIds.stream()
                .filter(id -> !loadedById.containsKey(id))
                .toList();
        return new Lookup<>(List.copyOf(items), List.copyOf(missingIds));
    }

    private LinkedHashSet<Long> normalizedIds(Collection<Long> values) {
        if (values == null || values.isEmpty() || values.size() > MAX_LOOKUP_IDS) {
            throw new IllegalArgumentException("ids must contain between 1 and 200 ids");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Long value : values) ids.add(positiveId(value));
        return ids;
    }

    private List<Long> ids(List<? extends BaseEntity> items) {
        return items.stream().map(BaseEntity::getId).toList();
    }

    private long positiveId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return value;
    }

    private PageRequest pageable(int page, int pageSize) {
        if (page < 0) throw new IllegalArgumentException("page must be >= 0");
        int size = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }

    private TaskStatus parseTaskStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return TaskStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "task_status must be PENDING, SUCCESS or FAILED");
        }
    }

    private ReviewStatus parseReviewStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ReviewStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "review_status must be PENDING, PASSED or REJECTED");
        }
    }

    public record JobAnalysisDetail(JobAnalysisTask task,
                                    List<Long> candidateIds,
                                    List<Long> majorCandidateIds,
                                    List<Long> resultIds) {
    }

    public record Lookup<T>(List<T> items, List<Long> missingIds) {
    }
}
