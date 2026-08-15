// 百工谱 — 学院实体，映射 schools 表
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
@Table(name = "schools")
@SQLRestriction("deleted_at IS NULL")
public class School extends BaseEntity {

    @Column(nullable = false, length = 32)
    private String name;
    
    @Column(name = "university_id", nullable = false)
    private Long universityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "university_id", insertable = false, updatable = false)
    private University university;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getUniversityId() { return universityId; }
    public void setUniversityId(Long universityId) { this.universityId = universityId; }
    
    public University getUniversity() { return university; }
    public void setUniversity(University university) { this.university = university; }
}
