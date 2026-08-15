// 百工谱 — 用户分析任务实体，映射 user_analysis_tasks 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.TaskStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_analysis_tasks")
public class UserAnalysisTask extends BaseEntity {

    @Column(name = "trace_id")
    private Long traceId;
    @Column(name = "user_id")
    private Long userId;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_status", nullable = false, columnDefinition = "task_status")
    private TaskStatus taskStatus;
    @Column(name = "model_name", length = 32)
    private String modelName;
    @Column(name = "ai_suggestion", columnDefinition = "text")
    private String aiSuggestion;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public TaskStatus getTaskStatus() { return taskStatus; }
    public void setTaskStatus(TaskStatus taskStatus) { this.taskStatus = taskStatus; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public String getAiSuggestion() { return aiSuggestion; }
    public void setAiSuggestion(String aiSuggestion) { this.aiSuggestion = aiSuggestion; }
}
