package com.baigon.university.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 健康检查端点
 * <p>
 * 供 Consul 定期探测，也用于运维监控。
 * 返回 JSON 格式的服务状态信息。
 * </p>
 */
@RestController
public class HealthController {

    private static final String SERVICE_NAME = "university_service";
    private static final String VERSION = "0.1.0";

    /**
     * GET /health — 返回服务健康状态
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", SERVICE_NAME);
        body.put("status", "healthy");
        body.put("time", Instant.now().toString());
        body.put("version", VERSION);
        return ResponseEntity.ok(body);
    }
}
