// 百工谱 — 岗位职业与技能分析人工审核测试
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobMajorAlias;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobMajorAliasRepository;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.skill.JobSkillIdentityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisReviewServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisResultRepository resultRepository;
    private JobRepository jobRepository;
    private JobSkillIdentityService jobSkillIdentityService;
    private JobOccupationAliasRepository aliasRepository;
    private JobMajorAliasRepository majorAliasRepository;
    private OccupationRepository occupationRepository;
    private MajorRepository majorRepository;
    private JobAnalysisReviewService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        resultRepository = mock(JobAnalysisResultRepository.class);
        jobRepository = mock(JobRepository.class);
        jobSkillIdentityService = mock(JobSkillIdentityService.class);
        aliasRepository = mock(JobOccupationAliasRepository.class);
        majorAliasRepository = mock(JobMajorAliasRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        majorRepository = mock(MajorRepository.class);
        service = new JobAnalysisReviewService(
                taskRepository, resultRepository, jobRepository, jobSkillIdentityService,
                aliasRepository, majorAliasRepository, occupationRepository, majorRepository,
                mock(LogService.class), new Snowflake(5, 1));
    }

    @Test
    void reviewerCanMixApproveEditAndRejectWithoutOverwritingAiResults() {
        JobAnalysisTask task = task();
        Job job = job();
        Major major = major();
        Occupation occupation = occupation();
        List<JobAnalysisResult> results = List.of(
                result(101L, 1, "Java", "ADVANCED", "熟练使用 Java"),
                result(102L, 2, "Word", "BASIC", "了解 Word"),
                result(103L, 3, "学历", "BASIC", "本科及以上"));

        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(majorRepository.findByIdAndDeletedAtIsNull(88L)).thenReturn(Optional.of(major));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.of(occupation));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(results);
        when(aliasRepository.findActiveByNormalizedJobNameForUpdate(job.getName()))
                .thenReturn(Optional.empty());
        when(majorAliasRepository.findActiveByNormalizedJobMajorForUpdate(job.getMajor()))
                .thenReturn(Optional.empty());
        when(aliasRepository.save(any(JobOccupationAlias.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(majorAliasRepository.save(any(JobMajorAlias.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        service.review(20L, 88L, 99L, List.of(
                decision(101L, JobAnalysisReviewAction.APPROVE, null, null, null),
                decision(102L, JobAnalysisReviewAction.APPROVE_WITH_EDIT,
                        "Microsoft Word", "FAMILIAR", "能够使用 Word 编写文档"),
                decision(103L, JobAnalysisReviewAction.REJECT, null, null, null)
        ), audit()).orElseThrow();

        assertEquals(88L, job.getMajorId());
        assertEquals(99L, job.getOccupationId());
        assertEquals(88L, task.getSelectedMajorId());
        assertEquals(ReviewStatus.PASSED, task.getReviewStatus());
        assertEquals(ReviewStatus.PASSED, results.get(0).getReviewStatus());
        assertEquals(ReviewStatus.PASSED, results.get(1).getReviewStatus());
        assertEquals(ReviewStatus.REJECTED, results.get(2).getReviewStatus());
        // AI 原始字段保留，修改后的最终值单独保存。
        assertEquals("Word", results.get(1).getSkillName());
        assertEquals("Microsoft Word", results.get(1).getReviewedSkillName());
        assertNull(results.get(2).getReviewedSkillName());

        ArgumentCaptor<JobSkill> skillCaptor = ArgumentCaptor.forClass(JobSkill.class);
        verify(jobSkillIdentityService, org.mockito.Mockito.times(2)).saveAndResolve(
                org.mockito.ArgumentMatchers.eq(job), skillCaptor.capture(),
                org.mockito.ArgumentMatchers.eq(1001L), any(AuditContext.class), any());
        assertEquals("Java", skillCaptor.getAllValues().get(0).getSkillName());
        assertEquals("Microsoft Word", skillCaptor.getAllValues().get(1).getSkillName());
        assertEquals("FAMILIAR", skillCaptor.getAllValues().get(1).getSkillProficiency());
        assertEquals(102L, skillCaptor.getAllValues().get(1).getAnalysisResultId());

        ArgumentCaptor<JobOccupationAlias> aliasCaptor =
                ArgumentCaptor.forClass(JobOccupationAlias.class);
        verify(aliasRepository).save(aliasCaptor.capture());
        assertEquals(1001L, aliasCaptor.getValue().getTraceId());
        assertEquals("计算机程序设计员", aliasCaptor.getValue().getOccupationName());
        ArgumentCaptor<JobMajorAlias> majorAliasCaptor =
                ArgumentCaptor.forClass(JobMajorAlias.class);
        verify(majorAliasRepository).save(majorAliasCaptor.capture());
        assertEquals(1001L, majorAliasCaptor.getValue().getTraceId());
        assertEquals("软件工程", majorAliasCaptor.getValue().getMajorName());
    }

    @Test
    void reviewMustCoverAllAnalysisResults() {
        JobAnalysisTask task = task();
        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(majorRepository.findByIdAndDeletedAtIsNull(88L))
                .thenReturn(Optional.of(major()));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L))
                .thenReturn(Optional.of(occupation()));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job()));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(
                        result(101L, 1, "Java", "ADVANCED", "熟练使用 Java"),
                        result(102L, 2, "Word", "BASIC", "了解 Word")));

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                20L, 88L, 99L,
                List.of(decision(101L, JobAnalysisReviewAction.APPROVE, null, null, null)),
                audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
    }

    @Test
    void unlimitedMajorShouldNotCreateGlobalAlias() {
        JobAnalysisTask task = task();
        Job job = job();
        job.setMajor("专业不限");
        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(majorRepository.findByIdAndDeletedAtIsNull(846L))
                .thenReturn(Optional.of(otherMajor()));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L))
                .thenReturn(Optional.of(occupation()));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of());
        when(aliasRepository.findActiveByNormalizedJobNameForUpdate(job.getName()))
                .thenReturn(Optional.empty());

        service.review(20L, 846L, 99L, List.of(), audit()).orElseThrow();

        assertEquals(846L, job.getMajorId());
        verify(majorAliasRepository, never()).findActiveByNormalizedJobMajorForUpdate(any());
        verify(majorAliasRepository, never()).save(any());
    }

    private JobAnalysisTask task() {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setJobId(10L);
        task.setTraceId(1001L);
        task.setTaskStatus(TaskStatus.SUCCESS);
        task.setReviewStatus(ReviewStatus.PENDING);
        return task;
    }

    private Job job() {
        Job job = new Job();
        job.setId(10L);
        job.setName("后端开发工程师");
        job.setMajor("软件工程类");
        return job;
    }

    private Major major() {
        Major major = new Major();
        major.setId(88L);
        major.setName("软件工程");
        return major;
    }

    private Major otherMajor() {
        Major major = new Major();
        major.setId(846L);
        major.setName("其他");
        return major;
    }

    private Occupation occupation() {
        Occupation occupation = new Occupation();
        occupation.setId(99L);
        occupation.setName("计算机程序设计员");
        return occupation;
    }

    private JobAnalysisResult result(Long id,
                                     int rank,
                                     String name,
                                     String proficiency,
                                     String evidence) {
        JobAnalysisResult result = new JobAnalysisResult();
        result.setId(id);
        result.setTaskId(20L);
        result.setJobId(10L);
        result.setRank(rank);
        result.setSkillName(name);
        result.setSkillProficiency(proficiency);
        result.setEvidence(evidence);
        result.setReviewStatus(ReviewStatus.PENDING);
        return result;
    }

    private JobAnalysisReviewService.SkillReviewDecision decision(
            Long resultId,
            JobAnalysisReviewAction action,
            String name,
            String proficiency,
            String evidence) {
        return new JobAnalysisReviewService.SkillReviewDecision(
                resultId, action, name, proficiency, evidence);
    }

    private AuditContext audit() {
        return new AuditContext(1001L, 7L, "reviewer", "127.0.0.1",
                "PUT", "/job-analysis/20/review");
    }
}
