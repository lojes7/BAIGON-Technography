// 百工谱 — 系部实体，映射 departments 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "departments")
@SQLRestriction("deleted_at IS NULL")
public class Department extends BaseEntity {

    @Column(nullable = false, length = 32)
    private String name;
    
    @Column(name = "school_id", nullable=false)
    private Long schoolId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", insertable = false, updatable = false)
    private School school;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getSchoolId() { return schoolId; }
    public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }
    
    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }
}
