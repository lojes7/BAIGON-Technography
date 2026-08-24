// 百工谱 — 职业与全局规范技能的归属关系实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "occupation_skills")
public class OccupationSkill extends BaseEntity {

    @Column(name = "occupation_id", nullable = false)
    private Long occupationId;
    @Column(name = "skill_id", nullable = false)
    private Long skillId;

    public Long getOccupationId() { return occupationId; }
    public void setOccupationId(Long occupationId) { this.occupationId = occupationId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
}
