// 百工谱 — 专业类实体
package com.baigon.occupation.entity.major;

import com.baigon.occupation.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "major_categories")
public class MajorCategory extends BaseEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "discipline_category_id", nullable = false)
    private Long disciplineCategoryId;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getDisciplineCategoryId() { return disciplineCategoryId; }
    public void setDisciplineCategoryId(Long disciplineCategoryId) { this.disciplineCategoryId = disciplineCategoryId; }
}
