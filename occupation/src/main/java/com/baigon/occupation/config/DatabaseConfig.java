// 百工谱 — 数据库配置

package com.baigon.occupation.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * JPA + 事务管理配置
 * 数据源连接参数在 application.yml 中通过 spring.datasource 配置
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.baigon.occupation.repository")
@EnableTransactionManagement
public class DatabaseConfig {
    // JPA Repository 自动扫描 com.baigon.occupation.repository 包
}
