// 百工谱 — 需要向量化的实体公共字段
package com.baigon.occupation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/** 专业与职业共享的记录级向量化元数据。 */
@MappedSuperclass
public abstract class BaseEmbedEntity extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "embedding_status", nullable = false, columnDefinition = "task_status")
    private EmbeddingStatus embeddingStatus = EmbeddingStatus.PENDING;

    @Column(name = "embedding_attempts", nullable = false)
    private Integer embeddingAttempts = 0;

    @Column(name = "embedding_next_retry_at")
    private OffsetDateTime embeddingNextRetryAt;

    @Column(name = "embedding_error")
    private String embeddingError;

    public EmbeddingStatus getEmbeddingStatus() { return embeddingStatus; }
    public void setEmbeddingStatus(EmbeddingStatus embeddingStatus) { this.embeddingStatus = embeddingStatus; }
    public Integer getEmbeddingAttempts() { return embeddingAttempts; }
    public void setEmbeddingAttempts(Integer embeddingAttempts) { this.embeddingAttempts = embeddingAttempts; }
    public OffsetDateTime getEmbeddingNextRetryAt() { return embeddingNextRetryAt; }
    public void setEmbeddingNextRetryAt(OffsetDateTime embeddingNextRetryAt) { this.embeddingNextRetryAt = embeddingNextRetryAt; }
    public String getEmbeddingError() { return embeddingError; }
    public void setEmbeddingError(String embeddingError) { this.embeddingError = embeddingError; }
}
