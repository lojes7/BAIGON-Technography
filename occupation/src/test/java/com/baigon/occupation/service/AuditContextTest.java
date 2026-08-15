// 百工谱 — 审计上下文统一构造测试
package com.baigon.occupation.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AuditContextTest {

    @Test
    void fromShouldParseStringTraceIdAndNormalizeNullableFields() {
        AuditContext audit = AuditContext.from("9001", 7L, null, null, null, null);

        assertEquals(9001L, audit.traceId());
        assertEquals("system", audit.userName());
        assertEquals("", audit.userIp());
        assertEquals("", audit.requestMethod());
        assertEquals("", audit.requestUrl());
    }

    @Test
    void fromShouldTreatInvalidTraceIdAsEmpty() {
        assertNull(AuditContext.from("invalid", 7L, "reviewer", "", "GET", "/test")
                .traceId());
    }

    @Test
    void withTraceIdShouldKeepRequestAndUserContext() {
        AuditContext requestAudit = AuditContext.from(
                8001L, 7L, "reviewer", "127.0.0.1", "GET", "/test");

        AuditContext businessAudit = requestAudit.withTraceId(9001L);

        assertEquals(9001L, businessAudit.traceId());
        assertEquals(requestAudit.userId(), businessAudit.userId());
        assertEquals(requestAudit.userName(), businessAudit.userName());
        assertEquals(requestAudit.requestUrl(), businessAudit.requestUrl());
    }
}
