// 百工谱 — 岗位技能解析的规范技能候选实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "job_skill_resolution_candidates")
public class JobSkillResolutionCandidate extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;
    @Column(name = "skill_id", nullable = false)
    private Long skillId;
    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;
    @Column(nullable = false)
    private Integer rank;
    @Column(nullable = false)
    private Double similarity;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public Double getSimilarity() { return similarity; }
    public void setSimilarity(Double similarity) { this.similarity = similarity; }
}
