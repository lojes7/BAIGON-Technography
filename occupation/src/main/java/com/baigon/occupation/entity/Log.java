// 百工谱 — occupation 业务日志实体
package com.baigon.occupation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "logs")
public class Log extends BaseEntity {

    @Column(name = "trace_id")
    private Long traceId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "user_name", nullable = false)
    private String userName;
    @Column(name = "user_ip")
    private String userIp;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "level")
    private Level level;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "request_method")
    private RequestMethod requestMethod;

    @Column(name = "request_url")
    private String requestUrl;
    @Column(name = "error_msg")
    private String errorMsg;
    @Column(name = "detail")
    private String detail;
    public enum Level { INFO, ERROR, WARNING }
    public enum RequestMethod { GET, POST, PUT, DELETE }

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
}
