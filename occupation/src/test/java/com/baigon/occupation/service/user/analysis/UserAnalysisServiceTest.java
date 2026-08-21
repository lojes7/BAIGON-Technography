// 百工谱 — 用户技能分析与人岗匹配编排测试
package com.baigon.occupation.service.user.analysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserGraph;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.user.analysis.UserAnalysisTaskRepository;
import com.baigon.occupation.repository.user.analysis.UserGraphRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionOperations;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAnalysisServiceTest {

    private UserAnalysisTaskRepository taskRepository;
    private UserGraphRepository graphRepository;
    private ResumeRepository resumeRepository;
    private JobRepository jobRepository;
    private AIGrpcClient aiGrpcClient;
    private UserAnalysisService service;
    private AtomicReference<UserAnalysisTask> task;

    @BeforeEach
    void setUp() {
        taskRepository = mock(UserAnalysisTaskRepository.class);
        graphRepository = mock(UserGraphRepository.class);
        resumeRepository = mock(ResumeRepository.class);
        jobRepository = mock(JobRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        task = new AtomicReference<>();
        when(taskRepository.saveAndFlush(any(UserAnalysisTask.class))).thenAnswer(invocation -> {
            UserAnalysisTask saved = invocation.getArgument(0);
            task.set(saved);
            return saved;
        });
        when(taskRepository.findByIdAndDeletedAtIsNull(any())).thenAnswer(
                ignored -> Optional.ofNullable(task.get()));
        when(taskRepository
                .findFirstByUserIdAndResumeIdAndJobIdAndTaskTypeAndTaskStatusAndDeletedAtIsNull(
                        any(), any(), any(), any(), any()))
                .thenReturn(Optional.empty());
        when(graphRepository.saveAllAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service = new UserAnalysisService(
                taskRepository, graphRepository, resumeRepository, jobRepository,
                aiGrpcClient, mock(LogService.class), new Snowflake(6, 1),
                new ObjectMapper(), 120L, TransactionOperations.withoutTransaction());
    }

    @Test
    void analyzeSkillsShouldPersistGroundedSnapshotWithoutReadingJobs() {
        Resume resume = resume(101L, "项目使用 Java 开发，熟悉 PostgreSQL 数据库");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(
                        new AIGrpcClient.AnalyzedSkillResult(
                                "Java", "ADVANCED", "项目使用 Java 开发"),
                        new AIGrpcClient.AnalyzedSkillResult(
                                "PostgreSQL", "FAMILIAR", "熟悉 PostgreSQL 数据库")),
                        "spark-x"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals(101L, result.resumeId());
        assertEquals(2, result.skills().size());
        assertEquals("ADVANCED", result.skills().get(0).proficiency());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        assertEquals("spark-x", task.get().getModelName());
        verify(jobRepository, never()).findByIdAndDeletedAtIsNull(any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserGraph>> graphs = ArgumentCaptor.forClass(List.class);
        verify(graphRepository).saveAllAndFlush(graphs.capture());
        assertEquals(1, graphs.getValue().get(0).getRank());
        assertEquals("项目使用 Java 开发", graphs.getValue().get(0).getEvidence());
    }

    @Test
    void matchShouldBuildInputOnlyFromJobsEntityAndPersistStructuredResult() {
        Resume resume = resume(101L, "三年 Java 后端开发经验");
        Job job = job(201L);
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L)).thenReturn(Optional.of(job));
        when(aiGrpcClient.analyzeJobMatch(eq(resume.getContent()), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        82,
                        "后端基础匹配，需要补充容器实践",
                        List.of(new AIGrpcClient.SkillLearningSuggestionResult(
                                "Kubernetes", "岗位要求容器编排", "完成部署练习")),
                        List.of("制作一个可演示项目"),
                        "spark-x"));

        UserAnalysisService.JobMatchData result =
                service.matchMyResumeToJob(7L, 201L, audit());

        assertEquals(82, result.score());
        assertEquals(201L, result.jobId());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        assertEquals(82, task.get().getMatchScore());
        assertEquals(1, task.get().getSkillsToLearn().size());
        verify(graphRepository, never()).saveAllAndFlush(any());

        ArgumentCaptor<AIGrpcClient.JobMatchInput> input =
                ArgumentCaptor.forClass(AIGrpcClient.JobMatchInput.class);
        verify(aiGrpcClient).analyzeJobMatch(eq(resume.getContent()), input.capture(), eq(audit()));
        assertEquals(job.getName(), input.getValue().name());
        assertEquals(job.getPublishDate().toString(), input.getValue().publishDate());
        assertEquals(job.getSourcePlatform(), input.getValue().sourcePlatform());
        assertEquals(job.getSourceUrl(), input.getValue().sourceUrl());
        assertEquals(job.getTags(), input.getValue().tags());
        assertEquals(job.getMajor(), input.getValue().major());
        assertEquals(job.getNature(), input.getValue().nature());
        assertEquals(job.getSalary(), input.getValue().salary());
        assertEquals(job.getJobDescription(), input.getValue().jobDescription());
        assertEquals(job.getCompanyName(), input.getValue().companyName());
        assertEquals(job.getCompanySize(), input.getValue().companySize());
        assertEquals(job.getCity(), input.getValue().city());
        assertEquals(job.getProvince(), input.getValue().province());
        assertEquals(job.getEducation(), input.getValue().education());
        assertEquals(job.getExperience(), input.getValue().experience());
        assertEquals(job.getOccupationId(), input.getValue().occupationId());
    }

    @Test
    void aiFailureShouldMarkTaskFailedWithoutWritingGraphs() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit()))
                .thenThrow(new ApiException(
                        ApiException.ErrorCode.SERVICE_UNAVAILABLE, "AI unavailable"));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.SERVICE_UNAVAILABLE, exception.getErrorCode());
        assertEquals(TaskStatus.FAILED, task.get().getTaskStatus());
        assertEquals("SERVICE_UNAVAILABLE", task.get().getErrorMsg());
        verify(graphRepository, never()).saveAllAndFlush(any());
    }

    @Test
    void emptyLatestResumeContentShouldFailBeforeCreatingTask() {
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume(101L, null)));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
        verify(taskRepository, never()).saveAndFlush(any());
        verify(aiGrpcClient, never()).analyzeUserSkills(any(), any());
    }

    @Test
    void missingResumeAndJobShouldMapToNotFoundBeforeCallingAI() {
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.empty());

        ApiException missingResume = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));
        assertEquals(ApiException.ErrorCode.NOT_FOUND, missingResume.getErrorCode());

        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(999L)).thenReturn(Optional.empty());

        ApiException missingJob = assertThrows(ApiException.class,
                () -> service.matchMyResumeToJob(7L, 999L, audit()));
        assertEquals(ApiException.ErrorCode.NOT_FOUND, missingJob.getErrorCode());
        verify(aiGrpcClient, never()).analyzeJobMatch(any(), any(), any());
    }

    @Test
    void listSkillsShouldUseOnlyCurrentUserTimelineQuery() {
        UserGraph graph = new UserGraph();
        graph.setId(501L);
        graph.setUserId(7L);
        graph.setResumeId(101L);
        graph.setSkillName("Java");
        graph.setProficiency(
                com.baigon.occupation.entity.user.analysis.UserSkillProficiency.ADVANCED);
        graph.setEvidence("Java 开发经验");
        graph.setCreatedAt(OffsetDateTime.parse("2026-08-20T10:00:00+08:00"));
        when(graphRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtAscRankAscIdAsc(7L))
                .thenReturn(List.of(graph));

        List<UserAnalysisService.UserSkillData> result = service.listMySkills(7L);

        assertEquals(1, result.size());
        assertEquals(501L, result.get(0).id());
        assertEquals("ADVANCED", result.get(0).proficiency());
        verify(graphRepository)
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtAscRankAscIdAsc(7L);
    }

    @Test
    void emptySkillResultShouldSucceedWithoutGraphWrites() {
        Resume resume = resume(101L, "本人没有可识别的技能经历");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(), "spark-x"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals(0, result.skills().size());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        verify(graphRepository, never()).saveAllAndFlush(any());
    }

    @Test
    void unicodeEquivalentEvidenceShouldPassSameGroundingRuleAsAI() {
        Resume resume = resume(101L, "使用ＡＷＳ构建服务");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(
                        new AIGrpcClient.AnalyzedSkillResult(
                                "AWS", "FAMILIAR", "使用AWS构建服务")), "spark-x"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals("AWS", result.skills().get(0).skillName());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
    }

    @Test
    void freshPendingTaskShouldRejectDuplicateAnalysis() {
        Resume resume = resume(101L, "Java 开发经验");
        UserAnalysisTask pending = pendingTask(301L, OffsetDateTime.now());
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(taskRepository
                .findFirstByUserIdAndResumeIdAndJobIdAndTaskTypeAndTaskStatusAndDeletedAtIsNull(
                        eq(7L), eq(101L), isNull(),
                        eq(UserAnalysisType.RESUME_SKILL_ANALYSIS), eq(TaskStatus.PENDING)))
                .thenReturn(Optional.of(pending));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.TASK_ALREADY_RUNNING, exception.getErrorCode());
        verify(aiGrpcClient, never()).analyzeUserSkills(any(), any());
    }

    @Test
    void stalePendingTaskShouldBeRecoveredBeforeNewAnalysis() {
        Resume resume = resume(101L, "Java 开发经验");
        UserAnalysisTask stale = pendingTask(301L, OffsetDateTime.now().minusMinutes(4));
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(taskRepository
                .findFirstByUserIdAndResumeIdAndJobIdAndTaskTypeAndTaskStatusAndDeletedAtIsNull(
                        eq(7L), eq(101L), isNull(),
                        eq(UserAnalysisType.RESUME_SKILL_ANALYSIS), eq(TaskStatus.PENDING)))
                .thenReturn(Optional.of(stale));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(), "spark-x"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals(0, result.skills().size());
        assertEquals(TaskStatus.FAILED, stale.getTaskStatus());
        assertEquals("ANALYSIS_TIMEOUT", stale.getErrorMsg());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
    }

    @Test
    void persistenceFailureShouldMapToInternalErrorAndMarkTaskFailed() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(), "spark-x"));
        when(taskRepository.saveAndFlush(any(UserAnalysisTask.class))).thenAnswer(invocation -> {
            UserAnalysisTask saved = invocation.getArgument(0);
            task.set(saved);
            if (saved.getTaskStatus() == TaskStatus.SUCCESS) {
                // 无事务测试替身手动恢复成数据库回滚后的 PENDING 状态。
                saved.setTaskStatus(TaskStatus.PENDING);
                throw new DataIntegrityViolationException("result write failed");
            }
            return saved;
        });

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.INTERNAL_ERROR, exception.getErrorCode());
        assertEquals(TaskStatus.FAILED, task.get().getTaskStatus());
    }

    @Test
    void invalidAIResultShouldMapToServiceUnavailableAndMarkTaskFailed() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(job(201L)));
        when(aiGrpcClient.analyzeJobMatch(eq(resume.getContent()), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        101, "非法分数", List.of(), List.of(), "spark-x"));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.matchMyResumeToJob(7L, 201L, audit()));

        assertEquals(ApiException.ErrorCode.SERVICE_UNAVAILABLE, exception.getErrorCode());
        assertEquals(TaskStatus.FAILED, task.get().getTaskStatus());
    }

    @Test
    void pendingUniqueConstraintShouldMapToTaskAlreadyRunning() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(taskRepository.saveAndFlush(any(UserAnalysisTask.class))).thenThrow(
                new DataIntegrityViolationException(
                        "duplicate key violates idx_user_analysis_tasks_resume_pending"));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.TASK_ALREADY_RUNNING, exception.getErrorCode());
        verify(aiGrpcClient, never()).analyzeUserSkills(any(), any());
    }

    @Test
    void unrelatedIntegrityViolationShouldMapToInternalError() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(taskRepository.saveAndFlush(any(UserAnalysisTask.class))).thenThrow(
                new DataIntegrityViolationException("foreign key violation"));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.analyzeMyResumeSkills(7L, audit()));

        assertEquals(ApiException.ErrorCode.INTERNAL_ERROR, exception.getErrorCode());
        verify(aiGrpcClient, never()).analyzeUserSkills(any(), any());
    }

    private UserAnalysisTask pendingTask(long id, OffsetDateTime createdAt) {
        UserAnalysisTask pending = new UserAnalysisTask();
        pending.setId(id);
        pending.setUserId(7L);
        pending.setResumeId(101L);
        pending.setTaskType(UserAnalysisType.RESUME_SKILL_ANALYSIS);
        pending.setTaskStatus(TaskStatus.PENDING);
        pending.setCreatedAt(createdAt);
        pending.setUpdatedAt(createdAt);
        return pending;
    }

    private Resume resume(long id, String content) {
        Resume resume = new Resume();
        resume.setId(id);
        resume.setUserId(7L);
        resume.setContent(content);
        return resume;
    }

    private Job job(long id) {
        Job job = new Job();
        job.setId(id);
        job.setName("后端开发工程师");
        job.setPublishDate(OffsetDateTime.parse("2026-08-20T10:00:00+08:00"));
        job.setSourcePlatform("智联招聘");
        job.setSourceUrl("https://example.com/jobs/201");
        job.setTags("Java,云原生");
        job.setMajor("计算机科学");
        job.setNature("全职");
        job.setSalary("15K-25K");
        job.setCompanyName("百工科技");
        job.setCompanySize("100-499人");
        job.setCity("杭州");
        job.setProvince("浙江");
        job.setEducation("本科");
        job.setExperience("3年");
        job.setJobDescription("负责 Java 后端和 Kubernetes 部署");
        job.setOccupationId(301L);
        return job;
    }

    private AuditContext audit() {
        return new AuditContext(
                1001L, 7L, "student", "127.0.0.1",
                "POST", "/api/auth/resumes/analyze-skills");
    }
}
