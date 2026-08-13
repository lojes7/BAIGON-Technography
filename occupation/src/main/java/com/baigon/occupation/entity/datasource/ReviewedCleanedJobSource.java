// 百工谱 — 已复核岗位数据实体
// 映射 occupation 合并数据库的 reviewed_cleaned_job_sources 表
// 与 cleaned_job_sources 字段一致，但无 review_status 列（复核通过后归档至此）

package com.baigon.occupation.entity.datasource;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "reviewed_cleaned_job_sources")
public class ReviewedCleanedJobSource extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;

    /** 发布日期可空：上游解析失败时不伪造时间。 */
    @Column(name = "publish_date")
    private OffsetDateTime publishDate;

    @Column(name = "source_platform", nullable = false)
    private String sourcePlatform;

    /** 来源平台内的岗位业务编号（仅服务层使用，不对外返回） */
    @Column(name = "job_number")
    private String jobNumber;

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

    // ==================== getter / setter ====================

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

    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }

}
