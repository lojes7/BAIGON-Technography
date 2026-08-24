// 百工谱 — 全局规范技能实体
package com.baigon.occupation.entity.skill;

import com.baigon.occupation.entity.BaseEmbedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "skills")
public class Skill extends BaseEmbedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
