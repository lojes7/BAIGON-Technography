package com.baigon.file.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * JPA 数据库配置
 * 指定 Repository 扫描路径
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.baigon.file.repository")
public class DatabaseConfig {
}
