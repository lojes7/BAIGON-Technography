// 百工谱 — 岗位职业与技能分析人工审核测试
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobOccupationAlias;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobOccupationAliasRepository;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisReviewServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisResultRepository resultRepository;
    private JobRepository jobRepository;
    private JobSkillRepository jobSkillRepository;
    private JobOccupationAliasRepository aliasRepository;
    private OccupationRepository occupationRepository;
    private JobAnalysisReviewService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        resultRepository = mock(JobAnalysisResultRepository.class);
        jobRepository = mock(JobRepository.class);
        jobSkillRepository = mock(JobSkillRepository.class);
        aliasRepository = mock(JobOccupationAliasRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        service = new JobAnalysisReviewService(
                taskRepository, resultRepository, jobRepository, jobSkillRepository,
                aliasRepository, occupationRepository, mock(LogService.class), new Snowflake(5, 1));
    }

    @Test
    void reviewerCanMixApproveEditAndRejectWithoutOverwritingAiResults() {
        JobAnalysisTask task = task();
        Job job = job();
        Occupation occupation = occupation();
        List<JobAnalysisResult> results = List.of(
                result(101L, 1, "Java", "Advanced", "熟练使用 Java"),
                result(102L, 2, "Word", "Basic", "了解 Word"),
                result(103L, 3, "学历", "Basic", "本科及以上"));

        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.of(occupation));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(results);
        when(aliasRepository.findByJobNameForUpdate(job.getName())).thenReturn(Optional.empty());
        when(aliasRepository.save(any(JobOccupationAlias.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(jobSkillRepository.save(any(JobSkill.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.review(20L, 99L, List.of(
                decision(101L, JobAnalysisReviewAction.APPROVE, null, null, null),
                decision(102L, JobAnalysisReviewAction.APPROVE_WITH_EDIT,
                        "Microsoft Word", "Familiar", "能够使用 Word 编写文档"),
                decision(103L, JobAnalysisReviewAction.REJECT, null, null, null)
        ), audit()).orElseThrow();

        assertEquals(99L, job.getOccupationId());
        assertEquals(ReviewStatus.PASSED, task.getReviewStatus());
        assertEquals(ReviewStatus.PASSED, results.get(0).getReviewStatus());
        assertEquals(ReviewStatus.PASSED, results.get(1).getReviewStatus());
        assertEquals(ReviewStatus.REJECTED, results.get(2).getReviewStatus());
        // AI 原始字段保留，修改后的最终值单独保存。
        assertEquals("Word", results.get(1).getSkillName());
        assertEquals("Microsoft Word", results.get(1).getReviewedSkillName());
        assertNull(results.get(2).getReviewedSkillName());

        ArgumentCaptor<JobSkill> skillCaptor = ArgumentCaptor.forClass(JobSkill.class);
        verify(jobSkillRepository, org.mockito.Mockito.times(2)).save(skillCaptor.capture());
        assertEquals("Java", skillCaptor.getAllValues().get(0).getSkillName());
        assertEquals("Microsoft Word", skillCaptor.getAllValues().get(1).getSkillName());
        assertEquals(102L, skillCaptor.getAllValues().get(1).getAnalysisResultId());

        ArgumentCaptor<JobOccupationAlias> aliasCaptor =
                ArgumentCaptor.forClass(JobOccupationAlias.class);
        verify(aliasRepository).save(aliasCaptor.capture());
        assertEquals(1001L, aliasCaptor.getValue().getTraceId());
        assertEquals("计算机程序设计员", aliasCaptor.getValue().getOccupationName());
    }

    @Test
    void reviewMustCoverAllAnalysisResults() {
        JobAnalysisTask task = task();
        when(taskRepository.findByIdForReview(20L)).thenReturn(Optional.of(task));
        when(occupationRepository.findByIdAndDeletedAtIsNull(99L))
                .thenReturn(Optional.of(occupation()));
        when(jobRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(job()));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(
                        result(101L, 1, "Java", "Advanced", "熟练使用 Java"),
                        result(102L, 2, "Word", "Basic", "了解 Word")));

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                20L, 99L,
                List.of(decision(101L, JobAnalysisReviewAction.APPROVE, null, null, null)),
                audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
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
        return job;
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
