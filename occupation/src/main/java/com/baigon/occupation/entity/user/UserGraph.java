// 百工谱 — 用户能力图谱实体，映射 user_graphs 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_graphs")
public class UserGraph extends BaseEntity {

    @Column(name = "trace_id")
    private Long traceId;
    @Column(name = "user_id")
    private Long userId;
    @Column(name = "ability_id")
    private Long abilityId;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "proficiency")
    private Proficiency proficiency;

    public enum Proficiency {
        EXPERT,
        SKILLED,
        FAMILIAR,
        BASIC
    }

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getAbilityId() { return abilityId; }
    public void setAbilityId(Long abilityId) { this.abilityId = abilityId; }
    public Proficiency getProficiency() { return proficiency; }
    public void setProficiency(Proficiency proficiency) { this.proficiency = proficiency; }
}
