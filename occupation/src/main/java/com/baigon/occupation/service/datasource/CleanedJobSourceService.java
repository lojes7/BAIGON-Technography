// 百工谱 — 清洗数据服务
// 消费 crawler 的 Kafka 事件写入 cleaned_job_sources；提供查询与人工审核业务。

package com.baigon.occupation.service.datasource;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.entity.datasource.ReviewedCleanedJobSource;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobMajorAlias;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.datasource.CleanedJobSourceRepository;
import com.baigon.occupation.repository.datasource.ReviewedCleanedJobSourceRepository;
import com.baigon.occupation.repository.job.JobMajorAliasRepository;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.job.JobMajorPolicy;
import com.baigon.occupation.service.jobanalysis.JobAnalysisService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CleanedJobSourceService {

    private static final int MAX_BATCH_SIZE = 200;

    /** 服务层审核动作，避免业务逻辑依赖 gRPC 生成类型。 */
    public enum ReviewAction {
        APPROVE,
        REJECT,
        APPROVE_WITH_EDIT
    }

    /** 审核结果同时保留原记录状态与最终生效的审核版本。 */
    public record ReviewResult(CleanedJobSource source, ReviewedCleanedJobSource approvedVersion) {
    }

    private final CleanedJobSourceRepository cleanedJobSourceRepository;
    private final ReviewedCleanedJobSourceRepository reviewedCleanedJobSourceRepository;
    private final LogService logService;
    private final Snowflake snowflake;
    private final JobRepository jobRepository;
    private final JobOccupationAliasRepository occupationAliasRepository;
    private final JobMajorAliasRepository majorAliasRepository;
    private final MajorRepository majorRepository;
    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisService jobAnalysisService;

    public CleanedJobSourceService(CleanedJobSourceRepository cleanedJobSourceRepository,
                                   ReviewedCleanedJobSourceRepository reviewedCleanedJobSourceRepository,
                                   LogService logService,
                                   Snowflake snowflake,
                                   JobRepository jobRepository,
                                   JobOccupationAliasRepository occupationAliasRepository,
                                   JobMajorAliasRepository majorAliasRepository,
                                   MajorRepository majorRepository,
                                   JobAnalysisTaskRepository taskRepository,
                                   JobAnalysisService jobAnalysisService) {
        this.cleanedJobSourceRepository = cleanedJobSourceRepository;
        this.reviewedCleanedJobSourceRepository = reviewedCleanedJobSourceRepository;
        this.logService = logService;
        this.snowflake = snowflake;
        this.jobRepository = jobRepository;
        this.occupationAliasRepository = occupationAliasRepository;
        this.majorAliasRepository = majorAliasRepository;
        this.majorRepository = majorRepository;
        this.taskRepository = taskRepository;
        this.jobAnalysisService = jobAnalysisService;
    }

    /**
     * 保存一条清洗后的岗位数据到 cleaned_job_sources 表（review_status 默认 PENDING）。
     * 由 Kafka 消费端调用，携带事件中的用户上下文写日志。
     */
    public void saveCleaned(CleanedJobSource record, Long traceId,
                            Long userId, String userName, String userIp) {
        record.setId(snowflake.nextId());
        record.setTraceId(traceId);
        record.setReviewStatus(ReviewStatus.PENDING);
        OffsetDateTime now = OffsetDateTime.now();
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        cleanedJobSourceRepository.save(record);
        // 写业务日志（用户上下文来自 Kafka 事件 payload）
        logService.info(AuditContext.from(traceId, userId, userName, userIp, "KAFKA", ""),
                "cleaned job source saved: " + record.getJobName());
    }

    /**
     * 分页查询清洗后岗位（按发布时间倒序），返回 JPA Page 供 gRPC 层组装摘要。
     * reviewStatus 为空时查全部；publishDateFrom/To 为可选发布时间范围。
     */
    public Page<CleanedJobSource> list(int page, int pageSize, String reviewStatus,
                                       OffsetDateTime publishDateFrom, OffsetDateTime publishDateTo) {
        PageRequest pageRequest = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "publishDate"));
        // 动态筛选：复核状态 + 发布时间范围（均可选）
        if (reviewStatus != null && !reviewStatus.isBlank()) {
            if (publishDateFrom != null && publishDateTo != null) {
                return cleanedJobSourceRepository.findByReviewStatusAndPublishDateBetween(
                        ReviewStatus.valueOf(reviewStatus.toUpperCase()),
                        publishDateFrom, publishDateTo, pageRequest);
            }
            if (publishDateFrom != null) {
                return cleanedJobSourceRepository.findByReviewStatusAndPublishDateGreaterThanEqual(
                        ReviewStatus.valueOf(reviewStatus.toUpperCase()), publishDateFrom, pageRequest);
            }
            if (publishDateTo != null) {
                return cleanedJobSourceRepository.findByReviewStatusAndPublishDateLessThanEqual(
                        ReviewStatus.valueOf(reviewStatus.toUpperCase()), publishDateTo, pageRequest);
            }
            return cleanedJobSourceRepository.findByReviewStatus(
                    ReviewStatus.valueOf(reviewStatus.toUpperCase()), pageRequest);
        }
        if (publishDateFrom != null && publishDateTo != null) {
            return cleanedJobSourceRepository.findByPublishDateBetween(publishDateFrom, publishDateTo, pageRequest);
        }
        if (publishDateFrom != null) {
            return cleanedJobSourceRepository.findByPublishDateGreaterThanEqual(publishDateFrom, pageRequest);
        }
        if (publishDateTo != null) {
            return cleanedJobSourceRepository.findByPublishDateLessThanEqual(publishDateTo, pageRequest);
        }
        return cleanedJobSourceRepository.findAll(pageRequest);
    }

    /** 按主键查询未删除的清洗数据（软删除过滤）。 */
    public Optional<CleanedJobSource> findById(Long id) {
        return cleanedJobSourceRepository.findByIdNotDeleted(id);
    }

    /** 按请求顺序批量查询未删除的清洗岗位详情。 */
    public List<CleanedJobSource> batchFindByIds(Collection<Long> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("ids must contain between 1 and 200 values");
        }
        if (values.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("ids must contain at most 200 values");
        }
        List<Long> ids = List.copyOf(values);
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("ids must contain positive values");
        }
        // 在仓库查询前去重，并保持首次出现顺序。
        ids = ids.stream().distinct().toList();
        Map<Long, CleanedJobSource> byId = new LinkedHashMap<>();
        cleanedJobSourceRepository.findByIdInAndDeletedAtIsNull(ids)
                .forEach(item -> byId.put(item.getId(), item));
        return ids.stream()
                .distinct()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * 人工审核入口。
     *
     * <p>原始业务字段永不修改；通过时生成独立审核结果，拒绝时只更新审核参数。</p>
     */
    @Transactional
    public Optional<ReviewResult> review(Long id, ReviewAction action, CleanedJobSource edited,
                                         AuditContext audit) {
        Optional<CleanedJobSource> target = cleanedJobSourceRepository.findByIdForReview(id);
        if (target.isEmpty()) {
            return Optional.empty();
        }

        CleanedJobSource source = target.get();
        if (source.getReviewStatus() != ReviewStatus.PENDING) {
            throw new ApiException(ApiException.ErrorCode.ALREADY_REVIEWED, "already reviewed");
        }

        ReviewResult result = applyReview(source, action, edited, audit.userId());
        writeReviewLog(source, action, audit);
        if (result.approvedVersion() != null) {
            // 审核快照、jobs 和分析任务在同一事务中完成，不经过 Kafka。
            OffsetDateTime now = result.approvedVersion().getUpdatedAt();
            JobAnalysisTask task = createJobAndPrepareAnalysis(result.approvedVersion(), now);
            if (task != null) {
                jobAnalysisService.submitAfterCommit(
                        task.getId(), audit.withTraceId(source.getTraceId()));
            }
        }
        return Optional.of(result);
    }

    /**
     * 同步创建 jobs 和总分析任务：职业与专业别名决定是否跳过对应 Embedding，
     * “专业不限”直接关联“其他”，真实 JD 分析始终在事务提交后执行。
     */
    private JobAnalysisTask createJobAndPrepareAnalysis(ReviewedCleanedJobSource source,
                                                        OffsetDateTime now) {
        Job job = jobRepository.findByTraceIdAndDeletedAtIsNull(source.getTraceId())
                .orElseGet(() -> newJob(source, now));

        if (job.getOccupationId() == null && job.getName() != null && !job.getName().isBlank()) {
            Optional<JobOccupationAlias> alias =
                    occupationAliasRepository.findActiveByNormalizedJobName(job.getName());
            if (alias.isPresent()) {
                job.setOccupationId(alias.get().getOccupationId());
                job.setUpdatedAt(now);
            }
        }

        if (job.getMajorId() == null) {
            if (JobMajorPolicy.shouldUseOther(job.getMajor())) {
                Major other = majorRepository.findByCodeAndDeletedAtIsNull(
                                JobMajorPolicy.OTHER_MAJOR_CODE)
                        .orElseThrow(() -> new IllegalStateException("other major seed not found"));
                job.setMajorId(other.getId());
                job.setUpdatedAt(now);
            } else {
                Optional<JobMajorAlias> alias =
                        majorAliasRepository.findActiveByNormalizedJobMajor(job.getMajor());
                if (alias.isPresent()) {
                    job.setMajorId(alias.get().getMajorId());
                    job.setUpdatedAt(now);
                }
            }
        }

        jobRepository.save(job);
        if (taskRepository.findByJobIdAndDeletedAtIsNull(job.getId()).isPresent()) {
            return null;
        }
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(snowflake.nextId());
        task.setTraceId(job.getTraceId());
        task.setJobId(job.getId());
        task.setJobName(job.getName());
        task.setJobMajor(job.getMajor());
        task.setTaskStatus(TaskStatus.PENDING);
        task.setOccupationAnalysisStatus(
                job.getOccupationId() == null ? TaskStatus.PENDING : TaskStatus.SUCCESS);
        task.setMajorAnalysisStatus(
                job.getMajorId() == null ? TaskStatus.PENDING : TaskStatus.SUCCESS);
        task.setJdAnalysisStatus(TaskStatus.PENDING);
        task.setReviewStatus(ReviewStatus.PENDING);
        task.setSelectedOccupationId(job.getOccupationId());
        task.setSelectedMajorId(job.getMajorId());
        task.setAttempts(0);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        return taskRepository.save(task);
    }

    /** 从最终审核快照构造岗位，目录外键由别名、兜底规则或后续人工审核确定。 */
    private Job newJob(ReviewedCleanedJobSource source, OffsetDateTime now) {
        Job job = new Job();
        job.setId(snowflake.nextId());
        job.setTraceId(source.getTraceId());
        job.setName(source.getJobName());
        job.setJobNumber(source.getJobNumber());
        job.setPublishDate(source.getPublishDate());
        job.setSourcePlatform(source.getSourcePlatform());
        job.setSourceUrl(source.getSourceUrl());
        job.setCity(source.getCity());
        job.setTags(source.getTags());
        job.setMajor(source.getMajor());
        job.setNature(source.getNature());
        job.setSalary(source.getSalary());
        job.setCompanyName(source.getCompanyName());
        job.setCompanySize(source.getCompanySize());
        job.setProvince(source.getProvince());
        job.setEducation(source.getEducation());
        job.setExperience(source.getExperience());
        job.setJobDescription(source.getJobDescription());
        job.setCreatedAt(now);
        job.setUpdatedAt(now);
        return job;
    }

    /** 在已持有数据库行锁的事务中执行状态变更与审核结果落库。 */
    private ReviewResult applyReview(CleanedJobSource source, ReviewAction action,
                                     CleanedJobSource edited, Long reviewerId) {
        if (action == ReviewAction.APPROVE_WITH_EDIT && edited == null) {
            throw new ApiException(
                    ApiException.ErrorCode.BAD_REQUEST,
                    "edited job is required");
        }

        OffsetDateTime now = OffsetDateTime.now();
        source.setReviewedAt(now);
        source.setReviewedBy(reviewerId);
        source.setUpdatedAt(now);

        ReviewedCleanedJobSource approvedVersion = null;
        switch (action) {
            case APPROVE -> {
                source.setReviewStatus(ReviewStatus.PASSED);
                approvedVersion = createApprovedVersion(source, null, reviewerId, now);
                reviewedCleanedJobSourceRepository.save(approvedVersion);
            }
            case REJECT -> source.setReviewStatus(ReviewStatus.REJECTED);
            case APPROVE_WITH_EDIT -> {
                source.setReviewStatus(ReviewStatus.PASSED);
                approvedVersion = createApprovedVersion(source, edited, reviewerId, now);
                reviewedCleanedJobSourceRepository.save(approvedVersion);
            }
        }

        cleanedJobSourceRepository.save(source);
        return new ReviewResult(source, approvedVersion);
    }

    /** 复制原始业务数据并合并审核编辑字段，trace_id 始终沿用来源记录。 */
    private ReviewedCleanedJobSource createApprovedVersion(CleanedJobSource source,
                                                            CleanedJobSource edited,
                                                            Long reviewerId,
                                                            OffsetDateTime now) {
        ReviewedCleanedJobSource target = new ReviewedCleanedJobSource();
        target.setId(snowflake.nextId());
        target.setTraceId(source.getTraceId());
        target.setPublishDate(source.getPublishDate());
        target.setSourcePlatform(source.getSourcePlatform());
        target.setJobNumber(source.getJobNumber());
        target.setSourceUrl(source.getSourceUrl());
        target.setCity(source.getCity());
        target.setTags(source.getTags());
        target.setMajor(source.getMajor());
        target.setNature(source.getNature());
        target.setSalary(source.getSalary());
        target.setJobName(source.getJobName());
        target.setCompanyName(source.getCompanyName());
        target.setCompanySize(source.getCompanySize());
        target.setProvince(source.getProvince());
        target.setEducation(source.getEducation());
        target.setExperience(source.getExperience());
        target.setJobDescription(source.getJobDescription());
        target.setReviewedAt(now);
        target.setReviewedBy(reviewerId);
        target.setCreatedAt(now);
        target.setUpdatedAt(now);

        // 仅审核允许编辑的字段覆盖快照；原 cleaned_job_sources 业务字段保持不变。
        if (edited != null) {
            if (edited.getJobName() != null) target.setJobName(edited.getJobName());
            if (edited.getCompanyName() != null) target.setCompanyName(edited.getCompanyName());
            if (edited.getMajor() != null) target.setMajor(edited.getMajor());
            if (edited.getSalary() != null) target.setSalary(edited.getSalary());
            if (edited.getCity() != null) target.setCity(edited.getCity());
            if (edited.getEducation() != null) target.setEducation(edited.getEducation());
            if (edited.getExperience() != null) target.setExperience(edited.getExperience());
            if (edited.getJobDescription() != null) target.setJobDescription(edited.getJobDescription());
        }
        return target;
    }

    /** 审核成功后的业务日志统一出口。 */
    private void writeReviewLog(CleanedJobSource source, ReviewAction action, AuditContext audit) {
        // 审核日志使用岗位来源 trace_id，保留原请求的用户与网络上下文。
        AuditContext sourceAudit = audit.withTraceId(source.getTraceId());
        switch (action) {
            case APPROVE -> logService.info(sourceAudit,
                    "review approved: " + source.getJobName());
            case REJECT -> logService.warning(sourceAudit,
                    "review rejected: " + source.getJobName());
            case APPROVE_WITH_EDIT -> logService.info(sourceAudit,
                    "review approved with edit: " + source.getJobName());
        }
    }
}
