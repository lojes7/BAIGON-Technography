// 百工谱 — 规范技能之间的有向父子关系实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "skill_relations")
public class SkillRelation extends BaseEntity {

    @Column(name = "parent_skill_id", nullable = false)
    private Long parentSkillId;

    @Column(name = "child_skill_id", nullable = false)
    private Long childSkillId;

    public Long getParentSkillId() { return parentSkillId; }
    public void setParentSkillId(Long parentSkillId) { this.parentSkillId = parentSkillId; }
    public Long getChildSkillId() { return childSkillId; }
    public void setChildSkillId(Long childSkillId) { this.childSkillId = childSkillId; }
}
