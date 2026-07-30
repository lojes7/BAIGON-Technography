package com.baigon.file.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 健康检查端点
 * <p>
 * Consul 通过此端点探测服务健康状态，
 * 同时可用于人工排查与监控集成。
 * </p>
 */
@RestController
public class HealthController {

    /**
     * 返回服务健康状态 JSON
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("service", "file_service");
        result.put("status", "healthy");
        result.put("time", Instant.now().toString());
        result.put("version", "0.1.0");
        return ResponseEntity.ok(result);
    }
}
