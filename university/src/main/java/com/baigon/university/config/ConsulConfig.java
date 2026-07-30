package com.baigon.university.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Consul 服务发现配置
 * <p>
 * 提供支持客户端负载均衡的 RestTemplate，
 * 在需要通过 HTTP 调用其他微服务时使用。
 * </p>
 */
@Configuration
public class ConsulConfig {

    /**
     * 启用 @LoadBalanced 的 RestTemplate，
     * 调用时可用服务名代替 IP:端口，由 Consul + Ribbon 自动解析。
     */
    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
