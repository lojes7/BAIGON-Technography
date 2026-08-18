// 百工谱 — 简历直传与 OCR 业务测试
package com.baigon.occupation.service.user.resume;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.user.UserRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    private UserRepository userRepository;
    private ResumeObjectStorage objectStorage;
    private ResumeDocumentTextExtractor textExtractor;
    private Snowflake snowflake;
    private ResumeService service;

    @BeforeEach
    void setUp() {
        resumeRepository = mock(ResumeRepository.class);
        userRepository = mock(UserRepository.class);
        objectStorage = mock(ResumeObjectStorage.class);
        textExtractor = mock(ResumeDocumentTextExtractor.class);
        snowflake = mock(Snowflake.class);
        service = new ResumeService(
                resumeRepository, userRepository, objectStorage, textExtractor,
                snowflake, 1024, 600);

        when(userRepository.existsByIdAndDeletedAtIsNull(7L)).thenReturn(true);
        when(snowflake.nextId()).thenReturn(101L);
        when(objectStorage.bucketName()).thenReturn("resumes");
        when(resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(101L, 7L))
                .thenReturn(Optional.empty());
        when(resumeRepository.saveAndFlush(any(Resume.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(textExtractor.extract(anyString(), any())).thenReturn("OCR 简历正文");
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

        ResumeService.ResumeData result = service.completeUpload(7L, 101L, "张三.pdf");

        assertEquals(101L, result.id());
        assertEquals("张三.pdf", result.fileName());
        assertEquals("OCR 简历正文", result.content());
        InOrder order = inOrder(objectStorage, resumeRepository, textExtractor);
        order.verify(objectStorage).read("users/7/resumes/101.pdf", 1024);
        order.verify(resumeRepository).saveAndFlush(any(Resume.class));
        order.verify(textExtractor).extract("张三.pdf", file);
        order.verify(resumeRepository).saveAndFlush(any(Resume.class));

        ArgumentCaptor<Resume> resume = ArgumentCaptor.forClass(Resume.class);
        verify(resumeRepository, org.mockito.Mockito.times(2)).saveAndFlush(resume.capture());
        assertEquals("resumes", resume.getValue().getBucketName());
        assertEquals("OCR 简历正文", resume.getValue().getContent());
        assertEquals("416305e2e33997e1bd839d615a710e37", resume.getValue().getMd5());
    }

    @Test
    void completeUploadRetryShouldReturnExistingResumeWithoutReadingObject() {
        Resume existing = new Resume();
        existing.setId(101L);
        existing.setUserId(7L);
        existing.setFileName("张三.pdf");
        existing.setFileSize(128L);
        existing.setContent("已有正文");
        when(resumeRepository.findByIdAndUserIdAndDeletedAtIsNull(101L, 7L))
                .thenReturn(Optional.of(existing));

        ResumeService.ResumeData result = service.completeUpload(7L, 101L, "张三.pdf");

        assertEquals("已有正文", result.content());
        verify(objectStorage, never()).read(anyString(), anyLong());
        verify(textExtractor, never()).extract(anyString(), any());
    }

    @Test
    void ocrFailureShouldDeleteUploadedObjectOutsideSpringTransactionProxy() {
        byte[] file = "%PDF-example".getBytes();
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenReturn(new ResumeObjectStorage.StoredObject(file, file.length));
        when(textExtractor.extract("resume.pdf", file))
                .thenThrow(new IllegalArgumentException("invalid PDF file"));

        assertThrows(IllegalArgumentException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf"));

        verify(objectStorage).delete("users/7/resumes/101.pdf");
    }

    @Test
    void oversizedStoredObjectShouldBeDeleted() {
        when(objectStorage.read("users/7/resumes/101.pdf", 1024))
                .thenThrow(new ApiException(
                        ApiException.ErrorCode.BAD_REQUEST,
                        "resume file exceeds size limit"));

        assertThrows(ApiException.class,
                () -> service.completeUpload(7L, 101L, "resume.pdf"));

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
                () -> service.completeUpload(7L, 101L, "resume.pdf"));

        verify(objectStorage, never()).delete(anyString());
    }

    @Test
    void unsupportedFileShouldFailBeforePresigning() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createUpload(7L, "resume.doc", 128L));

        verify(objectStorage, never()).createPresignedPutUrl(anyString(), anyInt());
    }
}
