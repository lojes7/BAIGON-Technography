// 百工谱 — 职业实体
package com.baigon.occupation.entity.occupation;

import com.baigon.occupation.entity.BaseEmbedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "occupations")
public class Occupation extends BaseEmbedEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "occupation_category_id", nullable = false)
    private Long occupationCategoryId;

    @Column(name = "description")
    private String description;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getOccupationCategoryId() { return occupationCategoryId; }
    public void setOccupationCategoryId(Long occupationCategoryId) { this.occupationCategoryId = occupationCategoryId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
