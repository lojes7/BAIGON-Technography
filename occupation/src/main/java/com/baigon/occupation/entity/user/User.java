// 百工谱 — 用户实体，映射 occupation 合并数据库的 users 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    /** 登录账号（唯一）。 */
    @Column(name = "uid", nullable = false, length = 16)
    private String uid;

    /** 显示名称。 */
    @Column(name = "name", nullable = false, length = 8)
    private String name;

    /** bcrypt 密码哈希。 */
    @Column(name = "password", nullable = false, length = 64)
    private String password;

    /** 用户角色，按 PostgreSQL 原生枚举写入。 */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false, columnDefinition = "role")
    private Role role;

    /** 账号状态，按 PostgreSQL 原生枚举写入。 */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "user_status")
    private UserStatus status;

    /** 校园归属直接保存在 users；非校园角色保持为 NULL。 */
    @Column(name = "university_id")
    private Long universityId;

    @Column(name = "school_id")
    private Long schoolId;

    @Column(name = "department_id")
    private Long departmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "university_id", insertable = false, updatable = false)
    private University university;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", insertable = false, updatable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", insertable = false, updatable = false)
    private Department department;

    public enum Role {
        STUDENT,
        TEACHER,
        STUDENT_AFFAIR,
        DATA_ANALYST,
        DATA_REVIEWER,
        ADMIN,
        CIVILIAN
    }

    public enum UserStatus {
        NORMAL,
        LOCKED
    }

    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public UserStatus getStatus() { return status; }
    public void setStatus(UserStatus status) { this.status = status; }
    
    public Long getUniversityId() { return universityId; }
    public void setUniversityId(Long universityId) { this.universityId = universityId; }
    public Long getSchoolId() { return schoolId; }
    public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }
    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long departmentId) { this.departmentId = departmentId; }
    public University getUniversity() { return university; }
    public void setUniversity(University university) { this.university = university; }
    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }
    public Department getDepartment() { return department; }
    public void setDepartment(Department department) { this.department = department; }
}
