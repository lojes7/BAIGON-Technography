package com.baigon.file.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Consul 服务发现配置
 * 提供支持负载均衡的 RestTemplate（用于 REST 调用场景）
 */
@Configuration
public class ConsulConfig {

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
