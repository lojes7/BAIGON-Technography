// 百工谱 — 专业与全局规范技能的归属关系实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "major_skills")
public class MajorSkill extends BaseEntity {

    @Column(name = "major_id", nullable = false)
    private Long majorId;
    @Column(name = "skill_id", nullable = false)
    private Long skillId;

    public Long getMajorId() { return majorId; }
    public void setMajorId(Long majorId) { this.majorId = majorId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
}
