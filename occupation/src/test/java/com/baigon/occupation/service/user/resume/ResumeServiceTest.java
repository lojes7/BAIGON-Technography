// 百工谱 — 简历直传与 OCR 业务测试
package com.baigon.occupation.service.user.resume;

import cn.hutool.core.lang.Snowflake;
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
import com.baigon.occupation.service.user.resume.analysis.ResumeAnalysisValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ResumeServiceTest {

    private ResumeRepository resumeRepository;
    private UserAnalysisTaskRepository taskRepository;
    private UserRepository userRepository;
    private ResumeObjectStorage objectStorage;
    private ResumeDocumentTextExtractor textExtractor;
    private AIGrpcClient aiGrpcClient;
    private ResumeAnalysisValidator analysisValidator;
    private ObjectMapper objectMapper;
    private Snowflake snowflake;
    private ResumeService service;
    private AtomicReference<Resume> savedResume;
    private AtomicReference<UserAnalysisTask> savedTask;

    @BeforeEach
    void setUp() {
        resumeRepository = mock(ResumeRepository.class);
        taskRepository = mock(UserAnalysisTaskRepository.class);
        userRepository = mock(UserRepository.class);
        objectStorage = mock(ResumeObjectStorage.class);
        textExtractor = mock(ResumeDocumentTextExtractor.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        objectMapper = new ObjectMapper();
        analysisValidator = new ResumeAnalysisValidator(objectMapper);
        snowflake = mock(Snowflake.class);
        savedResume = new AtomicReference<>();
        savedTask = new AtomicReference<>();
        service = new ResumeService(
                resumeRepository, taskRepository, userRepository, objectStorage, textExtractor,
                aiGrpcClient, analysisValidator,
                snowflake, TransactionOperations.withoutTransaction(), 1024, 600);

        when(userRepository.existsByIdAndDeletedAtIsNull(7L)).thenReturn(true);
        when(snowflake.nextId()).thenReturn(101L);
        when(objectStorage.bucketName()).thenReturn("resumes");
        when(resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(101L, 7L))
                .thenReturn(Optional.empty());
        when(resumeRepository.saveAndFlush(any(Resume.class))).thenAnswer(invocation -> {
            Resume resume = invocation.getArgument(0);
            savedResume.set(resume);
            return resume;
        });
        when(resumeRepository.findById(anyLong())).thenAnswer(
                ignored -> Optional.ofNullable(savedResume.get()));
        when(taskRepository.saveAndFlush(any(UserAnalysisTask.class))).thenAnswer(invocation -> {
            UserAnalysisTask task = invocation.getArgument(0);
            savedTask.set(task);
            return task;
        });
        when(taskRepository.findByIdAndDeletedAtIsNull(anyLong())).thenAnswer(
                ignored -> Optional.ofNullable(savedTask.get()));
        when(textExtractor.extract(anyString(), any())).thenReturn("OCR 简历正文");
        when(aiGrpcClient.analyzeResume(anyString())).thenReturn(
                new AIGrpcClient.ResumeAnalysisResult(
                        emptyAnalysisJson(), "raw-resume-analysis"));
    }

    @Test
    void createUploadShouldOnlyIssuePresignedUrl() {
        when(objectStorage.createPresignedPutUrl("users/7/resumes/101.pdf", 600))
                .thenReturn("http://localhost:9000/resumes/signed");

        ResumeService.ResumeUploadData result =
                service.createUpload(7L, "../张三.pdf", 128L);

        assertEquals(101L, result.uploadId());
        assertEquals("PUT", result.method());
        assertEquals("application/pdf", result.contentType());
        assertEquals("http://localhost:9000/resumes/signed", result.uploadUrl());
        verify(objectStorage).createPresignedPutUrl("users/7/resumes/101.pdf", 600);
        verify(objectStorage, never()).read(anyString(), anyLong());
        verify(resumeRepository, never()).saveAndFlush(any());
    }

    @Test
    void completeUploadShouldReadCreateExtractAndWriteContentInOrder() {
        byte[] file = "%PDF-example".getBytes();
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenReturn(new ResumeObjectStorage.StoredObject(file, file.length));

        ResumeService.ResumeData result = service.completeUpload(
                7L, 101L, "张三.pdf", audit());

        assertEquals(101L, result.id());
        assertEquals("张三.pdf", result.fileName());
        assertEquals("OCR 简历正文", result.content());
        assertEquals(ResumeSource.SYSTEM, result.source());
        InOrder order = inOrder(
                objectStorage, resumeRepository, taskRepository, textExtractor, aiGrpcClient);
        order.verify(objectStorage).read("users/7/resumes/101.pdf", 1024);
        order.verify(textExtractor).extract("张三.pdf", file);
        order.verify(resumeRepository).saveAndFlush(any(Resume.class));
        order.verify(taskRepository).saveAndFlush(any(UserAnalysisTask.class));
        order.verify(aiGrpcClient).analyzeResume("OCR 简历正文");
        order.verify(resumeRepository).saveAndFlush(any(Resume.class));
        order.verify(taskRepository).saveAndFlush(any(UserAnalysisTask.class));

        ArgumentCaptor<Resume> resume = ArgumentCaptor.forClass(Resume.class);
        verify(resumeRepository, org.mockito.Mockito.times(2)).saveAndFlush(resume.capture());
        assertEquals("resumes", resume.getValue().getBucketName());
        assertEquals("OCR 简历正文", resume.getValue().getContent());
        assertEquals("416305e2e33997e1bd839d615a710e37", resume.getValue().getMd5());
        assertEquals(ResumeSource.SYSTEM, resume.getValue().getSource());
        assertEquals(0, resume.getValue().getProfessionalSkills().size());
        assertEquals(UserAnalysisType.RESUME_EXTRACTION, savedTask.get().getTaskType());
        assertEquals(TaskStatus.SUCCESS, savedTask.get().getTaskStatus());
        assertEquals("raw-resume-analysis", savedTask.get().getSourceLlmResponse());
        assertEquals(1001L, savedTask.get().getTraceId());
    }

    @Test
    void completeUploadRetryShouldReturnExistingResumeWithoutReadingObject() {
        Resume existing = new Resume();
        existing.setId(101L);
        existing.setUserId(7L);
        existing.setFileName("张三.pdf");
        existing.setFileSize(128L);
        existing.setContent("已有正文");
        existing.setSource(ResumeSource.SYSTEM);
        existing.setEducationExperiences(objectMapper.createArrayNode());
        existing.setWorkExperiences(objectMapper.createArrayNode());
        existing.setProjectExperiences(objectMapper.createArrayNode());
        existing.setProfessionalSkills(objectMapper.createArrayNode());
        existing.setAwards(objectMapper.createArrayNode());
        when(resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(101L, 7L))
                .thenReturn(Optional.of(existing));

        ResumeService.ResumeData result = service.completeUpload(
                7L, 101L, "张三.pdf", audit());

        assertEquals("已有正文", result.content());
        verify(objectStorage, never()).read(anyString(), anyLong());
        verify(textExtractor, never()).extract(anyString(), any());
        verify(aiGrpcClient, never()).analyzeResume(anyString());
    }

    @Test
    void contentOnlyExistingResumeShouldCompleteStructuredAnalysis() {
        Resume existing = new Resume();
        existing.setId(101L);
        existing.setUserId(7L);
        existing.setFileName("张三.pdf");
        existing.setFileSize(128L);
        existing.setContent("已有正文");
        existing.setSource(ResumeSource.SYSTEM);
        when(resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(101L, 7L))
                .thenReturn(Optional.of(existing));
        when(resumeRepository.findById(101L)).thenReturn(Optional.of(existing));

        ResumeService.ResumeData result = service.completeUpload(
                7L, 101L, "张三.pdf", audit());

        assertEquals("已有正文", result.content());
        verify(aiGrpcClient).analyzeResume("已有正文");
        verify(resumeRepository).saveAndFlush(existing);
        assertEquals(TaskStatus.SUCCESS, savedTask.get().getTaskStatus());
        assertEquals("raw-resume-analysis", savedTask.get().getSourceLlmResponse());
        verify(objectStorage, never()).read(anyString(), anyLong());
    }

    @Test
    void ocrFailureShouldDeleteUploadedObjectOutsideSpringTransactionProxy() {
        byte[] file = "%PDF-example".getBytes();
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenReturn(new ResumeObjectStorage.StoredObject(file, file.length));
        when(textExtractor.extract("resume.pdf", file))
                .thenThrow(new IllegalArgumentException("invalid PDF file"));

        assertThrows(IllegalArgumentException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf", audit()));

        verify(objectStorage).delete("users/7/resumes/101.pdf");
    }

    @Test
    void aiFailureShouldDeleteNewObjectAndNotPersistFinalJson() {
        byte[] file = "%PDF-example".getBytes();
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenReturn(new ResumeObjectStorage.StoredObject(file, file.length));
        when(aiGrpcClient.analyzeResume("OCR 简历正文"))
                .thenThrow(new AIAnalysisException(
                        "resume response invalid", "raw-invalid-resume"));

        assertThrows(ApiException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf", audit()));

        verify(objectStorage).delete("users/7/resumes/101.pdf");
        verify(resumeRepository, org.mockito.Mockito.times(2)).saveAndFlush(any(Resume.class));
        assertEquals(TaskStatus.FAILED, savedTask.get().getTaskStatus());
        assertEquals("raw-invalid-resume", savedTask.get().getSourceLlmResponse());
    }

    @Test
    void oversizedStoredObjectShouldBeDeleted() {
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenThrow(new ApiException(
                        ApiException.ErrorCode.BAD_REQUEST,
                        "resume file exceeds size limit"));

        assertThrows(ApiException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf", audit()));

        verify(objectStorage).delete("users/7/resumes/101.pdf");
    }

    @Test
    void concurrentCompletionConflictShouldNotDeletePossiblyCommittedObject() {
        byte[] file = "%PDF-example".getBytes();
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenReturn(new ResumeObjectStorage.StoredObject(file, file.length));
        when(resumeRepository.saveAndFlush(any(Resume.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate resume id"));

        assertThrows(DataIntegrityViolationException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf", audit()));

        verify(objectStorage, never()).delete(anyString());
    }

    @Test
    void unsupportedFileShouldFailBeforePresigning() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createUpload(7L, "resume.doc", 128L));

        verify(objectStorage, never()).createPresignedPutUrl(anyString(), anyInt());
    }

    @Test
    void editMyResumeShouldSaveIndependentEditedRecordWithoutFile() {
        String fieldsJson = """
                {
                  "education_experience": [{
                    "major": "软件工程", "university_name": null,
                    "start_date": null, "end_date": null, "description": null
                  }],
                  "work_experience": [],
                  "project_experience": [],
                  "professional_skills": [{"skill_name":"Java","proficiency":"Expert"}],
                  "awards": []
                }
                """;

        ResumeService.ResumeData result = service.editMyResume(7L, null, fieldsJson);

        assertEquals(101L, result.id());
        assertEquals(ResumeSource.EDITED, result.source());
        assertNull(result.fileName());
        assertNull(result.fileSize());
        assertNull(result.content());
        verify(aiGrpcClient, never()).analyzeResume(anyString());
        verify(objectStorage, never()).read(anyString(), anyLong());

        ArgumentCaptor<Resume> saved = ArgumentCaptor.forClass(Resume.class);
        verify(resumeRepository).saveAndFlush(saved.capture());
        assertEquals(ResumeSource.EDITED, saved.getValue().getSource());
        assertNull(saved.getValue().getFileKey());
        assertNull(saved.getValue().getBucketName());
        assertNull(saved.getValue().getMd5());
        assertEquals("Expert",
                saved.getValue().getProfessionalSkills().get(0).get("proficiency").asText());
    }

    @Test
    void editMyResumeShouldRejectInvalidProficiencyBeforeSaving() {
        String invalid = emptyAnalysisJson().replace(
                "\"professional_skills\": []",
                "\"professional_skills\": [{\"skill_name\":\"Java\",\"proficiency\":\"Skilled\"}]");

        assertThrows(IllegalArgumentException.class,
                () -> service.editMyResume(7L, "人工正文", invalid));

        verify(resumeRepository, never()).saveAndFlush(any());
    }

    private String emptyAnalysisJson() {
        return """
                {
                  "education_experience": [],
                  "work_experience": [],
                  "project_experience": [],
                  "professional_skills": [],
                  "awards": []
                }
                """;
    }

    private AuditContext audit() {
        return new AuditContext(
                1001L, 7L, "student", "127.0.0.1",
                "POST", "/api/auth/resumes/upload-complete");
    }
}
