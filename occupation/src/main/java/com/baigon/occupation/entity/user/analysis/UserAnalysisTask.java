// 百工谱 — 用户分析任务实体，映射 user_analysis_tasks 表
package com.baigon.occupation.entity.user.analysis;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.TaskStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 记录简历技能分析或人岗匹配的一次完整任务生命周期。 */
@Entity
@Table(name = "user_analysis_tasks")
public class UserAnalysisTask extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "resume_id", nullable = false)
    private Long resumeId;
    @Column(name = "job_id")
    private Long jobId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_type", nullable = false, columnDefinition = "user_analysis_type")
    private UserAnalysisType taskType;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_status", nullable = false, columnDefinition = "task_status")
    private TaskStatus taskStatus = TaskStatus.PENDING;

    @Column(name = "model_name", length = 64)
    private String modelName;
    @Column(name = "match_score")
    private Integer matchScore;
    @Column(name = "match_summary", columnDefinition = "text")
    private String matchSummary;
    // JSONB 直接保留 AI 返回的结构化建议，避免丢失字段层次。
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skills_to_learn", nullable = false, columnDefinition = "jsonb")
    private JsonNode skillsToLearn = JsonNodeFactory.instance.arrayNode();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_suggestions", nullable = false, columnDefinition = "jsonb")
    private JsonNode actionSuggestions = JsonNodeFactory.instance.arrayNode();
    @Column(name = "error_msg", columnDefinition = "text")
    private String errorMsg;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getResumeId() { return resumeId; }
    public void setResumeId(Long resumeId) { this.resumeId = resumeId; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public UserAnalysisType getTaskType() { return taskType; }
    public void setTaskType(UserAnalysisType taskType) { this.taskType = taskType; }
    public TaskStatus getTaskStatus() { return taskStatus; }
    public void setTaskStatus(TaskStatus taskStatus) { this.taskStatus = taskStatus; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public Integer getMatchScore() { return matchScore; }
    public void setMatchScore(Integer matchScore) { this.matchScore = matchScore; }
    public String getMatchSummary() { return matchSummary; }
    public void setMatchSummary(String matchSummary) { this.matchSummary = matchSummary; }
    public JsonNode getSkillsToLearn() { return skillsToLearn; }
    public void setSkillsToLearn(JsonNode skillsToLearn) { this.skillsToLearn = skillsToLearn; }
    public JsonNode getActionSuggestions() { return actionSuggestions; }
    public void setActionSuggestions(JsonNode actionSuggestions) { this.actionSuggestions = actionSuggestions; }
    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
}
