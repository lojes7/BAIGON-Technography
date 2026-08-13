// 百工谱 — 合并服务中的清洗岗位审核事务测试
package com.baigon.occupation.service.datasource;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.entity.datasource.ReviewedCleanedJobSource;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.datasource.CleanedJobSourceRepository;
import com.baigon.occupation.repository.datasource.ReviewedCleanedJobSourceRepository;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CleanedJobSourceServiceTest {

    private CleanedJobSourceRepository cleanedRepository;
    private ReviewedCleanedJobSourceRepository reviewedRepository;
    private JobRepository jobRepository;
    private JobOccupationAliasRepository aliasRepository;
    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisService jobAnalysisService;
    private CleanedJobSourceService service;

    @BeforeEach
    void setUp() {
        cleanedRepository = mock(CleanedJobSourceRepository.class);
        reviewedRepository = mock(ReviewedCleanedJobSourceRepository.class);
        jobRepository = mock(JobRepository.class);
        aliasRepository = mock(JobOccupationAliasRepository.class);
        taskRepository = mock(JobAnalysisTaskRepository.class);
        jobAnalysisService = mock(JobAnalysisService.class);
        when(reviewedRepository.save(any(ReviewedCleanedJobSource.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(jobRepository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskRepository.save(any(JobAnalysisTask.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service = new CleanedJobSourceService(
                cleanedRepository,
                reviewedRepository,
                mock(LogService.class),
                new Snowflake(1, 1),
                jobRepository,
                aliasRepository,
                taskRepository,
                jobAnalysisService);
    }

    @Test
    void aliasMissShouldPersistSnapshotJobAndAnalysisTaskWithoutKafka() {
        CleanedJobSource source = pendingSource();
        when(cleanedRepository.findByIdForReview(source.getId())).thenReturn(Optional.of(source));
        when(jobRepository.findByTraceIdAndDeletedAtIsNull(source.getTraceId()))
                .thenReturn(Optional.empty());
        when(aliasRepository.findByJobNameAndDeletedAtIsNull(source.getJobName()))
                .thenReturn(Optional.empty());
        when(taskRepository.findByJobIdAndDeletedAtIsNull(anyLong()))
                .thenReturn(Optional.empty());

        var result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.APPROVE,
                null, audit()).orElseThrow();

        assertEquals(ReviewStatus.PASSED, source.getReviewStatus());
        assertNotNull(result.approvedVersion());
        assertEquals(source.getTraceId(), result.approvedVersion().getTraceId());
        verify(reviewedRepository).save(result.approvedVersion());
        ArgumentCaptor<Job> jobCaptor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepository).save(jobCaptor.capture());
        assertEquals(source.getTraceId(), jobCaptor.getValue().getTraceId());
        assertNull(jobCaptor.getValue().getOccupationId());
        ArgumentCaptor<JobAnalysisTask> taskCaptor = ArgumentCaptor.forClass(JobAnalysisTask.class);
        verify(taskRepository).save(taskCaptor.capture());
        assertEquals(jobCaptor.getValue().getId(), taskCaptor.getValue().getJobId());
        assertEquals(source.getTraceId(), taskCaptor.getValue().getTraceId());
        verify(jobAnalysisService).submitAfterCommit(eq(taskCaptor.getValue().getId()), any(AuditContext.class));
    }

    @Test
    void aliasHitShouldWriteOccupationIdAndFinishWithoutAnalysisTask() {
        CleanedJobSource source = pendingSource();
        JobOccupationAlias alias = new JobOccupationAlias();
        alias.setOccupationId(88L);
        when(cleanedRepository.findByIdForReview(source.getId())).thenReturn(Optional.of(source));
        when(jobRepository.findByTraceIdAndDeletedAtIsNull(source.getTraceId()))
                .thenReturn(Optional.empty());
        when(aliasRepository.findByJobNameAndDeletedAtIsNull(source.getJobName()))
                .thenReturn(Optional.of(alias));

        service.review(source.getId(), CleanedJobSourceService.ReviewAction.APPROVE,
                null, audit()).orElseThrow();

        ArgumentCaptor<Job> jobCaptor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepository).save(jobCaptor.capture());
        assertEquals(88L, jobCaptor.getValue().getOccupationId());
        verify(taskRepository, never()).save(any(JobAnalysisTask.class));
        verify(jobAnalysisService, never()).submitAfterCommit(anyLong(), any(AuditContext.class));
    }

    @Test
    void approveWithEditShouldUseEditedNameForJobAndAliasLookup() {
        CleanedJobSource source = pendingSource();
        CleanedJobSource edited = new CleanedJobSource();
        edited.setJobName("编辑后岗位");
        JobOccupationAlias alias = new JobOccupationAlias();
        alias.setOccupationId(99L);
        when(cleanedRepository.findByIdForReview(source.getId())).thenReturn(Optional.of(source));
        when(jobRepository.findByTraceIdAndDeletedAtIsNull(source.getTraceId()))
                .thenReturn(Optional.empty());
        when(aliasRepository.findByJobNameAndDeletedAtIsNull(edited.getJobName()))
                .thenReturn(Optional.of(alias));

        var result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT,
                edited, audit()).orElseThrow();

        assertEquals("原岗位", source.getJobName());
        assertEquals("编辑后岗位", result.approvedVersion().getJobName());
        ArgumentCaptor<Job> jobCaptor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepository).save(jobCaptor.capture());
        assertEquals("编辑后岗位", jobCaptor.getValue().getName());
        assertEquals(99L, jobCaptor.getValue().getOccupationId());
    }

    @Test
    void rejectShouldNotCreateJobOrAnalysisTask() {
        CleanedJobSource source = pendingSource();
        when(cleanedRepository.findByIdForReview(source.getId())).thenReturn(Optional.of(source));

        var result = service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.REJECT,
                null, audit()).orElseThrow();

        assertEquals(ReviewStatus.REJECTED, source.getReviewStatus());
        assertNull(result.approvedVersion());
        verify(jobRepository, never()).save(any(Job.class));
        verify(taskRepository, never()).save(any(JobAnalysisTask.class));
        verify(jobAnalysisService, never()).submitAfterCommit(anyLong(), any(AuditContext.class));
    }

    @Test
    void alreadyReviewedShouldReturn40301() {
        CleanedJobSource source = pendingSource();
        source.setReviewStatus(ReviewStatus.PASSED);
        when(cleanedRepository.findByIdForReview(source.getId())).thenReturn(Optional.of(source));

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                source.getId(), CleanedJobSourceService.ReviewAction.REJECT, null, audit()));

        assertEquals(ApiException.ErrorCode.ALREADY_REVIEWED, exception.getErrorCode());
        assertEquals(40301, exception.getErrorCode().getResponseCode());
    }

    @Test
    void missingSourceShouldReturnEmpty() {
        when(cleanedRepository.findByIdForReview(404L)).thenReturn(Optional.empty());
        assertTrue(service.review(
                404L, CleanedJobSourceService.ReviewAction.APPROVE, null, audit()).isEmpty());
    }

    private CleanedJobSource pendingSource() {
        CleanedJobSource source = new CleanedJobSource();
        source.setId(1001L);
        source.setTraceId(2001L);
        source.setSourcePlatform("测试平台");
        source.setJobNumber("JOB-1");
        source.setJobName("原岗位");
        source.setCompanyName("原公司");
        source.setSalary("原薪资");
        source.setReviewStatus(ReviewStatus.PENDING);
        return source;
    }

    private AuditContext audit() {
        return new AuditContext(9001L, 7L, "reviewer", "127.0.0.1", "POST", "/review");
    }
}
