// 百工谱 — 日志实体
// 映射 user_service 数据库的 logs 表

package com.baigon.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "logs")
public class Log {

    @Id
    private Long id;

    /** 链路追踪 ID（gateway RequestID 雪花 ID） */
    @Column(name = "trace_id")
    private Long traceId;

    /** 操作用户 ID（gateway 从 JWT 透传；无用户上下文时填 0） */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 操作用户名（登录账号 uid） */
    @Column(name = "user_name", nullable = false)
    private String userName;

    /** 客户端 IP */
    @Column(name = "user_ip")
    private String userIp;

    /** 日志级别 */
    @Enumerated(EnumType.STRING)
    @Column(name = "level")
    private Level level;

    /** 请求方法 */
    @Enumerated(EnumType.STRING)
    @Column(name = "request_method")
    private RequestMethod requestMethod;

    /** 请求路径 */
    @Column(name = "request_url")
    private String requestUrl;

    /** 错误信息 */
    @Column(name = "error_msg")
    private String errorMsg;

    /** 附加详情 */
    @Column(name = "detail")
    private String detail;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** 软删除时间，非空表示已删除 */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ==================== 枚举 ====================

    /** 日志级别（与 init.sql 中 level 枚举保持一致） */
    public enum Level {
        INFO, ERROR, WARNING
    }

    /** 请求方法（与 init.sql 中 request_method 枚举保持一致） */
    public enum RequestMethod {
        GET, POST, PUT, DELETE
    }

    // ==================== getter / setter ====================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTraceId() { return traceId; }
    public void setTraceId(Long traceId) { this.traceId = traceId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserIp() { return userIp; }
    public void setUserIp(String userIp) { this.userIp = userIp; }

    public Level getLevel() { return level; }
    public void setLevel(Level level) { this.level = level; }

    public RequestMethod getRequestMethod() { return requestMethod; }
    public void setRequestMethod(RequestMethod requestMethod) { this.requestMethod = requestMethod; }

    public String getRequestUrl() { return requestUrl; }
    public void setRequestUrl(String requestUrl) { this.requestUrl = requestUrl; }

    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
