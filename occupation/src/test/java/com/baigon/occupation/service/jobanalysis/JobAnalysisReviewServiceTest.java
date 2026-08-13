// 百工谱 — 岗位分析人工审核测试
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisReviewServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobRepository jobRepository;
    private JobOccupationAliasRepository aliasRepository;
    private OccupationRepository occupationRepository;
    private JobAnalysisReviewService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        jobRepository = mock(JobRepository.class);
        aliasRepository = mock(JobOccupationAliasRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        service = new JobAnalysisReviewService(
                taskRepository, jobRepository, aliasRepository, occupationRepository,
                mock(LogService.class), new Snowflake(5, 1));
    }

    @Test
    void reviewerCanChooseAnyValidOccupationAndCreateAuditableAlias() {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setJobId(10L);
        task.setTraceId(1001L);
        task.setReviewStatus(ReviewStatus.PENDING);
        Job job = new Job();
        job.setId(10L);
        job.setName("后端开发工程师");
        Occupation occupation = new Occupation();
        occupation.setId(99L);
        occupation.setName("计算机程序设计员");

        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.of(occupation));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job));
        when(aliasRepository.findByJobNameForUpdate(job.getName())).thenReturn(Optional.empty());
        when(aliasRepository.save(any(JobOccupationAlias.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.review(20L, 99L, audit()).orElseThrow();

        assertEquals(99L, job.getOccupationId());
        assertEquals(99L, task.getSelectedOccupationId());
        assertEquals(ReviewStatus.PASSED, task.getReviewStatus());
        var aliasCaptor = org.mockito.ArgumentCaptor.forClass(JobOccupationAlias.class);
        verify(aliasRepository).save(aliasCaptor.capture());
        assertEquals(1001L, aliasCaptor.getValue().getTraceId());
        assertEquals("后端开发工程师", aliasCaptor.getValue().getJobName());
        assertEquals("计算机程序设计员", aliasCaptor.getValue().getOccupationName());
    }

    private AuditContext audit() {
        return new AuditContext(1001L, 7L, "reviewer", "127.0.0.1", "PUT", "/job-analysis/20/review");
    }
}
