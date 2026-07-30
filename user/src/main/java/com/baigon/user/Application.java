// 百工谱 — user_service 主入口

package com.baigon.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient  // 启用 Consul 服务发现
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
