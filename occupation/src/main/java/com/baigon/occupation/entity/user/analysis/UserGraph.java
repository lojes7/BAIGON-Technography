// 百工谱 — 用户技能图谱实体，映射 user_graphs 表
package com.baigon.occupation.entity.user.analysis;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 每条记录属于一次简历技能分析，历史批次只追加，不覆盖。 */
@Entity
@Table(name = "user_graphs")
public class UserGraph extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "resume_id", nullable = false)
    private Long resumeId;
    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "proficiency", nullable = false, columnDefinition = "proficiency")
    private UserSkillProficiency proficiency;
    @Column(name = "evidence", nullable = false, columnDefinition = "text")
    private String evidence;
    /** AI 技能数组中的原始位置，仅用于同批结果的稳定排序。 */
    @Column(name = "rank", nullable = false)
    private Integer rank;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getResumeId() { return resumeId; }
    public void setResumeId(Long resumeId) { this.resumeId = resumeId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public UserSkillProficiency getProficiency() { return proficiency; }
    public void setProficiency(UserSkillProficiency proficiency) { this.proficiency = proficiency; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
}
