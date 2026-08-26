// 百工谱 — 岗位技能全局身份人工审核
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillAlias;
import com.baigon.occupation.entity.skill.SkillResolutionAction;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillAliasRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;

@Service
public class SkillResolutionReviewService {

    private final JobSkillResolutionTaskRepository taskRepository;
    private final JobSkillResolutionCandidateRepository candidateRepository;
    private final JobSkillRepository jobSkillRepository;
    private final JobRepository jobRepository;
    private final SkillRepository skillRepository;
    private final SkillAliasRepository aliasRepository;
    private final SkillRelationService relationService;
    private final SkillHierarchyService hierarchyService;
    private final SkillEmbeddingService embeddingService;
    private final LogService logService;
    private final Snowflake snowflake;

    public SkillResolutionReviewService(
            JobSkillResolutionTaskRepository taskRepository,
            JobSkillResolutionCandidateRepository candidateRepository,
            JobSkillRepository jobSkillRepository,
            JobRepository jobRepository,
            SkillRepository skillRepository,
            SkillAliasRepository aliasRepository,
            SkillRelationService relationService,
            SkillHierarchyService hierarchyService,
            SkillEmbeddingService embeddingService,
            LogService logService,
            Snowflake snowflake) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.jobSkillRepository = jobSkillRepository;
        this.jobRepository = jobRepository;
        this.skillRepository = skillRepository;
        this.aliasRepository = aliasRepository;
        this.relationService = relationService;
        this.hierarchyService = hierarchyService;
        this.embeddingService = embeddingService;
        this.logService = logService;
        this.snowflake = snowflake;
    }

    /** 三种人工动作最终都在一个事务内确定 skill_id、别名、聚合关系和审核状态。 */
    @Transactional
    public Optional<JobSkillResolutionTask> review(Long taskId,
                                                    SkillResolutionAction action,
                                                    Long skillId,
                                                    String newSkillName,
                                                    List<Long> parentSkillIds,
                                                    AuditContext audit) {
        Optional<JobSkillResolutionTask> optionalTask = taskRepository.findByIdForUpdate(taskId);
        if (optionalTask.isEmpty()) return Optional.empty();
        JobSkillResolutionTask task = optionalTask.get();
        if (task.getReviewStatus() != ReviewStatus.PENDING) {
            throw new ApiException(ApiException.ErrorCode.ALREADY_REVIEWED,
                    "skill resolution task already reviewed");
        }
        validateGenerationState(task, action);
        List<Long> normalizedParentSkillIds = normalizedParentSkillIds(action, parentSkillIds);

        // 固定锁顺序：解析任务 → 岗位技能 → 目标规范技能。
        JobSkill jobSkill = jobSkillRepository.findByIdForUpdate(task.getJobSkillId())
                .orElseThrow(() -> new IllegalStateException("job skill not found"));
        Job job = jobRepository.findByIdAndDeletedAtIsNull(jobSkill.getJobId())
                .orElseThrow(() -> new IllegalStateException("job not found"));
        OffsetDateTime now = OffsetDateTime.now();

        boolean created = action == SkillResolutionAction.CREATE_NEW;
        Skill selected = switch (action) {
            case SELECT_CANDIDATE -> selectCandidate(task, skillId, newSkillName);
            case SELECT_EXISTING -> selectExisting(task, skillId, newSkillName);
            case CREATE_NEW -> createNewSkill(skillId, newSkillName);
        };

        if (created) {
            // 新技能与父技能边同属本次审核事务，任一父技能无效会回滚全部写入。
            hierarchyService.addParents(selected.getId(), normalizedParentSkillIds);
        }

        ensureAlias(selected.getName(), selected.getId(), task, audit, now);
        ensureAlias(task.getSkillName(), selected.getId(), task, audit, now);

        if (jobSkill.getSkillId() != null && !jobSkill.getSkillId().equals(selected.getId())) {
            throw new ApiException(ApiException.ErrorCode.CONFLICT,
                    "job skill has been resolved to another skill");
        }
        jobSkill.setSkillId(selected.getId());
        jobSkill.setUpdatedAt(now);
        jobSkillRepository.save(jobSkill);
        relationService.link(job, selected.getId());

        task.setSelectedSkillId(selected.getId());
        task.setResolutionAction(action);
        task.setReviewStatus(ReviewStatus.PASSED);
        task.setReviewedAt(now);
        task.setReviewedBy(audit.userId());
        task.setUpdatedAt(now);
        taskRepository.save(task);

        // 新建规范技能不能复用待解析别名向量，必须提交后重新以 skills.name 向量化。
        if (created) {
            embeddingService.submitAfterCommit(selected.getId(), audit.withTraceId(task.getTraceId()));
        }
        logService.info(audit.withTraceId(task.getTraceId()),
                "skill resolution reviewed: task_id=" + taskId
                        + ", action=" + action + ", skill_id=" + selected.getId());
        return Optional.of(task);
    }

    private List<Long> normalizedParentSkillIds(SkillResolutionAction action,
                                                 List<Long> parentSkillIds) {
        TreeSet<Long> ids = new TreeSet<>();
        if (parentSkillIds != null) {
            for (Long parentSkillId : parentSkillIds) {
                if (parentSkillId == null || parentSkillId <= 0) {
                    throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                            "parent skill id must be > 0");
                }
                ids.add(parentSkillId);
            }
        }
        if (action != SkillResolutionAction.CREATE_NEW && !ids.isEmpty()) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "parent skill ids are only allowed for CREATE_NEW");
        }
        if (ids.size() > SkillHierarchyService.MAX_PARENT_SKILLS) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "CREATE_NEW supports at most 20 parent skills");
        }
        return List.copyOf(ids);
    }

    private void validateGenerationState(JobSkillResolutionTask task,
                                         SkillResolutionAction action) {
        if (action == null) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "resolution action is required");
        }
        SkillResolutionTaskStatus status = task.getTaskStatus();
        if (status == null || status == SkillResolutionTaskStatus.PENDING
                || status == SkillResolutionTaskStatus.RUNNING) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "skill candidates are still being generated");
        }
        if (action == SkillResolutionAction.SELECT_CANDIDATE
                && status != SkillResolutionTaskStatus.SUCCESS) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "candidate selection requires successful generation");
        }
    }

    private Skill selectCandidate(JobSkillResolutionTask task,
                                  Long skillId,
                                  String newSkillName) {
        validateExistingInput(skillId, newSkillName);
        if (!candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(
                task.getId(), skillId)) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "selected skill is not a candidate");
        }
        return activeSkillForUpdate(skillId);
    }

    private Skill selectExisting(JobSkillResolutionTask task,
                                 Long skillId,
                                 String newSkillName) {
        validateExistingInput(skillId, newSkillName);
        if (candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(
                task.getId(), skillId)) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "candidate skill must use SELECT_CANDIDATE");
        }
        return activeSkillForUpdate(skillId);
    }

    private Skill createNewSkill(Long skillId, String newSkillName) {
        if (skillId != null && skillId > 0) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "CREATE_NEW must not include skill_id");
        }
        String name = newSkillName == null ? "" : newSkillName.trim();
        if (name.isEmpty() || name.length() > 100) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "new skill name is invalid");
        }
        if (skillRepository.findActiveByNormalizedName(name).isPresent()
                || aliasRepository.findActiveByNormalizedAliasName(name).isPresent()) {
            throw new ApiException(ApiException.ErrorCode.CONFLICT,
                    "skill name already exists");
        }

        long newId = snowflake.nextId();
        if (skillRepository.insertPendingIfAbsent(newId, name) != 1) {
            throw new ApiException(ApiException.ErrorCode.CONFLICT,
                    "skill name was created concurrently");
        }
        return skillRepository.findByIdForUpdate(newId)
                .orElseThrow(() -> new IllegalStateException("new skill not found"));
    }

    private void validateExistingInput(Long skillId, String newSkillName) {
        if (skillId == null || skillId <= 0
                || (newSkillName != null && !newSkillName.isBlank())) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "existing skill selection parameters are invalid");
        }
    }

    private Skill activeSkillForUpdate(Long skillId) {
        return skillRepository.findByIdForUpdate(skillId)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND, "skill not found"));
    }

    /** 唯一索引负责并发裁决：同目标映射幂等，异目标映射冲突并回滚整次审核。 */
    private void ensureAlias(String aliasName,
                             long skillId,
                             JobSkillResolutionTask task,
                             AuditContext audit,
                             OffsetDateTime now) {
        int inserted = aliasRepository.insertIfAbsent(
                snowflake.nextId(), task.getTraceId(), skillId,
                aliasName.trim(), now, audit.userId());
        if (inserted == 1) return;
        SkillAlias existing = aliasRepository.findActiveByNormalizedAliasName(aliasName)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.CONFLICT, "skill alias creation conflicted"));
        if (!existing.getSkillId().equals(skillId)) {
            throw new ApiException(ApiException.ErrorCode.CONFLICT,
                    "skill alias already maps to another skill");
        }
    }
}
