// 百工谱 — 岗位分析 AI 候选职业实体
package com.baigon.occupation.entity.jobanalysis;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "job_analysis_task_candidates")
public class JobAnalysisCandidate extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;
    @Column(name = "occupation_id", nullable = false)
    private Long occupationId;
    @Column(name = "occupation_name", nullable = false, length = 64)
    private String occupationName;
    @Column(nullable = false)
    private Integer rank;
    @Column(nullable = false)
    private Double similarity;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getOccupationId() { return occupationId; }
    public void setOccupationId(Long occupationId) { this.occupationId = occupationId; }
    public String getOccupationName() { return occupationName; }
    public void setOccupationName(String occupationName) { this.occupationName = occupationName; }
    public Integer getRank() { return rank; }
    public void setRank(Integer rank) { this.rank = rank; }
    public Double getSimilarity() { return similarity; }
    public void setSimilarity(Double similarity) { this.similarity = similarity; }
}
