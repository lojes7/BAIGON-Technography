// 百工谱 — 用户实体，映射 occupation 合并数据库的 users 表
package com.baigon.occupation.entity.user;

import com.baigon.occupation.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    /** 登录账号（唯一）。 */
    @Column(name = "uid", nullable = false)
    private String uid;

    /** 显示名称。 */
    @Column(name = "name", nullable = false)
    private String name;

    /** bcrypt 密码哈希。 */
    @Column(name = "password", nullable = false)
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

    public enum Role {
        STUDENT,
        TEACHER,
        STUDENT_AFFAIR,
        DATA_ANALYST,
        DATA_REVIEWER,
        ADMIN
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
}
