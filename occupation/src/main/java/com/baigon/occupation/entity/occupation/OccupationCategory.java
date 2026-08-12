// 百工谱 — 职业小类实体
package com.baigon.occupation.entity.occupation;

import com.baigon.occupation.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "occupation_categories")
public class OccupationCategory extends BaseEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "occupation_sub_category_id", nullable = false)
    private Long occupationSubCategoryId;

    @Column(name = "description")
    private String description;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getOccupationSubCategoryId() { return occupationSubCategoryId; }
    public void setOccupationSubCategoryId(Long occupationSubCategoryId) { this.occupationSubCategoryId = occupationSubCategoryId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
