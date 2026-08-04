// 百工谱 — 已复核岗位数据实体
// 映射 data_source_service 数据库的 reviewed_cleaned_job_sources 表
// 与 cleaned_job_sources 字段一致，但无 review_status 列（复核通过后归档至此）

package com.baigon.datasource.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "reviewed_cleaned_job_sources")
public class ReviewedCleanedJobSource {

    @Id
    private Long id;

    @Column(name = "trace_id")
    private Long traceId;

    @Column(name = "publish_date", nullable = false)
    private OffsetDateTime publishDate;

    @Column(name = "source_platform", nullable = false)
    private String sourcePlatform;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "city")
    private String city;

    @Column(name = "tags")
    private String tags;

    @Column(name = "major")
    private String major;

    @Column(name = "nature")
    private String nature;

    @Column(name = "salary")
    private String salary;

    @Column(name = "job_name")
    private String jobName;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "company_size")
    private String companySize;

    @Column(name = "province")
    private String province;

    @Column(name = "education")
    private String education;

    @Column(name = "experience")
    private String experience;

    @Column(name = "job_description")
    private String jobDescription;

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

    // ==================== getter / setter ====================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }

    public OffsetDateTime getPublishDate() { return publishDate; }
    public void setPublishDate(OffsetDateTime publishDate) { this.publishDate = publishDate; }

    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }

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
