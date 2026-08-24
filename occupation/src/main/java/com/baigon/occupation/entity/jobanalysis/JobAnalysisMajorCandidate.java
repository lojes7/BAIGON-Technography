// 百工谱 — 岗位分析 AI 候选专业实体
package com.baigon.occupation.entity.jobanalysis;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "job_analysis_task_major_candidates")
public class JobAnalysisMajorCandidate extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;
    @Column(name = "major_id", nullable = false)
    private Long majorId;
    @Column(name = "major_name", nullable = false, length = 64)
    private String majorName;
    @Column(nullable = false)
    private Integer rank;
    @Column(nullable = false)
    private Double similarity;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getMajorId() { return majorId; }
    public void setMajorId(Long majorId) { this.majorId = majorId; }
    public String getMajorName() { return majorName; }
    public void setMajorName(String majorName) { this.majorName = majorName; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public Double getSimilarity() { return similarity; }
    public void setSimilarity(Double similarity) { this.similarity = similarity; }
}
