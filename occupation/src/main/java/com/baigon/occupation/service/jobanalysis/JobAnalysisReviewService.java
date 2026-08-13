// 百工谱 — 岗位分析人工审核服务
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class JobAnalysisReviewService {

    private final JobAnalysisTaskRepository taskRepository;
    private final JobRepository jobRepository;
    private final JobOccupationAliasRepository aliasRepository;
    private final OccupationRepository occupationRepository;
    private final LogService logService;
    private final Snowflake snowflake;

    public JobAnalysisReviewService(JobAnalysisTaskRepository taskRepository,
                                    JobRepository jobRepository,
                                    JobOccupationAliasRepository aliasRepository,
                                    OccupationRepository occupationRepository,
                                    LogService logService,
                                    Snowflake snowflake) {
        this.taskRepository = taskRepository;
        this.jobRepository = jobRepository;
        this.aliasRepository = aliasRepository;
        this.occupationRepository = occupationRepository;
        this.logService = logService;
        this.snowflake = snowflake;
    }

    /** 最终职业可来自 occupations 任意有效记录，不要求出现在 AI 候选中。 */
    @Transactional
    public Optional<ReviewResult> review(Long taskId, Long occupationId, AuditContext audit) {
        Optional<JobAnalysisTask> optionalTask = taskRepository.findByIdForReview(taskId);
        if (optionalTask.isEmpty()) return Optional.empty();
        JobAnalysisTask task = optionalTask.get();
        if (task.getReviewStatus() != ReviewStatus.PENDING) {
            throw new ApiException(
                    ApiException.ErrorCode.JOB_ANALYSIS_ALREADY_REVIEWED,
                    "job analysis task already reviewed");
        }
        Occupation occupation = occupationRepository.findByIdAndDeletedAtIsNull(occupationId)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND,
                        "occupation not found"));
        Job job = jobRepository.findByIdForUpdate(task.getJobId())
                .orElseThrow(() -> new IllegalStateException("job not found"));

        OffsetDateTime now = OffsetDateTime.now();
        job.setOccupationId(occupation.getId());
        job.setUpdatedAt(now);
        jobRepository.save(job);

        JobOccupationAlias alias = null;
        if (job.getName() != null && !job.getName().isBlank()) {
            alias = aliasRepository.findByJobNameForUpdate(job.getName())
                    .orElseGet(() -> newAlias(job, task, audit, now));
            // 已存在映射时以本次人工审核结论更新，并记录本次关键 trace_id。
            alias.setTraceId(task.getTraceId());
            alias.setOccupationId(occupation.getId());
            alias.setOccupationName(occupation.getName());
            alias.setReviewedAt(now);
            alias.setReviewedBy(audit.userId());
            alias.setUpdatedAt(now);
            aliasRepository.save(alias);
        }

        task.setSelectedOccupationId(occupation.getId());
        task.setReviewStatus(ReviewStatus.PASSED);
        task.setReviewedAt(now);
        task.setReviewedBy(audit.userId());
        task.setUpdatedAt(now);
        taskRepository.save(task);
        logService.info(audit, "job analysis reviewed: task_id=" + taskId
                + ", occupation_id=" + occupationId);
        return Optional.of(new ReviewResult(task, job, occupation, alias));
    }

    private JobOccupationAlias newAlias(Job job,
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

    public record ReviewResult(JobAnalysisTask task,
                               Job job,
                               Occupation occupation,
                               JobOccupationAlias alias) {
    }
}
