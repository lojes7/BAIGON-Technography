// 百工谱 — MinIO 单例客户端配置测试
package com.baigon.occupation.config;

import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.test.context.support.TestPropertySourceUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class MinioConfigTest {

    @Test
    void minioClientShouldHaveOnlyOneSingletonBean() {
        try (AnnotationConfigApplicationContext context =
                     new AnnotationConfigApplicationContext()) {
            TestPropertySourceUtils.addInlinedPropertiesToEnvironment(
                    context,
                    "minio.endpoint=http://localhost:9000",
                    "minio.access-key=admin",
                    "minio.secret-key=12345678",
                    "minio.region=us-east-1");
            context.register(MinioConfig.class);
            context.refresh();

            assertEquals(1, context.getBeansOfType(MinioClient.class).size());
            assertSame(context.getBean(MinioClient.class), context.getBean(MinioClient.class));
        }
    }
}
