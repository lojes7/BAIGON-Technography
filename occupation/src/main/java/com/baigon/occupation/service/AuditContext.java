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
}
