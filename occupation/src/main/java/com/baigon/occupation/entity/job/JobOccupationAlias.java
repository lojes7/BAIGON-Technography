// 百工谱 — 岗位名称与标准职业映射实体
package com.baigon.occupation.entity.job;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "job_occupation_aliases")
public class JobOccupationAlias extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "job_name", nullable = false, length = 64)
    private String jobName;
    @Column(name = "occupation_id", nullable = false)
    private Long occupationId;
    @Column(name = "occupation_name", nullable = false, length = 64)
    private String occupationName;
    @Column(name = "reviewed_at", nullable = false)
    private OffsetDateTime reviewedAt;
    @Column(name = "reviewed_by", nullable = false)
    private Long reviewedBy;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public Long getOccupationId() { return occupationId; }
    public void setOccupationId(Long occupationId) { this.occupationId = occupationId; }
    public String getOccupationName() { return occupationName; }
    public void setOccupationName(String occupationName) { this.occupationName = occupationName; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
