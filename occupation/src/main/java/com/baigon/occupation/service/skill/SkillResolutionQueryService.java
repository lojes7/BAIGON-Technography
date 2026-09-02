// 百工谱 — 全局规范技能与岗位技能解析任务查询服务
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillCandidateProjection;
import com.baigon.occupation.repository.skill.SkillRepository;
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
public class SkillResolutionQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_LOOKUP_IDS = 200;
    private static final int SIMILAR_SKILL_LIMIT = 5;

    private final SkillRepository skillRepository;
    private final JobSkillResolutionTaskRepository taskRepository;
    private final JobSkillResolutionCandidateRepository candidateRepository;

    public SkillResolutionQueryService(
            SkillRepository skillRepository,
            JobSkillResolutionTaskRepository taskRepository,
            JobSkillResolutionCandidateRepository candidateRepository) {
        this.skillRepository = skillRepository;
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
    }

    /** 规范技能按名称、主键稳定排序，供候选外人工选择已有技能。 */
    public Page<Skill> listSkills(int page, int pageSize, String keyword) {
        PageRequest pageable = pageable(page, pageSize,
                Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")));
        return skillRepository.search(keyword == null ? "" : keyword.trim(), pageable);
    }

    /** 任务列表只读任务 ID 页，不再为复制岗位技能正文做聚合查询。 */
    public Page<JobSkillResolutionTask> listTasks(int page,
                                                  int pageSize,
                                                  String taskStatus,
                                                  String reviewStatus) {
        SkillResolutionTaskStatus parsedTaskStatus = parseTaskStatus(taskStatus);
        ReviewStatus parsedReviewStatus = parseReviewStatus(reviewStatus);
        PageRequest pageable = pageable(page, pageSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return findTasks(parsedTaskStatus, parsedReviewStatus, pageable);
    }

    /** 详情只返回任务本体与持久化候选 ID。 */
    public Optional<Detail> getDetail(Long id) {
        long taskId = positiveId(id);
        return taskRepository.findByIdAndDeletedAtIsNull(taskId).map(task ->
                new Detail(task, candidateRepository
                        .findByTaskIdAndDeletedAtIsNullOrderByRankAsc(taskId)
                        .stream().map(JobSkillResolutionCandidate::getId).toList()));
    }

    public Lookup<JobSkillResolutionTask> lookupTasks(Collection<Long> ids) {
        return lookup(ids, taskRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobSkillResolutionTask::getId);
    }

    public Optional<JobSkillResolutionCandidate> getCandidate(Long id) {
        return candidateRepository.findByIdAndDeletedAtIsNull(positiveId(id));
    }

    public Lookup<JobSkillResolutionCandidate> lookupCandidates(Collection<Long> ids) {
        return lookup(ids, candidateRepository::findByIdInAndDeletedAtIsNullOrderByIdAsc,
                JobSkillResolutionCandidate::getId);
    }

    /** 打开“选择现有技能”后，仅返回待审技能向量对应的 Top 5 规范技能。 */
    public Optional<List<SkillCandidateProjection>> listSimilarSkills(Long taskId) {
        long id = positiveId(taskId);
        if (taskRepository.findByIdAndDeletedAtIsNull(id).isEmpty()) {
            return Optional.empty();
        }
        Optional<String> vector = taskRepository.findSkillNameVectorLiteralById(id);
        if (vector.isEmpty()) {
            // AI 失败或尚未生成向量时仍允许使用普通技能分页列表。
            return Optional.of(List.of());
        }
        return Optional.of(skillRepository.findNearestByNameVector(
                vector.get(), SIMILAR_SKILL_LIMIT));
    }

    private Page<JobSkillResolutionTask> findTasks(SkillResolutionTaskStatus taskStatus,
                                                    ReviewStatus reviewStatus,
                                                    PageRequest pageable) {
        if (taskStatus != null && reviewStatus != null) {
            return taskRepository.findByTaskStatusAndReviewStatusAndDeletedAtIsNull(
                    taskStatus, reviewStatus, pageable);
        }
        if (taskStatus != null) {
            return taskRepository.findByTaskStatusAndDeletedAtIsNull(taskStatus, pageable);
        }
        if (reviewStatus != null) {
            return taskRepository.findByReviewStatusAndDeletedAtIsNull(reviewStatus, pageable);
        }
        return taskRepository.findByDeletedAtIsNull(pageable);
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

    private long positiveId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return value;
    }

    private PageRequest pageable(int page, int pageSize, Sort sort) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        int size = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return PageRequest.of(page, size, sort);
    }

    private SkillResolutionTaskStatus parseTaskStatus(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return SkillResolutionTaskStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "task_status must be PENDING, RUNNING, SUCCESS or FAILED");
        }
    }

    private ReviewStatus parseReviewStatus(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            ReviewStatus status = ReviewStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
            if (status == ReviewStatus.PENDING || status == ReviewStatus.PASSED) {
                return status;
            }
        } catch (IllegalArgumentException ignored) {
            // 统一由下方错误提示描述此接口允许的状态。
        }
        throw new IllegalArgumentException("review_status must be PENDING or PASSED");
    }

    public record Detail(JobSkillResolutionTask task, List<Long> candidateIds) {
    }

    public record Lookup<T>(List<T> items, List<Long> missingIds) {
    }
}
