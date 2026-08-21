// 百工谱 — 单例 MinIO 客户端下的公开地址签名测试
package com.baigon.occupation.service.user.resume;

import io.minio.BucketExistsArgs;
import io.minio.MinioClient;
import okhttp3.HttpUrl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MinioResumeObjectStorageTest {

    @Test
    void shouldSignPublicUploadUrlWithoutCreatingAnotherMinioClient() throws Exception {
        MinioClient minioClient = mock(MinioClient.class);
        when(minioClient.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);
        MinioResumeObjectStorage storage = new MinioResumeObjectStorage(
                minioClient,
                "resumes",
                "http://localhost:9000",
                "admin",
                "12345678",
                "us-east-1");

        HttpUrl uploadUrl = HttpUrl.get(storage.createPresignedPutUrl(
                "users/7/resumes/101.pdf", 600));

        assertTrue(uploadUrl.toString().startsWith(
                "http://localhost:9000/resumes/users/7/resumes/101.pdf?"));
        assertEquals("host", uploadUrl.queryParameter("X-Amz-SignedHeaders"));
    }
}
