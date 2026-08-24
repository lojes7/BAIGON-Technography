// 百工谱 — 招聘岗位专业文本与标准本科专业映射实体
package com.baigon.occupation.entity.job;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "job_major_aliases")
public class JobMajorAlias extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "job_major", nullable = false, length = 64)
    private String jobMajor;
    @Column(name = "major_id", nullable = false)
    private Long majorId;
    @Column(name = "major_name", nullable = false, length = 64)
    private String majorName;
    @Column(name = "reviewed_at", nullable = false)
    private OffsetDateTime reviewedAt;
    @Column(name = "reviewed_by", nullable = false)
    private Long reviewedBy;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public String getJobMajor() { return jobMajor; }
    public void setJobMajor(String jobMajor) { this.jobMajor = jobMajor; }
    public Long getMajorId() { return majorId; }
    public void setMajorId(Long majorId) { this.majorId = majorId; }
    public String getMajorName() { return majorName; }
    public void setMajorName(String majorName) { this.majorName = majorName; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
