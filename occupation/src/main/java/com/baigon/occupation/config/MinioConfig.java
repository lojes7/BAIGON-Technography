// 百工谱 — MinIO 对象存储客户端配置
package com.baigon.occupation.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Bean
    public MinioClient minioClient(
            @Value("${minio.endpoint}") String endpoint,
            @Value("${minio.access-key}") String accessKey,
            @Value("${minio.secret-key}") String secretKey,
            @Value("${minio.region:us-east-1}") String region) {
        return MinioClient.builder()
                .endpoint(endpoint)
                .region(region)
                .credentials(accessKey, secretKey)
                .build();
    }
}
