// 百工谱 — 清洗数据服务
// 消费 crawler 的 Kafka 事件写入 cleaned_job_sources；提供查询与人工审核业务。

package com.baigon.datasource.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.entity.ReviewedCleanedJobSource;
import com.baigon.datasource.error.ApiException;
import com.baigon.datasource.repository.CleanedJobSourceRepository;
import com.baigon.datasource.repository.ReviewedCleanedJobSourceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class CleanedJobSourceService {

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

    public CleanedJobSourceService(CleanedJobSourceRepository cleanedJobSourceRepository,
                                   ReviewedCleanedJobSourceRepository reviewedCleanedJobSourceRepository,
                                   LogService logService,
                                   Snowflake snowflake) {
        this.cleanedJobSourceRepository = cleanedJobSourceRepository;
        this.reviewedCleanedJobSourceRepository = reviewedCleanedJobSourceRepository;
        this.logService = logService;
        this.snowflake = snowflake;
    }

    /**
     * 保存一条清洗后的岗位数据到 cleaned_job_sources 表（review_status 默认 PENDING）。
     * 由 Kafka 消费端调用，携带事件中的用户上下文写日志。
     */
    public void saveCleaned(CleanedJobSource record, Long traceId,
                            Long userId, String userName, String userIp) {
        record.setId(snowflake.nextId());
        record.setTraceId(traceId);
        record.setReviewStatus(CleanedJobSource.ReviewStatus.PENDING);
        OffsetDateTime now = OffsetDateTime.now();
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        cleanedJobSourceRepository.save(record);
        // 写业务日志（用户上下文来自 Kafka 事件 payload）
        logService.info(traceId, userId, userName, userIp,
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
                        CleanedJobSource.ReviewStatus.valueOf(reviewStatus),
                        publishDateFrom, publishDateTo, pageRequest);
            }
            if (publishDateFrom != null) {
                return cleanedJobSourceRepository.findByReviewStatusAndPublishDateGreaterThanEqual(
                        CleanedJobSource.ReviewStatus.valueOf(reviewStatus), publishDateFrom, pageRequest);
            }
            if (publishDateTo != null) {
                return cleanedJobSourceRepository.findByReviewStatusAndPublishDateLessThanEqual(
                        CleanedJobSource.ReviewStatus.valueOf(reviewStatus), publishDateTo, pageRequest);
            }
            return cleanedJobSourceRepository.findByReviewStatus(
                    CleanedJobSource.ReviewStatus.valueOf(reviewStatus), pageRequest);
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

    /**
     * 人工审核入口。
     *
     * <p>原始业务字段永不修改；通过时生成独立审核结果，拒绝时只更新审核参数。</p>
     */
    @Transactional
    public Optional<ReviewResult> review(Long id, ReviewAction action, CleanedJobSource edited,
                                         Long reviewerId, String reviewerName) {
        Optional<CleanedJobSource> target = cleanedJobSourceRepository.findByIdForReview(id);
        if (target.isEmpty()) {
            return Optional.empty();
        }

        CleanedJobSource source = target.get();
        if (source.getReviewStatus() != CleanedJobSource.ReviewStatus.PENDING) {
            throw new ApiException(ApiException.ErrorCode.ALREADY_REVIEWED, "already reviewed");
        }

        ReviewResult result = applyReview(source, action, edited, reviewerId);
        writeReviewLog(source, action, reviewerId, reviewerName);
        return Optional.of(result);
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
                source.setReviewStatus(CleanedJobSource.ReviewStatus.PASSED);
                approvedVersion = createApprovedVersion(source, null, reviewerId, now);
                reviewedCleanedJobSourceRepository.save(approvedVersion);
            }
            case REJECT -> source.setReviewStatus(CleanedJobSource.ReviewStatus.REJECTED);
            case APPROVE_WITH_EDIT -> {
                source.setReviewStatus(CleanedJobSource.ReviewStatus.PASSED);
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
            if (edited.getSalary() != null) target.setSalary(edited.getSalary());
            if (edited.getCity() != null) target.setCity(edited.getCity());
            if (edited.getEducation() != null) target.setEducation(edited.getEducation());
            if (edited.getExperience() != null) target.setExperience(edited.getExperience());
            if (edited.getJobDescription() != null) target.setJobDescription(edited.getJobDescription());
        }
        return target;
    }

    /** 审核成功后的业务日志统一出口。 */
    private void writeReviewLog(CleanedJobSource source, ReviewAction action,
                                Long reviewerId, String reviewerName) {
        switch (action) {
            case APPROVE -> logService.info(source.getTraceId(), reviewerId, reviewerName, null,
                    "review approved: " + source.getJobName());
            case REJECT -> logService.warning(source.getTraceId(), reviewerId, reviewerName, null,
                    null, "review rejected: " + source.getJobName());
            case APPROVE_WITH_EDIT -> logService.info(source.getTraceId(), reviewerId, reviewerName, null,
                    "review approved with edit: " + source.getJobName());
        }
    }
}
