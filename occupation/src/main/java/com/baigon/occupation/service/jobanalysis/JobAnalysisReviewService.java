// 百工谱 — 岗位职业与技能分析人工审核服务
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobMajorAlias;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobMajorAliasRepository;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.job.JobMajorPolicy;
import com.baigon.occupation.service.skill.JobSkillIdentityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class JobAnalysisReviewService {

    private static final Set<String> PROFICIENCIES =
            Set.of("EXPERT", "ADVANCED", "FAMILIAR", "BASIC");

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisResultRepository resultRepository;
    private final JobRepository jobRepository;
    private final JobSkillIdentityService jobSkillIdentityService;
    private final JobOccupationAliasRepository occupationAliasRepository;
    private final JobMajorAliasRepository majorAliasRepository;
    private final OccupationRepository occupationRepository;
    private final MajorRepository majorRepository;
    private final LogService logService;
    private final Snowflake snowflake;

    public JobAnalysisReviewService(JobAnalysisTaskRepository taskRepository,
                                    JobAnalysisResultRepository resultRepository,
                                    JobRepository jobRepository,
                                    JobSkillIdentityService jobSkillIdentityService,
                                    JobOccupationAliasRepository occupationAliasRepository,
                                    JobMajorAliasRepository majorAliasRepository,
                                    OccupationRepository occupationRepository,
                                    MajorRepository majorRepository,
                                    LogService logService,
                                    Snowflake snowflake) {
        this.taskRepository = taskRepository;
        this.resultRepository = resultRepository;
        this.jobRepository = jobRepository;
        this.jobSkillIdentityService = jobSkillIdentityService;
        this.occupationAliasRepository = occupationAliasRepository;
        this.majorAliasRepository = majorAliasRepository;
        this.occupationRepository = occupationRepository;
        this.majorRepository = majorRepository;
        this.logService = logService;
        this.snowflake = snowflake;
    }

    /**
     * 一次事务完成专业、职业确认和全部技能审核；可混合通过、修改后通过与拒绝。
     * AI 原始字段保持不变，只有通过后的最终技能写入 job_skills。
     */
    @Transactional
    public Optional<ReviewResult> review(Long taskId,
                                         Long majorId,
                                         Long occupationId,
                                         List<SkillReviewDecision> decisions,
                                         AuditContext audit) {
        Optional<JobAnalysisTask> optionalTask = taskRepository.findByIdForReview(taskId);
        if (optionalTask.isEmpty()) return Optional.empty();
        JobAnalysisTask task = optionalTask.get();
        if (task.getReviewStatus() != ReviewStatus.PENDING) {
            throw new ApiException(
                    ApiException.ErrorCode.JOB_ANALYSIS_ALREADY_REVIEWED,
                    "job analysis task already reviewed");
        }
        if (task.getTaskStatus() != TaskStatus.SUCCESS) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "job analysis task is not complete");
        }

        Major major = majorRepository.findByIdAndDeletedAtIsNull(majorId)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND,
                        "major not found"));
        Occupation occupation = occupationRepository.findByIdAndDeletedAtIsNull(occupationId)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND,
                        "occupation not found"));
        Job job = jobRepository.findByIdForUpdate(task.getJobId())
                .orElseThrow(() -> new IllegalStateException("job not found"));
        List<JobAnalysisResult> results =
                resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(taskId);
        Map<Long, SkillReviewDecision> decisionsById = validateDecisions(results, decisions);

        OffsetDateTime now = OffsetDateTime.now();
        job.setMajorId(major.getId());
        job.setOccupationId(occupation.getId());
        job.setUpdatedAt(now);
        jobRepository.save(job);

        JobOccupationAlias occupationAlias =
                updateOccupationAlias(job, task, occupation, audit, now);
        JobMajorAlias majorAlias = updateMajorAlias(job, task, major, audit, now);
        int approvedSkills = reviewSkills(
                results, decisionsById, job, task, audit, now);

        task.setSelectedMajorId(major.getId());
        task.setSelectedOccupationId(occupation.getId());
        task.setReviewStatus(ReviewStatus.PASSED);
        task.setReviewedAt(now);
        task.setReviewedBy(audit.userId());
        task.setUpdatedAt(now);
        taskRepository.save(task);
        logService.info(audit, "job analysis reviewed: task_id=" + taskId
                + ", major_id=" + majorId + ", occupation_id=" + occupationId
                + ", approved_skills=" + approvedSkills);
        return Optional.of(new ReviewResult(
                task, job, major, occupation, majorAlias, occupationAlias, results));
    }

    /** 必须一次覆盖任务的全部结果，避免半审核状态和部分写入 job_skills。 */
    private Map<Long, SkillReviewDecision> validateDecisions(
            List<JobAnalysisResult> results,
            List<SkillReviewDecision> decisions) {
        List<SkillReviewDecision> submitted = decisions == null ? List.of() : decisions;
        if (submitted.size() != results.size()) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "skill reviews must cover all analysis results");
        }

        Map<Long, SkillReviewDecision> byId = new HashMap<>();
        for (SkillReviewDecision decision : submitted) {
            if (decision == null || decision.resultId() == null || decision.resultId() <= 0
                    || decision.action() == null) {
                throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                        "invalid skill review decision");
            }
            if (byId.put(decision.resultId(), decision) != null) {
                throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                        "duplicate analysis result id");
            }
        }
        for (JobAnalysisResult result : results) {
            if (result.getReviewStatus() != ReviewStatus.PENDING
                    || !byId.containsKey(result.getId())) {
                throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                        "skill reviews do not match analysis results");
            }
        }
        return byId;
    }

    private int reviewSkills(List<JobAnalysisResult> results,
                             Map<Long, SkillReviewDecision> decisions,
                             Job job,
                             JobAnalysisTask task,
                             AuditContext audit,
                             OffsetDateTime now) {
        int approved = 0;
        for (JobAnalysisResult result : results) {
            SkillReviewDecision decision = decisions.get(result.getId());
            result.setReviewAction(decision.action());
            result.setReviewedAt(now);
            result.setReviewedBy(audit.userId());
            result.setUpdatedAt(now);

            switch (decision.action()) {
                case APPROVE -> {
                    result.setReviewStatus(ReviewStatus.PASSED);
                    saveJobSkill(job, task, result, result.getSkillName(),
                            normalizedProficiency(result.getSkillProficiency()),
                            result.getEvidence(), audit, now);
                    approved++;
                }
                case APPROVE_WITH_EDIT -> {
                    String proficiency = validateEditedSkill(decision);
                    String name = decision.skillName().trim();
                    String evidence = decision.evidence().trim();
                    result.setReviewStatus(ReviewStatus.PASSED);
                    result.setReviewedSkillName(name);
                    result.setReviewedSkillProficiency(proficiency);
                    result.setReviewedEvidence(evidence);
                    saveJobSkill(job, task, result, name, proficiency, evidence, audit, now);
                    approved++;
                }
                case REJECT -> result.setReviewStatus(ReviewStatus.REJECTED);
            }
            resultRepository.save(result);
        }
        return approved;
    }

    private void saveJobSkill(Job job,
                              JobAnalysisTask task,
                              JobAnalysisResult result,
                              String name,
                              String proficiency,
                              String evidence,
                              AuditContext audit,
                              OffsetDateTime now) {
        JobSkill skill = new JobSkill();
        skill.setId(snowflake.nextId());
        skill.setAnalysisResultId(result.getId());
        skill.setJobId(result.getJobId());
        skill.setSkillName(name);
        skill.setSkillProficiency(proficiency);
        skill.setEvidence(evidence);
        skill.setCreatedAt(now);
        skill.setUpdatedAt(now);
        jobSkillIdentityService.saveAndResolve(
                job, skill, task.getTraceId(), audit, now);
    }

    private String validateEditedSkill(SkillReviewDecision decision) {
        if (decision.skillName() == null || decision.skillName().isBlank()
                || decision.skillName().trim().length() > 100) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "edited skill name is invalid");
        }
        String proficiency = normalizedProficiency(decision.skillProficiency());
        if (!PROFICIENCIES.contains(proficiency)) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "edited skill proficiency is invalid");
        }
        if (decision.evidence() == null || decision.evidence().isBlank()) {
            throw new ApiException(ApiException.ErrorCode.BAD_REQUEST,
                    "edited skill evidence is empty");
        }
        return proficiency;
    }

    /** 审核输入在领域边界统一为数据库采用的全大写熟练度。 */
    private String normalizedProficiency(String value) {
        return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
    }

    private JobOccupationAlias updateOccupationAlias(Job job,
                                                     JobAnalysisTask task,
                                                     Occupation occupation,
                                                     AuditContext audit,
                                                     OffsetDateTime now) {
        if (job.getName() == null || job.getName().isBlank()) {
            return null;
        }
        JobOccupationAlias alias = occupationAliasRepository
                .findActiveByNormalizedJobNameForUpdate(job.getName())
                .orElseGet(() -> newOccupationAlias(job, task, audit, now));
        // 已存在映射时以本次人工审核结论更新，并记录本次关键 trace_id。
        alias.setTraceId(task.getTraceId());
        alias.setOccupationId(occupation.getId());
        alias.setOccupationName(occupation.getName());
        alias.setReviewedAt(now);
        alias.setReviewedBy(audit.userId());
        alias.setUpdatedAt(now);
        occupationAliasRepository.save(alias);
        return alias;
    }

    private JobOccupationAlias newOccupationAlias(Job job,
                                                  JobAnalysisTask task,
                                                  AuditContext audit,
                                                  OffsetDateTime now) {
        JobOccupationAlias alias = new JobOccupationAlias();
        alias.setId(snowflake.nextId());
        alias.setTraceId(task.getTraceId());
        alias.setJobName(job.getName());
        alias.setReviewedBy(audit.userId());
        alias.setReviewedAt(now);
        alias.setCreatedAt(now);
        alias.setUpdatedAt(now);
        return alias;
    }

    /** “专业不限”等兜底文本不沉淀为全局别名，其余映射以本次人工审核为准。 */
    private JobMajorAlias updateMajorAlias(Job job,
                                           JobAnalysisTask task,
                                           Major major,
                                           AuditContext audit,
                                           OffsetDateTime now) {
        if (JobMajorPolicy.shouldUseOther(job.getMajor())) {
            return null;
        }
        JobMajorAlias alias = majorAliasRepository
                .findActiveByNormalizedJobMajorForUpdate(job.getMajor())
                .orElseGet(() -> newMajorAlias(job, task, audit, now));
        alias.setTraceId(task.getTraceId());
        alias.setMajorId(major.getId());
        alias.setMajorName(major.getName());
        alias.setReviewedAt(now);
        alias.setReviewedBy(audit.userId());
        alias.setUpdatedAt(now);
        majorAliasRepository.save(alias);
        return alias;
    }

    private JobMajorAlias newMajorAlias(Job job,
                                        JobAnalysisTask task,
                                        AuditContext audit,
                                        OffsetDateTime now) {
        JobMajorAlias alias = new JobMajorAlias();
        alias.setId(snowflake.nextId());
        alias.setTraceId(task.getTraceId());
        alias.setJobMajor(job.getMajor());
        alias.setReviewedBy(audit.userId());
        alias.setReviewedAt(now);
        alias.setCreatedAt(now);
        alias.setUpdatedAt(now);
        return alias;
    }

    public record SkillReviewDecision(Long resultId,
                                      JobAnalysisReviewAction action,
                                      String skillName,
                                      String skillProficiency,
                                      String evidence) {
    }

    public record ReviewResult(JobAnalysisTask task,
                               Job job,
                               Major major,
                               Occupation occupation,
                               JobMajorAlias majorAlias,
                               JobOccupationAlias occupationAlias,
                               List<JobAnalysisResult> analysisResults) {
    }
}
