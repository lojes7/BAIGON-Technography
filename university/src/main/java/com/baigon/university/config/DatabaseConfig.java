package com.baigon.university.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * JPA 持久层配置
 * <p>
 * 指定 Spring Data JPA 扫描 com.baigon.university.repository 包下的所有 Repository 接口。
 * 各服务使用独立的 PostgreSQL 数据库（baigon_university），通过不同的连接用户确保隔离。
 * </p>
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.baigon.university.repository")
public class DatabaseConfig {
}
