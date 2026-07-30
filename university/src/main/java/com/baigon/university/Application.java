package com.baigon.university;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * 百工谱 — 院校服务主启动类
 * <p>
 * 负责院校专业管理、课程能力覆盖分析、培养方案评估等核心业务。
 * 通过 Consul 进行服务注册与发现，对外同时暴露 REST 和 gRPC 接口。
 * </p>
 */
@SpringBootApplication
@EnableDiscoveryClient
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
