// 百工谱 — 岗位职业归类分析任务实体
package com.baigon.occupation.entity.jobanalysis;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "job_analysis_tasks")
public class JobAnalysisTask extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "job_id", nullable = false)
    private Long jobId;
    @Column(name = "job_name", length = 64)
    private String jobName;
    @Column(name = "model_name")
    private String modelName;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_status", nullable = false, columnDefinition = "task_status")
    private TaskStatus taskStatus = TaskStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "occupation_analysis_status", nullable = false, columnDefinition = "task_status")
    private TaskStatus occupationAnalysisStatus = TaskStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "jd_analysis_status", nullable = false, columnDefinition = "task_status")
    private TaskStatus jdAnalysisStatus = TaskStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "review_status", nullable = false, columnDefinition = "review_status")
    private ReviewStatus reviewStatus = ReviewStatus.PENDING;
    @Column(name = "selected_occupation_id")
    private Long selectedOccupationId;
    @Column(nullable = false)
    private Integer attempts = 0;
    @Column(name = "error_msg")
    private String errorMsg;
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public TaskStatus getTaskStatus() { return taskStatus; }
    public void setTaskStatus(TaskStatus taskStatus) { this.taskStatus = taskStatus; }
    public TaskStatus getOccupationAnalysisStatus() { return occupationAnalysisStatus; }
    public void setOccupationAnalysisStatus(TaskStatus occupationAnalysisStatus) {
        this.occupationAnalysisStatus = occupationAnalysisStatus;
    }
    public TaskStatus getJdAnalysisStatus() { return jdAnalysisStatus; }
    public void setJdAnalysisStatus(TaskStatus jdAnalysisStatus) { this.jdAnalysisStatus = jdAnalysisStatus; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public Long getSelectedOccupationId() { return selectedOccupationId; }
    public void setSelectedOccupationId(Long selectedOccupationId) { this.selectedOccupationId = selectedOccupationId; }
    public Integer getAttempts() { return attempts; }
    public void setAttempts(Integer attempts) { this.attempts = attempts; }
    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
