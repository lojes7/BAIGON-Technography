// 百工谱 — 用户实体
// 映射 user_service 数据库的 users 表

package com.baigon.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    private Long id;

    /** 登录账号（唯一） */
    @Column(name = "uid", nullable = false)
    private String uid;

    /** 显示名称 */
    @Column(name = "name", nullable = false)
    private String name;

    /** bcrypt 密码哈希 */
    @Column(name = "password", nullable = false)
    private String password;

    /** 角色 */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    /** 账号状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private UserStatus status;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** 软删除时间，非空表示已删除 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ==================== 枚举 ====================

    /** 角色（与 init.sql 中 role 枚举保持一致） */
    public enum Role {
        STUDENT, TEACHER, STUDENT_AFFAIR, DATA_ANALYST, DATA_REVIEWER, DATA_ENGINEER, ADMIN
    }

    /** 账号状态（与 init.sql 中 user_status 枚举保持一致） */
    public enum UserStatus {
        NORMAL, LOCKED
    }

    // ==================== getter / setter ====================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

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

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
