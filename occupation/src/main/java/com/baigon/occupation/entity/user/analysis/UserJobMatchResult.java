// 百工谱 — 用户人岗匹配结果实体，映射 user_job_match_results 表
package com.baigon.occupation.entity.user.analysis;

import com.baigon.occupation.entity.BaseEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 保存一次成功人岗匹配的可查询业务结果；历史匹配只追加，不覆盖。 */
@Entity
@Table(name = "user_job_match_results")
public class UserJobMatchResult extends BaseEntity {

    /** 关联任务仅承载执行状态与内部审计信息，一次任务最多对应一份结果。 */
    @Column(name = "task_id", nullable = false, unique = true)
    private Long taskId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "resume_id", nullable = false)
    private Long resumeId;
    @Column(name = "job_id", nullable = false)
    private Long jobId;
    @Column(name = "match_score", nullable = false)
    private Integer matchScore;
    @Column(name = "match_summary", nullable = false, columnDefinition = "text")
    private String matchSummary;

    // JSONB 原样保存 AI 返回的结构化数组，避免展开后丢失建议字段。
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skills_to_learn", nullable = false, columnDefinition = "jsonb")
    private JsonNode skillsToLearn = JsonNodeFactory.instance.arrayNode();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_suggestions", nullable = false, columnDefinition = "jsonb")
    private JsonNode actionSuggestions = JsonNodeFactory.instance.arrayNode();

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getResumeId() { return resumeId; }
    public void setResumeId(Long resumeId) { this.resumeId = resumeId; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public Integer getMatchScore() { return matchScore; }
    public void setMatchScore(Integer matchScore) { this.matchScore = matchScore; }
    public String getMatchSummary() { return matchSummary; }
    public void setMatchSummary(String matchSummary) { this.matchSummary = matchSummary; }
    public JsonNode getSkillsToLearn() { return skillsToLearn; }
    public void setSkillsToLearn(JsonNode skillsToLearn) { this.skillsToLearn = skillsToLearn; }
    public JsonNode getActionSuggestions() { return actionSuggestions; }
    public void setActionSuggestions(JsonNode actionSuggestions) {
        this.actionSuggestions = actionSuggestions;
    }
}
