// 百工谱 — 成绩实体，映射 grades 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnTransformer;

@Entity
@Table(name = "grades")
public class Grade extends BaseEntity {

    @Column(name = "user_id")
    private Long userId;
    @Column(name = "course_name", length = 64)
    private String courseName;
    @Column(length = 8)
    private String score;

    /** PostgreSQL semester 的值为 1..8，写入时显式转换为原生枚举。 */
    @Column(columnDefinition = "semester")
    @ColumnTransformer(write = "?::semester")
    private String semester;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }
    public String getScore() { return score; }
    public void setScore(String score) { this.score = score; }
    public String getSemester() { return semester; }
    public void setSemester(String semester) { this.semester = semester; }
}
