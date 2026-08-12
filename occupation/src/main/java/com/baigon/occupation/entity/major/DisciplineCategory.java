// 百工谱 — 学科门类实体
package com.baigon.occupation.entity.major;

import com.baigon.occupation.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "discipline_categories")
public class DisciplineCategory extends BaseEntity {

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
