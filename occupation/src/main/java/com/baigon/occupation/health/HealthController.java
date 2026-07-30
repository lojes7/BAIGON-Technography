// 百工谱 — 自定义健康检查端点

package com.baigon.occupation.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * 自定义健康检查（除 Actuator 外的额外端点）
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "service", "occupation_service",
                "status", "healthy",
                "time", Instant.now().toString(),
                "version", "0.1.0"
        );
    }
}
