// 百工谱 — 清洗数据服务
// 消费 crawler 的 Kafka 事件（baigon.crawler.document.ingested）写入 cleaned_job_sources 表；
// 提供分页列表、详情、原始记录追溯、人工复核等业务方法。

package com.baigon.datasource.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.repository.CleanedJobSourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class CleanedJobSourceService {

    private static final Logger log = LoggerFactory.getLogger(CleanedJobSourceService.class);

    private final CleanedJobSourceRepository cleanedJobSourceRepository;
    private final LogService logService;
    private final Snowflake snowflake;

    public CleanedJobSourceService(CleanedJobSourceRepository cleanedJobSourceRepository,
                                   LogService logService, Snowflake snowflake) {
        this.cleanedJobSourceRepository = cleanedJobSourceRepository;
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

    /** 按主键查询未删除的清洗数据（软删除过滤） */
    public Optional<CleanedJobSource> findById(Long id) {
        return cleanedJobSourceRepository.findByIdNotDeleted(id);
    }

    /** 人工复核：通过 / 拒绝 / 修改后通过 */
    public Optional<CleanedJobSource> review(Long id, String action, CleanedJobSource edited,
                                             Long reviewerId, String reviewerName) {
        Optional<CleanedJobSource> opt = cleanedJobSourceRepository.findById(id);
        if (opt.isEmpty()) {
            return Optional.empty();
        }
        CleanedJobSource job = opt.get();
        OffsetDateTime now = OffsetDateTime.now();
        job.setReviewedAt(now);
        job.setReviewedBy(reviewerId);

        switch (action) {
            case "APPROVE" -> {
                job.setReviewStatus(CleanedJobSource.ReviewStatus.PASSED);
                logService.info(job.getTraceId(), reviewerId, reviewerName, null,
                        "review approved: " + job.getJobName());
            }
            case "REJECT" -> {
                job.setReviewStatus(CleanedJobSource.ReviewStatus.REJECTED);
                logService.warning(job.getTraceId(), reviewerId, reviewerName, null,
                        null, "review rejected: " + job.getJobName());
            }
            case "APPROVE_WITH_EDIT" -> {
                // 应用修改后的字段（仅业务字段，审核列不动）
                if (edited != null) {
                    if (edited.getJobName() != null) job.setJobName(edited.getJobName());
                    if (edited.getCompanyName() != null) job.setCompanyName(edited.getCompanyName());
                    if (edited.getSalary() != null) job.setSalary(edited.getSalary());
                    if (edited.getCity() != null) job.setCity(edited.getCity());
                    if (edited.getEducation() != null) job.setEducation(edited.getEducation());
                    if (edited.getExperience() != null) job.setExperience(edited.getExperience());
                    if (edited.getJobDescription() != null) job.setJobDescription(edited.getJobDescription());
                }
                job.setReviewStatus(CleanedJobSource.ReviewStatus.PASSED);
                logService.info(job.getTraceId(), reviewerId, reviewerName, null,
                        "review approved with edit: " + job.getJobName());
            }
            default -> throw new IllegalArgumentException("unknown review action: " + action);
        }
        job.setUpdatedAt(now);
        cleanedJobSourceRepository.save(job);
        return Optional.of(job);
    }
}
