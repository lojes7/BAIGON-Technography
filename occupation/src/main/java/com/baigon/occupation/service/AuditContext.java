// 百工谱 — gateway 透传的用户审计上下文
package com.baigon.occupation.service;

/** 后台任务启动后仍使用启动请求捕获的用户上下文写日志和调用 AI。 */
public record AuditContext(
        Long traceId,
        long userId,
        String userName,
        String userIp,
        String requestMethod,
        String requestUrl
) {
    public AuditContext {
        userName = userName == null || userName.isBlank() ? "system" : userName;
        userIp = userIp == null ? "" : userIp;
        requestMethod = requestMethod == null ? "" : requestMethod;
        requestUrl = requestUrl == null ? "" : requestUrl;
    }

    /** 从 gRPC 请求字段统一创建审计上下文，非法 trace_id 按空值处理。 */
    public static AuditContext from(String traceId,
                                    long userId,
                                    String userName,
                                    String userIp,
                                    String requestMethod,
                                    String requestUrl) {
        return from(parseTraceId(traceId), userId, userName, userIp, requestMethod, requestUrl);
    }

    /** 从已经解析的 trace_id 创建审计上下文。 */
    public static AuditContext from(Long traceId,
                                    long userId,
                                    String userName,
                                    String userIp,
                                    String requestMethod,
                                    String requestUrl) {
        return new AuditContext(traceId, userId, userName, userIp, requestMethod, requestUrl);
    }

    /** 保留用户与请求信息，只替换为业务记录的 trace_id。 */
    public AuditContext withTraceId(Long businessTraceId) {
        return from(businessTraceId, userId, userName, userIp, requestMethod, requestUrl);
    }

    private static Long parseTraceId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
