// 百工谱 — 专业实体
package com.baigon.occupation.entity.major;

import com.baigon.occupation.entity.BaseEmbedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "majors")
public class Major extends BaseEmbedEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "major_category_id", nullable = false)
    private Long majorCategoryId;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getMajorCategoryId() { return majorCategoryId; }
    public void setMajorCategoryId(Long majorCategoryId) { this.majorCategoryId = majorCategoryId; }
}
