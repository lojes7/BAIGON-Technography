// 百工谱 — 高校实体，映射 universities 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "universities")
@SQLRestriction("deleted_at IS NULL")
public class University extends BaseEntity {

    @Column(nullable = false, length = 32)
    private String name;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
