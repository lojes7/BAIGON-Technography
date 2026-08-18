// 百工谱 — 用户简历直传、OCR 与查询业务层
package com.baigon.occupation.service.user.resume;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.user.UserRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final ResumeObjectStorage objectStorage;
    private final ResumeDocumentTextExtractor textExtractor;
    private final Snowflake snowflake;
    private final long maxFileSizeBytes;
    private final int uploadUrlExpirySeconds;

    public ResumeService(
            ResumeRepository resumeRepository,
            UserRepository userRepository,
            ResumeObjectStorage objectStorage,
            ResumeDocumentTextExtractor textExtractor,
            Snowflake snowflake,
            @Value("${resume.max-file-size-bytes:10485760}") long maxFileSizeBytes,
            @Value("${resume.upload-url-expiry-seconds:600}") int uploadUrlExpirySeconds) {
        if (maxFileSizeBytes < 1 || maxFileSizeBytes >= Integer.MAX_VALUE) {
            throw new IllegalArgumentException("invalid resume file size limit");
        }
        if (uploadUrlExpirySeconds < 60 || uploadUrlExpirySeconds > 604800) {
            throw new IllegalArgumentException("invalid resume upload URL expiry");
        }
        this.resumeRepository = resumeRepository;
        this.userRepository = userRepository;
        this.objectStorage = objectStorage;
        this.textExtractor = textExtractor;
        this.snowflake = snowflake;
        this.maxFileSizeBytes = maxFileSizeBytes;
        this.uploadUrlExpirySeconds = uploadUrlExpirySeconds;
    }

    public ResumeUploadData createUpload(long userId, String originalFileName, long declaredSize) {
        String fileName = validateMetadata(userId, originalFileName, declaredSize);
        requireUser(userId);

        ResumeDocumentTextExtractor.DocumentType documentType =
                ResumeDocumentTextExtractor.DocumentType.fromFileName(fileName);
        long uploadId = snowflake.nextId();
        String objectKey = objectKey(userId, uploadId, documentType);
        String uploadUrl = objectStorage.createPresignedPutUrl(
                objectKey, uploadUrlExpirySeconds);
        return new ResumeUploadData(
                uploadId,
                uploadUrl,
                "PUT",
                documentType.contentType(),
                OffsetDateTime.now().plusSeconds(uploadUrlExpirySeconds));
    }

    @Transactional
    public ResumeData completeUpload(long userId, long uploadId, String originalFileName) {
        if (uploadId <= 0) {
            throw new IllegalArgumentException("upload_id must be > 0");
        }
        String fileName = validateFileName(userId, originalFileName);
        requireUser(userId);

        // 完成接口允许安全重试，已落库时不重复 OCR，也不会误删已归档对象。
        var existing = resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(uploadId, userId);
        if (existing.isPresent()) {
            return toData(existing.get());
        }

        ResumeDocumentTextExtractor.DocumentType documentType =
                ResumeDocumentTextExtractor.DocumentType.fromFileName(fileName);
        String objectKey = objectKey(userId, uploadId, documentType);
        ResumeObjectStorage.StoredObject storedObject;
        try {
            // 文件由浏览器直传，必须以后端读取到的真实对象大小为准。
            storedObject = objectStorage.read(objectKey, maxFileSizeBytes);
        } catch (ApiException exception) {
            if (exception.getErrorCode() == ApiException.ErrorCode.BAD_REQUEST) {
                objectStorage.delete(objectKey);
            }
            throw exception;
        }

        try {
            OffsetDateTime now = OffsetDateTime.now();
            Resume resume = new Resume();
            resume.setId(uploadId);
            resume.setCreatedAt(now);
            resume.setUpdatedAt(now);
            resume.setUserId(userId);
            resume.setFileKey(objectKey);
            resume.setBucketName(objectStorage.bucketName());
            resume.setFileName(fileName);
            resume.setFileSize(storedObject.size());
            resume.setMd5(md5(storedObject.content()));
            resume.setReviewStatus(ReviewStatus.PENDING);

            // 先建立记录，再同步 OCR 回写 content；事务提交后外部才可见完整结果。
            resumeRepository.saveAndFlush(resume);
            resume.setContent(textExtractor.extract(fileName, storedObject.content()));
            resume.setUpdatedAt(OffsetDateTime.now());
            Resume saved = resumeRepository.saveAndFlush(resume);
            return toData(saved);
        } catch (DataIntegrityViolationException exception) {
            // 并发完成同一 upload_id 时，另一事务可能已成功引用该对象，不能误删。
            throw exception;
        } catch (RuntimeException exception) {
            objectStorage.delete(objectKey);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public Optional<ResumeData> getMyResume(long userId) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        return resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId).map(this::toData);
    }

    private String validateMetadata(long userId, String fileName, long declaredSize) {
        String normalizedName = validateFileName(userId, fileName);
        if (declaredSize <= 0) {
            throw new IllegalArgumentException("resume file is empty");
        }
        if (declaredSize > maxFileSizeBytes) {
            throw new IllegalArgumentException("resume file exceeds size limit");
        }
        return normalizedName;
    }

    private String validateFileName(long userId, String fileName) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        String normalizedName = normalizeFileName(fileName);
        if (normalizedName.isBlank() || normalizedName.length() > 255) {
            throw new IllegalArgumentException("invalid file name");
        }
        ResumeDocumentTextExtractor.DocumentType.fromFileName(normalizedName);
        return normalizedName;
    }

    private void requireUser(long userId) {
        if (!userRepository.existsByIdAndDeletedAtIsNull(userId)) {
            throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "user not found");
        }
    }

    private String normalizeFileName(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replace('\\', '/');
        int separator = normalized.lastIndexOf('/');
        return (separator >= 0 ? normalized.substring(separator + 1) : normalized).strip();
    }

    private String objectKey(long userId,
                             long uploadId,
                             ResumeDocumentTextExtractor.DocumentType documentType) {
        return "users/%d/resumes/%d%s".formatted(
                userId, uploadId, documentType.extension());
    }

    private String md5(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            return HexFormat.of().formatHex(digest.digest(content));
        } catch (NoSuchAlgorithmException exception) {
            // JDK 必须提供 MD5；若运行时异常缺失则终止本次事务。
            throw new IllegalStateException("MD5 unavailable", exception);
        }
    }

    private ResumeData toData(Resume resume) {
        return new ResumeData(
                resume.getId(),
                resume.getFileName(),
                resume.getFileSize(),
                resume.getContent(),
                resume.getCreatedAt());
    }

    public record ResumeUploadData(
            long uploadId,
            String uploadUrl,
            String method,
            String contentType,
            OffsetDateTime expiresAt) {
    }

    public record ResumeData(
            long id,
            String fileName,
            long fileSize,
            String content,
            OffsetDateTime createdAt) {
    }
}
