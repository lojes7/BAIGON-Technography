// 百工谱 — 清洗后岗位数据实体
// 映射 data_source_service 数据库的 cleaned_job_sources 表
// crawler 清洗完成的数据经 Kafka 事件（baigon.crawler.document.ingested）写入本表

package com.baigon.datasource.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cleaned_job_sources")
public class CleanedJobSource {

    @Id
    private Long id;

    /** 链路追踪 ID（与 job_sources 中同一 trace_id，可追溯原始数据） */
    @Column(name = "trace_id")
    private Long traceId;

    /** 发布日期（可空：crawler 解析失败时诚实存 NULL） */
    @Column(name = "publish_date")
    private OffsetDateTime publishDate;

    /** 来源平台（拉勾/Boss直聘等） */
    @Column(name = "source_platform", nullable = false)
    private String sourcePlatform;

    /** 来源平台内的岗位业务编号（仅服务层使用，不参与人工复核且不对外返回） */
    @Column(name = "job_number")
    private String jobNumber;

    /** 来源 URL */
    @Column(name = "source_url")
    private String sourceUrl;

    /** 城市 */
    @Column(name = "city")
    private String city;

    /** 标签（顿号分隔） */
    @Column(name = "tags")
    private String tags;

    /** 专业方向 */
    @Column(name = "major")
    private String major;

    /** 工作性质（全职/实习/兼职） */
    @Column(name = "nature")
    private String nature;

    /** 薪资 */
    @Column(name = "salary")
    private String salary;

    /** 岗位名称 */
    @Column(name = "job_name")
    private String jobName;

    /** 公司名称 */
    @Column(name = "company_name")
    private String companyName;

    /** 公司规模 */
    @Column(name = "company_size")
    private String companySize;

    /** 省份 */
    @Column(name = "province")
    private String province;

    /** 学历要求 */
    @Column(name = "education")
    private String education;

    /** 经验要求 */
    @Column(name = "experience")
    private String experience;

    /** 岗位描述 */
    @Column(name = "job_description")
    private String jobDescription;

    /** 人工复核状态（默认 PENDING） */
    @Enumerated(EnumType.STRING)
    // @JdbcTypeCode(NAMED_ENUM)：Hibernate 6 按 PG 原生枚举绑定参数，否则报类型不匹配
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "review_status")
    private ReviewStatus reviewStatus;

    /** 复核时间 */
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    /** 复核人 ID */
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** 软删除时间，非空表示已删除 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ==================== 枚举 ====================

    /** 复核状态（与 init.sql 中 review_status 枚举保持一致） */
    public enum ReviewStatus {
        PASSED, REJECTED, PENDING
    }

    // ==================== getter / setter ====================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }

    public OffsetDateTime getPublishDate() { return publishDate; }
    public void setPublishDate(OffsetDateTime publishDate) { this.publishDate = publishDate; }

    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }

    public String getJobNumber() { return jobNumber; }
    public void setJobNumber(String jobNumber) { this.jobNumber = jobNumber; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }

    public String getNature() { return nature; }
    public void setNature(String nature) { this.nature = nature; }

    public String getSalary() { return salary; }
    public void setSalary(String salary) { this.salary = salary; }

    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanySize() { return companySize; }
    public void setCompanySize(String companySize) { this.companySize = companySize; }

    public String getProvince() { return province; }
    public void setProvince(String province) { this.province = province; }

    public String getEducation() { return education; }
    public void setEducation(String education) { this.education = education; }

    public String getExperience() { return experience; }
    public void setExperience(String experience) { this.experience = experience; }

    public String getJobDescription() { return jobDescription; }
    public void setJobDescription(String jobDescription) { this.jobDescription = jobDescription; }

    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }

    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
