// 百工谱 — Consul 服务发现配置

package com.baigon.user.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Consul 配置类
 * 服务注册通过 application.yml 中的 spring.cloud.consul.discovery 自动完成
 */
@Configuration
public class ConsulConfig {

    /**
     * 支持 Consul 服务发现负载均衡的 RestTemplate
     * 用于服务间 HTTP 调用（如有需要）
     */
    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
