// 百工谱 — 职业中类实体
package com.baigon.occupation.entity.occupation;

import com.baigon.occupation.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "occupation_sub_categories")
public class OccupationSubCategory extends BaseEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "occupation_major_category_id", nullable = false)
    private Long occupationMajorCategoryId;

    @Column(name = "description")
    private String description;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getOccupationMajorCategoryId() { return occupationMajorCategoryId; }
    public void setOccupationMajorCategoryId(Long occupationMajorCategoryId) { this.occupationMajorCategoryId = occupationMajorCategoryId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
