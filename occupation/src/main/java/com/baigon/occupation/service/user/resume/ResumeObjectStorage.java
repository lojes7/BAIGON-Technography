// 百工谱 — 简历对象存储端口
package com.baigon.occupation.service.user.resume;

public interface ResumeObjectStorage {

    String createPresignedPutUrl(String objectKey, int expirySeconds);

    StoredObject read(String objectKey, long maxSizeBytes);

    void delete(String objectKey);

    String bucketName();

    record StoredObject(byte[] content, long size) {
    }
}
