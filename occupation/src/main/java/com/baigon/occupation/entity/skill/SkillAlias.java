// 百工谱 — 原始技能文本与全局规范技能的别名映射实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "skill_aliases")
public class SkillAlias extends BaseEntity {

    @Column(name = "trace_id", nullable = false)
    private Long traceId;
    @Column(name = "skill_id", nullable = false)
    private Long skillId;
    @Column(name = "alias_name", nullable = false, length = 100)
    private String aliasName;
    @Column(name = "reviewed_at", nullable = false)
    private OffsetDateTime reviewedAt;
    @Column(name = "reviewed_by", nullable = false)
    private Long reviewedBy;

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public String getAliasName() { return aliasName; }
    public void setAliasName(String aliasName) { this.aliasName = aliasName; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(OffsetDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
}
