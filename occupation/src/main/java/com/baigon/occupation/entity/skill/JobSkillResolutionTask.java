// 百工谱 — 岗位技能全局身份解析任务实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.ReviewStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "job_skill_resolution_tasks")
public class JobSkillResolutionTask extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "job_skill_id", nullable = false)
    private Long jobSkillId;
    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;
    @Column(name = "model_name", length = 64)
    private String modelName;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_status", nullable = false, columnDefinition = "skill_resolution_task_status")
    private SkillResolutionTaskStatus taskStatus = SkillResolutionTaskStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "review_status", nullable = false, columnDefinition = "review_status")
    private ReviewStatus reviewStatus = ReviewStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(name = "resolution_action", length = 32)
    private SkillResolutionAction resolutionAction;
    @Column(name = "selected_skill_id")
    private Long selectedSkillId;
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
    public Long getJobSkillId() { return jobSkillId; }
    public void setJobSkillId(Long jobSkillId) { this.jobSkillId = jobSkillId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public SkillResolutionTaskStatus getTaskStatus() { return taskStatus; }
    public void setTaskStatus(SkillResolutionTaskStatus taskStatus) { this.taskStatus = taskStatus; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public SkillResolutionAction getResolutionAction() { return resolutionAction; }
    public void setResolutionAction(SkillResolutionAction resolutionAction) {
        this.resolutionAction = resolutionAction;
    }
    public Long getSelectedSkillId() { return selectedSkillId; }
    public void setSelectedSkillId(Long selectedSkillId) { this.selectedSkillId = selectedSkillId; }
    public Integer getAttempts() { return attempts; }
    public void setAttempts(Integer attempts) { this.attempts = attempts; }
    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
