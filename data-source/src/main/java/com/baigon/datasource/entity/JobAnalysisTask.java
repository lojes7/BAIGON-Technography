// 百工谱 — 岗位分析任务实体
// 映射 data_source_service 数据库的 job_analysis_tasks 表

package com.baigon.datasource.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "job_analysis_tasks")
public class JobAnalysisTask {

    @Id
    private Long id;

    /** 链路追踪 ID */
    @Column(name = "trace_id")
    private Long traceId;

    /** 使用的模型名称 */
    @Column(name = "model_name")
    private String modelName;

    /** 任务状态 */
    @Enumerated(EnumType.STRING)
    // @JdbcTypeCode(NAMED_ENUM)：Hibernate 6 按 PG 原生枚举绑定参数，否则报类型不匹配
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "task_status")
    private TaskStatus taskStatus;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** 软删除时间，非空表示已删除 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ==================== 枚举 ====================

    /** 任务状态（与 init.sql 中 task_status 枚举保持一致） */
    public enum TaskStatus {
        SUCCESS, FAILED, PENDING
    }

    // ==================== getter / setter ====================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }

    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }

    public TaskStatus getTaskStatus() { return taskStatus; }
    public void setTaskStatus(TaskStatus taskStatus) { this.taskStatus = taskStatus; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
