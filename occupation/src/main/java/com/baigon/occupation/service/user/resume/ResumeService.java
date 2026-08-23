// 百工谱 — 用户简历直传、OCR 与查询业务层
package com.baigon.occupation.service.user.resume;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import com.baigon.occupation.entity.user.resume.ResumeSource;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.ai.AIAnalysisException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.user.UserRepository;
import com.baigon.occupation.repository.user.analysis.UserAnalysisTaskRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.user.resume.analysis.ResumeAnalysisResult;
import com.baigon.occupation.service.user.resume.analysis.ResumeAnalysisValidator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class ResumeService {

    private static final int MAX_CONTENT_LENGTH = 50_000;

    private final ResumeRepository resumeRepository;
    private final UserAnalysisTaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ResumeObjectStorage objectStorage;
    private final ResumeDocumentTextExtractor textExtractor;
    private final AIGrpcClient aiGrpcClient;
    private final ResumeAnalysisValidator analysisValidator;
    private final Snowflake snowflake;
    private final TransactionOperations transactions;
    private final long maxFileSizeBytes;
    private final int uploadUrlExpirySeconds;

    public ResumeService(
            ResumeRepository resumeRepository,
            UserAnalysisTaskRepository taskRepository,
            UserRepository userRepository,
            ResumeObjectStorage objectStorage,
            ResumeDocumentTextExtractor textExtractor,
            AIGrpcClient aiGrpcClient,
            ResumeAnalysisValidator analysisValidator,
            Snowflake snowflake,
            @Qualifier("userAnalysisTransactionOperations") TransactionOperations transactions,
            @Value("${resume.max-file-size-bytes:10485760}") long maxFileSizeBytes,
            @Value("${resume.upload-url-expiry-seconds:600}") int uploadUrlExpirySeconds) {
        if (maxFileSizeBytes < 1 || maxFileSizeBytes >= Integer.MAX_VALUE) {
            throw new IllegalArgumentException("invalid resume file size limit");
        }
        if (uploadUrlExpirySeconds < 60 || uploadUrlExpirySeconds > 604800) {
            throw new IllegalArgumentException("invalid resume upload URL expiry");
        }
        this.resumeRepository = resumeRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.objectStorage = objectStorage;
        this.textExtractor = textExtractor;
        this.aiGrpcClient = aiGrpcClient;
        this.analysisValidator = analysisValidator;
        this.snowflake = snowflake;
        this.transactions = transactions;
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

    public ResumeData completeUpload(
            long userId,
            long uploadId,
            String originalFileName,
            AuditContext audit) {
        if (uploadId <= 0) {
            throw new IllegalArgumentException("upload_id must be > 0");
        }
        String fileName = validateFileName(userId, originalFileName);
        requireUser(userId);

        // 完成接口允许安全重试；旧记录只有 OCR 正文时会补做结构化分析。
        var existing = resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(uploadId, userId);
        if (existing.isPresent()) {
            return completeExisting(existing.get(), audit);
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

        String content;
        try {
            content = textExtractor.extract(fileName, storedObject.content());
        } catch (RuntimeException exception) {
            objectStorage.delete(objectKey);
            throw exception;
        }

        PreparedResumeAnalysis prepared;
        try {
            prepared = prepareNewResumeAnalysis(
                    userId, uploadId, fileName, objectKey, storedObject, audit);
        } catch (DataIntegrityViolationException exception) {
            // 并发完成同一 upload_id 时，另一事务可能已成功引用该对象，不能误删。
            throw exception;
        } catch (RuntimeException exception) {
            objectStorage.delete(objectKey);
            throw exception;
        }
        return executeResumeAnalysis(prepared, content, objectKey, true);
    }

    @Transactional(readOnly = true)
    public Optional<ResumeData> getMyResume(long userId) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        return resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId).map(this::toData);
    }

    /** 保存用户人工编辑的新版本；该记录不继承任何 MinIO 文件元数据。 */
    @Transactional
    public ResumeData editMyResume(long userId, String content, String fieldsJson) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        if (content != null && content.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("resume content exceeds length limit");
        }
        requireUser(userId);
        ResumeAnalysisResult analysis = analysisValidator.parseEdited(fieldsJson);

        OffsetDateTime now = OffsetDateTime.now();
        Resume resume = new Resume();
        resume.setId(snowflake.nextId());
        resume.setCreatedAt(now);
        resume.setUpdatedAt(now);
        resume.setUserId(userId);
        resume.setContent(content);
        resume.setSource(ResumeSource.EDITED);
        resume.setReviewStatus(ReviewStatus.PENDING);
        applyAnalysis(resume, analysis);

        return toData(resumeRepository.saveAndFlush(resume));
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

    private ResumeData completeExisting(Resume resume, AuditContext audit) {
        if (isFullyAnalyzed(resume)) {
            return toData(resume);
        }

        String content = resume.getContent();
        if (content == null || content.isBlank()) {
            ResumeObjectStorage.StoredObject storedObject = objectStorage.read(
                    resume.getFileKey(), maxFileSizeBytes);
            content = textExtractor.extract(resume.getFileName(), storedObject.content());
        }
        PreparedResumeAnalysis prepared = prepareExistingResumeAnalysis(resume, audit);
        return executeResumeAnalysis(prepared, content, resume.getFileKey(), false);
    }

    /** OCR 完成后先原子创建简历占位记录和 PENDING 分析任务，再调用远程 LLM。 */
    private PreparedResumeAnalysis prepareNewResumeAnalysis(
            long userId,
            long uploadId,
            String fileName,
            String objectKey,
            ResumeObjectStorage.StoredObject storedObject,
            AuditContext audit) {
        PreparedResumeAnalysis prepared = transactions.execute(ignored -> {
            OffsetDateTime now = OffsetDateTime.now();
            Resume resume = new Resume();
            resume.setId(uploadId);
            resume.setCreatedAt(now);
            resume.setUpdatedAt(now);
            // LLM 完成前保持软删除，避免查询接口暴露尚未分析完成的占位记录。
            resume.setDeletedAt(now);
            resume.setUserId(userId);
            resume.setFileKey(objectKey);
            resume.setBucketName(objectStorage.bucketName());
            resume.setFileName(fileName);
            resume.setFileSize(storedObject.size());
            resume.setMd5(md5(storedObject.content()));
            resume.setSource(ResumeSource.SYSTEM);
            resume.setReviewStatus(ReviewStatus.PENDING);
            resume.setEducationExperiences(analysisValidator.emptyArray());
            resume.setWorkExperiences(analysisValidator.emptyArray());
            resume.setProjectExperiences(analysisValidator.emptyArray());
            resume.setProfessionalSkills(analysisValidator.emptyArray());
            resume.setAwards(analysisValidator.emptyArray());
            resumeRepository.saveAndFlush(resume);
            return new PreparedResumeAnalysis(
                    createResumeAnalysisTask(resume, audit, now), resume.getId());
        });
        if (prepared == null) {
            throw new IllegalStateException("prepare resume analysis returned no result");
        }
        return prepared;
    }

    /** 旧简历补分析时同样先创建独立任务，失败不会改写原简历。 */
    private PreparedResumeAnalysis prepareExistingResumeAnalysis(
            Resume resume,
            AuditContext audit) {
        PreparedResumeAnalysis prepared = transactions.execute(ignored -> {
            Resume active = resumeRepository
                    .findByIdAndUserIdAndDeletedAtIsNull(resume.getId(), resume.getUserId())
                    .orElseThrow(() -> new IllegalStateException("resume not found"));
            OffsetDateTime now = OffsetDateTime.now();
            return new PreparedResumeAnalysis(
                    createResumeAnalysisTask(active, audit, now), active.getId());
        });
        if (prepared == null) {
            throw new IllegalStateException("prepare existing resume analysis returned no result");
        }
        return prepared;
    }

    private long createResumeAnalysisTask(
            Resume resume,
            AuditContext audit,
            OffsetDateTime now) {
        long taskId = snowflake.nextId();
        UserAnalysisTask task = new UserAnalysisTask();
        task.setId(taskId);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        task.setTraceId(
                audit != null && audit.traceId() != null ? audit.traceId() : taskId);
        task.setUserId(resume.getUserId());
        task.setResumeId(resume.getId());
        task.setTaskType(UserAnalysisType.RESUME_EXTRACTION);
        task.setTaskStatus(TaskStatus.PENDING);
        taskRepository.saveAndFlush(task);
        return taskId;
    }

    private ResumeData executeResumeAnalysis(
            PreparedResumeAnalysis prepared,
            String content,
            String objectKey,
            boolean deleteResumeOnFailure) {
        AIGrpcClient.ResumeAnalysisResult aiResult;
        ResumeAnalysisResult analysis;
        String sourceLlmResponse = null;
        try {
            aiResult = aiGrpcClient.analyzeResume(content);
            sourceLlmResponse = aiResult.sourceLlmResponse();
            analysis = analysisValidator.parseAndValidate(aiResult.resumeJson(), content);
        } catch (RuntimeException exception) {
            failResumeAnalysis(
                    prepared, exception,
                    sourceLlmResponse(exception, sourceLlmResponse),
                    deleteResumeOnFailure);
            if (deleteResumeOnFailure) {
                objectStorage.delete(objectKey);
            }
            throw aiFailure(exception);
        }

        try {
            return completeResumeAnalysis(prepared, content, analysis, sourceLlmResponse);
        } catch (RuntimeException exception) {
            failResumeAnalysis(
                    prepared, exception, sourceLlmResponse, deleteResumeOnFailure);
            if (deleteResumeOnFailure) {
                objectStorage.delete(objectKey);
            }
            throw new ApiException(
                    ApiException.ErrorCode.INTERNAL_ERROR,
                    "persist resume analysis failed");
        }
    }

    private ResumeData completeResumeAnalysis(
            PreparedResumeAnalysis prepared,
            String content,
            ResumeAnalysisResult analysis,
            String sourceLlmResponse) {
        ResumeData result = transactions.execute(ignored -> {
            Resume resume = resumeRepository.findById(prepared.resumeId())
                    .orElseThrow(() -> new IllegalStateException("resume not found"));
            UserAnalysisTask task = pendingResumeAnalysisTask(prepared.taskId());
            OffsetDateTime now = OffsetDateTime.now();
            resume.setContent(content);
            applyAnalysis(resume, analysis);
            resume.setDeletedAt(null);
            resume.setUpdatedAt(now);
            task.setTaskStatus(TaskStatus.SUCCESS);
            task.setSourceLlmResponse(sourceLlmResponse);
            task.setUpdatedAt(now);
            Resume saved = resumeRepository.saveAndFlush(resume);
            taskRepository.saveAndFlush(task);
            return toData(saved);
        });
        if (result == null) {
            throw new IllegalStateException("complete resume analysis returned no result");
        }
        return result;
    }

    private void failResumeAnalysis(
            PreparedResumeAnalysis prepared,
            RuntimeException exception,
            String sourceLlmResponse,
            boolean deleteResumeOnFailure) {
        transactions.executeWithoutResult(ignored -> {
            UserAnalysisTask task = pendingResumeAnalysisTask(prepared.taskId());
            OffsetDateTime now = OffsetDateTime.now();
            task.setTaskStatus(TaskStatus.FAILED);
            task.setErrorMsg(safeError(exception));
            task.setSourceLlmResponse(sourceLlmResponse);
            task.setUpdatedAt(now);
            taskRepository.saveAndFlush(task);
            if (deleteResumeOnFailure) {
                resumeRepository.findById(prepared.resumeId()).ifPresent(resume -> {
                    resume.setDeletedAt(now);
                    resume.setUpdatedAt(now);
                    resumeRepository.saveAndFlush(resume);
                });
            }
        });
    }

    private UserAnalysisTask pendingResumeAnalysisTask(long taskId) {
        UserAnalysisTask task = taskRepository.findByIdAndDeletedAtIsNull(taskId)
                .orElseThrow(() -> new IllegalStateException("resume analysis task not found"));
        if (task.getTaskStatus() != TaskStatus.PENDING) {
            throw new IllegalStateException("resume analysis task is not pending");
        }
        return task;
    }

    private String sourceLlmResponse(RuntimeException exception, String fallback) {
        return exception instanceof AIAnalysisException analysisException
                ? analysisException.getSourceLlmResponse()
                : fallback;
    }

    private ApiException aiFailure(RuntimeException exception) {
        if (exception instanceof ApiException apiException) {
            return apiException;
        }
        return new ApiException(
                ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                "resume analysis unavailable");
    }

    private String safeError(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            message = exception.getClass().getSimpleName();
        }
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }

    private void applyAnalysis(Resume resume, ResumeAnalysisResult analysis) {
        resume.setEducationExperiences(
                analysisValidator.toJsonArray(analysis.educationExperience()));
        resume.setWorkExperiences(
                analysisValidator.toJsonArray(analysis.workExperience()));
        resume.setProjectExperiences(
                analysisValidator.toJsonArray(analysis.projectExperience()));
        resume.setProfessionalSkills(
                analysisValidator.toJsonArray(analysis.professionalSkills()));
        resume.setAwards(analysisValidator.toJsonArray(analysis.awards()));
    }

    private boolean isFullyAnalyzed(Resume resume) {
        return resume.getContent() != null
                && !resume.getContent().isBlank()
                && resume.getEducationExperiences() != null
                && resume.getWorkExperiences() != null
                && resume.getProjectExperiences() != null
                && resume.getProfessionalSkills() != null
                && resume.getAwards() != null;
    }

    private ResumeData toData(Resume resume) {
        ResumeAnalysisResult analysis = analysisValidator.fromStored(
                resume.getEducationExperiences(),
                resume.getWorkExperiences(),
                resume.getProjectExperiences(),
                resume.getProfessionalSkills(),
                resume.getAwards(),
                resume.getContent(),
                resume.getSource() == ResumeSource.SYSTEM);
        return new ResumeData(
                resume.getId(),
                resume.getFileName(),
                resume.getFileSize(),
                resume.getContent(),
                resume.getCreatedAt(),
                analysisValidator.toCanonicalJson(analysis),
                resume.getSource());
    }

    private record PreparedResumeAnalysis(long taskId, long resumeId) {
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
            Long fileSize,
            String content,
            OffsetDateTime createdAt,
            String fieldsJson,
            ResumeSource source) {
    }
}
