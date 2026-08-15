// 百工谱 — 人工审核通过后的正式岗位技能关系
package com.baigon.occupation.entity.job;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "job_skills")
public class JobSkill extends BaseEntity {

    @Column(name = "analysis_result_id", nullable = false)
    private Long analysisResultId;
    @Column(name = "job_id", nullable = false)
    private Long jobId;
    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;
    @Column(name = "skill_proficiency", nullable = false, length = 32)
    private String skillProficiency;
    @Column(nullable = false)
    private String evidence;

    public Long getAnalysisResultId() { return analysisResultId; }
    public void setAnalysisResultId(Long analysisResultId) { this.analysisResultId = analysisResultId; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getSkillProficiency() { return skillProficiency; }
    public void setSkillProficiency(String skillProficiency) { this.skillProficiency = skillProficiency; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
}
