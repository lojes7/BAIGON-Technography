// 百工谱 — 全局规范技能与岗位技能解析任务查询服务
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillCandidateProjection;
import com.baigon.occupation.repository.skill.SkillRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SkillResolutionQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int SIMILAR_SKILL_LIMIT = 5;

    private final SkillRepository skillRepository;
    private final JobSkillResolutionTaskRepository taskRepository;
    private final JobSkillResolutionCandidateRepository candidateRepository;
    private final JobSkillRepository jobSkillRepository;

    public SkillResolutionQueryService(
            SkillRepository skillRepository,
            JobSkillResolutionTaskRepository taskRepository,
            JobSkillResolutionCandidateRepository candidateRepository,
            JobSkillRepository jobSkillRepository) {
        this.skillRepository = skillRepository;
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.jobSkillRepository = jobSkillRepository;
    }

    /** 规范技能按名称、主键稳定排序，供候选外人工选择已有技能。 */
    public Page<Skill> listSkills(int page, int pageSize, String keyword) {
        PageRequest pageable = pageable(page, pageSize,
                Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")));
        return skillRepository.search(keyword == null ? "" : keyword.trim(), pageable);
    }

    /** 候选生成状态和人工审核状态均可独立筛选。 */
    public Page<ResolutionTaskListItem> listTasks(int page,
                                                  int pageSize,
                                                  String taskStatus,
                                                  String reviewStatus) {
        SkillResolutionTaskStatus parsedTaskStatus = parseTaskStatus(taskStatus);
        ReviewStatus parsedReviewStatus = parseReviewStatus(reviewStatus);
        PageRequest pageable = pageable(page, pageSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<JobSkillResolutionTask> tasks = findTasks(
                parsedTaskStatus, parsedReviewStatus, pageable);

        // 批量读取岗位技能，避免任务列表逐条查询 job_id。
        Map<Long, JobSkill> jobSkills = jobSkillRepository.findAllById(
                        tasks.getContent().stream()
                                .map(JobSkillResolutionTask::getJobSkillId)
                                .toList())
                .stream()
                .filter(skill -> skill.getDeletedAt() == null)
                .collect(Collectors.toMap(JobSkill::getId, Function.identity()));
        return tasks.map(task -> {
            JobSkill jobSkill = jobSkills.get(task.getJobSkillId());
            if (jobSkill == null) {
                throw new IllegalStateException(
                        "job skill not found for resolution task: " + task.getId());
            }
            return new ResolutionTaskListItem(task, jobSkill.getJobId());
        });
    }

    /**
     * 按实际存在的筛选条件选择查询，避免 PostgreSQL 无法推断空枚举参数的类型。
     */
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

    /** 详情同时返回岗位技能事实与按相似度排名保存的候选快照。 */
    public Optional<Detail> getDetail(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return taskRepository.findByIdAndDeletedAtIsNull(id).map(task -> {
            JobSkill jobSkill = jobSkillRepository
                    .findByIdAndDeletedAtIsNull(task.getJobSkillId())
                    .orElseThrow(() -> new IllegalStateException(
                            "job skill not found for resolution task: " + task.getId()));
            List<JobSkillResolutionCandidate> candidates = candidateRepository
                    .findByTaskIdAndDeletedAtIsNullOrderByRankAsc(task.getId());
            return new Detail(task, jobSkill, candidates);
        });
    }

    /** 打开“选择现有技能”后，仅返回待审技能向量对应的 Top 5 规范技能。 */
    public Optional<List<SkillCandidateProjection>> listSimilarSkills(Long taskId) {
        if (taskId == null || taskId <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        if (taskRepository.findByIdAndDeletedAtIsNull(taskId).isEmpty()) {
            return Optional.empty();
        }
        Optional<String> vector = taskRepository.findSkillNameVectorLiteralById(taskId);
        if (vector.isEmpty()) {
            // AI 失败或尚未生成向量时仍允许使用下方普通技能分页列表。
            return Optional.of(List.of());
        }
        return Optional.of(skillRepository.findNearestByNameVector(
                vector.get(), SIMILAR_SKILL_LIMIT));
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

    public record ResolutionTaskListItem(JobSkillResolutionTask task, Long jobId) {
    }

    public record Detail(JobSkillResolutionTask task,
                         JobSkill jobSkill,
                         List<JobSkillResolutionCandidate> candidates) {
    }
}
