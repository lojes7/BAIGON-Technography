// 百工谱 — MinIO 简历对象存储实现
package com.baigon.occupation.service.user.resume;

import com.baigon.occupation.error.ApiException;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.Signer;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.Time;
import io.minio.errors.ErrorResponseException;
import okhttp3.HttpUrl;
import okhttp3.Request;
import okhttp3.RequestBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.ZonedDateTime;

@Component
public class MinioResumeObjectStorage implements ResumeObjectStorage {

    private static final Logger logger = LoggerFactory.getLogger(MinioResumeObjectStorage.class);

    private final MinioClient minioClient;
    private final String bucketName;
    private final String publicEndpoint;
    private final String accessKey;
    private final String secretKey;
    private final String region;
    private volatile boolean bucketReady;

    public MinioResumeObjectStorage(
            MinioClient minioClient,
            @Value("${minio.resume-bucket}") String bucketName,
            @Value("${minio.public-endpoint}") String publicEndpoint,
            @Value("${minio.access-key}") String accessKey,
            @Value("${minio.secret-key}") String secretKey,
            @Value("${minio.region:us-east-1}") String region) {
        this.minioClient = minioClient;
        this.bucketName = bucketName;
        this.publicEndpoint = publicEndpoint;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.region = region;
    }

    @Override
    public String createPresignedPutUrl(String objectKey, int expirySeconds) {
        try {
            ensureBucketExists();
            HttpUrl uploadUrl = HttpUrl.get(publicEndpoint).newBuilder()
                    .addPathSegment(bucketName)
                    .addPathSegments(objectKey)
                    .build();
            Request request = new Request.Builder()
                    .url(uploadUrl)
                    // Host 是 SigV4 预签名的必签头，非默认端口也必须参与签名。
                    .header("Host", hostHeader(uploadUrl))
                    .header("x-amz-date", ZonedDateTime.now(Time.UTC)
                            .format(Time.AMZ_DATE_FORMAT))
                    .put(RequestBody.create(new byte[0]))
                    .build();
            // 公开地址仅参与签名；所有 MinIO 网络操作仍复用 Spring 单例客户端。
            return Signer.presignV4(
                    request, region, accessKey, secretKey, expirySeconds).toString();
        } catch (Exception exception) {
            logger.error("生成 MinIO 简历上传地址失败，objectKey={}", objectKey, exception);
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "resume storage unavailable");
        }
    }

    private static String hostHeader(HttpUrl url) {
        String host = url.host();
        if (host.contains(":")) {
            host = "[" + host + "]";
        }
        int defaultPort = "https".equals(url.scheme()) ? 443 : 80;
        return url.port() == defaultPort ? host : host + ":" + url.port();
    }

    @Override
    public StoredObject read(String objectKey, long maxSizeBytes) {
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectKey)
                    .build());
            if (stat.size() <= 0) {
                throw new ApiException(
                        ApiException.ErrorCode.BAD_REQUEST,
                        "resume file is empty");
            }
            if (stat.size() > maxSizeBytes) {
                throw new ApiException(
                        ApiException.ErrorCode.BAD_REQUEST,
                        "resume file exceeds size limit");
            }

            try (GetObjectResponse input = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectKey)
                    .build())) {
                byte[] content = input.readNBytes(Math.toIntExact(maxSizeBytes + 1));
                if (content.length > maxSizeBytes) {
                    throw new ApiException(
                            ApiException.ErrorCode.BAD_REQUEST,
                            "resume file exceeds size limit");
                }
                if (content.length != stat.size()) {
                    throw new IOException("resume object size changed while reading");
                }
                return new StoredObject(content, stat.size());
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (ErrorResponseException exception) {
            String code = exception.errorResponse().code();
            if ("NoSuchKey".equals(code) || "NoSuchObject".equals(code)) {
                throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "resume upload not found");
            }
            logger.error("读取 MinIO 简历对象失败，objectKey={}", objectKey, exception);
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "resume storage unavailable");
        } catch (Exception exception) {
            logger.error("读取 MinIO 简历对象失败，objectKey={}", objectKey, exception);
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "resume storage unavailable");
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectKey)
                    .build());
        } catch (Exception exception) {
            // 清理失败不能覆盖原始业务异常，保留对象键便于运维定位。
            logger.error("清理 MinIO 简历对象失败，objectKey={}", objectKey, exception);
        }
    }

    @Override
    public String bucketName() {
        return bucketName;
    }

    private synchronized void ensureBucketExists() throws Exception {
        if (bucketReady) {
            return;
        }
        if (!minioClient.bucketExists(BucketExistsArgs.builder()
                .bucket(bucketName)
                .build())) {
            try {
                minioClient.makeBucket(MakeBucketArgs.builder()
                        .bucket(bucketName)
                        .build());
            } catch (ErrorResponseException exception) {
                String code = exception.errorResponse().code();
                // 多实例首次签发地址时可能同时创建 bucket，已存在则视为成功。
                if (!"BucketAlreadyOwnedByYou".equals(code)
                        && !"BucketAlreadyExists".equals(code)) {
                    throw exception;
                }
            }
        }
        bucketReady = true;
    }
}
