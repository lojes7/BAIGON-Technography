// 百工谱 — AI 从真实 JD 中抽取的待审核岗位技能
package com.baigon.occupation.entity.jobanalysis;

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

/** 原始 AI 字段永不覆盖，修改后通过的最终值单独保存在 reviewed_* 字段。 */
@Entity
@Table(name = "job_analysis_results")
public class JobAnalysisResult extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;
    @Column(name = "job_id", nullable = false)
    private Long jobId;
    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;
    @Column(name = "skill_proficiency", nullable = false, length = 32)
    private String skillProficiency;
    @Column(nullable = false)
    private String evidence;
    /** AI skills 数组中的原始位置，仅用于稳定排序，不表达技能优先级。 */
    @Column(nullable = false)
    private Integer rank;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "review_status", nullable = false, columnDefinition = "review_status")
    private ReviewStatus reviewStatus = ReviewStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(name = "review_action", length = 32)
    private JobAnalysisReviewAction reviewAction;
    @Column(name = "reviewed_skill_name", length = 100)
    private String reviewedSkillName;
    @Column(name = "reviewed_skill_proficiency", length = 32)
    private String reviewedSkillProficiency;
    @Column(name = "reviewed_evidence")
    private String reviewedEvidence;
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getSkillProficiency() { return skillProficiency; }
    public void setSkillProficiency(String skillProficiency) { this.skillProficiency = skillProficiency; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public JobAnalysisReviewAction getReviewAction() { return reviewAction; }
    public void setReviewAction(JobAnalysisReviewAction reviewAction) { this.reviewAction = reviewAction; }
    public String getReviewedSkillName() { return reviewedSkillName; }
    public void setReviewedSkillName(String reviewedSkillName) { this.reviewedSkillName = reviewedSkillName; }
    public String getReviewedSkillProficiency() { return reviewedSkillProficiency; }
    public void setReviewedSkillProficiency(String reviewedSkillProficiency) {
        this.reviewedSkillProficiency = reviewedSkillProficiency;
    }
    public String getReviewedEvidence() { return reviewedEvidence; }
    public void setReviewedEvidence(String reviewedEvidence) { this.reviewedEvidence = reviewedEvidence; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
