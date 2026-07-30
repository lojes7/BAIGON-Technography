package com.baigon.university.config;

import net.devh.boot.grpc.server.config.GrpcServerProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * gRPC 服务端配置
 * <p>
 * 从 application.yml 中 grpc.server.port 读取端口，
 * 默认 50056，与其他微服务（user_service、occupation_service 等）区分开。
 * </p>
 */
@Configuration
public class GrpcServerConfig {

    /**
     * 显式注册 gRPC 服务端属性 Bean，
     * 使 grpc.server.port 配置项被 spring-boot-starter-grpc 正确识别。
     */
    @Bean
    @ConfigurationProperties(prefix = "grpc.server")
    public GrpcServerProperties grpcServerProperties() {
        return new GrpcServerProperties();
    }
}
