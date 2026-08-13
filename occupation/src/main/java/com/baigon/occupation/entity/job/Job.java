// 百工谱 — 已审核岗位实体
package com.baigon.occupation.entity.job;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** data-source 审核通过后无条件创建；occupationId 可在岗位分析完成前为空。 */
@Entity
@Table(name = "jobs")
public class Job extends BaseEntity {

    /** 原始数据可能缺失岗位名；jobs 仍必须创建，后续任务交由人工处理。 */
    @Column(length = 64)
    private String name;
    @Column(name = "occupation_id")
    private Long occupationId;
    @Column(name = "trace_id")
    private Long traceId;
    @Column(name = "job_number")
    private String jobNumber;
    @Column(name = "publish_date")
    private OffsetDateTime publishDate;
    @Column(name = "source_platform", nullable = false)
    private String sourcePlatform;
    @Column(name = "source_url")
    private String sourceUrl;
    private String city;
    private String tags;
    private String major;
    private String nature;
    private String salary;
    @Column(name = "company_name")
    private String companyName;
    @Column(name = "company_size")
    private String companySize;
    private String province;
    private String education;
    private String experience;
    @Column(name = "job_description")
    private String jobDescription;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getOccupationId() { return occupationId; }
    public void setOccupationId(Long occupationId) { this.occupationId = occupationId; }
    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public String getJobNumber() { return jobNumber; }
    public void setJobNumber(String jobNumber) { this.jobNumber = jobNumber; }
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
}
