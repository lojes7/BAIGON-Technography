// 百工谱 — 用户技能分析与人岗匹配编排测试
package com.baigon.occupation.service.user.analysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserGraph;
import com.baigon.occupation.entity.user.analysis.UserJobMatchResult;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.user.analysis.UserAnalysisTaskRepository;
import com.baigon.occupation.repository.user.analysis.UserGraphRepository;
import com.baigon.occupation.repository.user.analysis.UserJobMatchResultRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.support.TransactionOperations;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
    private UserJobMatchResultRepository matchResultRepository;
    private ResumeRepository resumeRepository;
    private JobRepository jobRepository;
    private AIGrpcClient aiGrpcClient;
    private UserAnalysisService service;
    private AtomicReference<UserAnalysisTask> task;
    private List<UserJobMatchResult> matchResults;

    @BeforeEach
    void setUp() {
        taskRepository = mock(UserAnalysisTaskRepository.class);
        graphRepository = mock(UserGraphRepository.class);
        matchResultRepository = mock(UserJobMatchResultRepository.class);
        resumeRepository = mock(ResumeRepository.class);
        jobRepository = mock(JobRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        task = new AtomicReference<>();
        matchResults = new ArrayList<>();
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
        when(matchResultRepository.saveAndFlush(any(UserJobMatchResult.class)))
                .thenAnswer(invocation -> {
                    UserJobMatchResult saved = invocation.getArgument(0);
                    matchResults.add(saved);
                    return saved;
                });
        service = new UserAnalysisService(
                taskRepository, graphRepository, matchResultRepository,
                resumeRepository, jobRepository,
                aiGrpcClient, mock(LogService.class), new Snowflake(6, 1),
                new ObjectMapper(), 120L, TransactionOperations.withoutTransaction());
    }

    @Test
    void analyzeSkillsShouldPersistGroundedSnapshotWithoutReadingJobs() {
        Resume resume = resume(101L, "项目使用 Java 开发，熟悉 Postgre\nSQL 数据库");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(List.of(
                        new AIGrpcClient.AnalyzedSkillResult(
                                "Java", "ADVANCED", "项目使用 Java 开发"),
                        new AIGrpcClient.AnalyzedSkillResult(
                                "PostgreSQL", "FAMILIAR", "熟悉 PostgreSQL 数据库")),
                        "spark-x", "raw-user-skills"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals(101L, result.resumeId());
        assertEquals(2, result.skills().size());
        assertEquals("ADVANCED", result.skills().get(0).proficiency());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        assertEquals("spark-x", task.get().getModelName());
        assertEquals("raw-user-skills", task.get().getSourceLlmResponse());
        verify(jobRepository, never()).findByIdAndDeletedAtIsNull(any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserGraph>> graphs = ArgumentCaptor.forClass(List.class);
        verify(graphRepository).saveAllAndFlush(graphs.capture());
        assertEquals(1, graphs.getValue().get(0).getRank());
        assertEquals("项目使用 Java 开发", graphs.getValue().get(0).getEvidence());
    }

    @Test
    void matchShouldUseStructuredResumeWhenContentIsNullAndPersistResult() {
        Resume resume = resume(101L, null);
        Job job = job(201L);
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L)).thenReturn(Optional.of(job));
        when(aiGrpcClient.analyzeJobMatch(any(), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        82,
                        "后端基础匹配，需要补充容器实践",
                        List.of(new AIGrpcClient.SkillLearningSuggestionResult(
                                "Kubernetes", "岗位要求容器编排", "完成部署练习")),
                        List.of("制作一个可演示项目"),
                        "spark-x", "raw-job-match"));

        UserAnalysisService.JobMatchData result =
                service.matchMyResumeToJob(7L, 201L, audit());

        assertEquals(82, result.score());
        assertEquals(201L, result.jobId());
        assertEquals(result.id(), matchResults.get(0).getId());
        assertEquals(7L, matchResults.get(0).getUserId());
        assertEquals(101L, matchResults.get(0).getResumeId());
        assertEquals(201L, matchResults.get(0).getJobId());
        assertEquals(82, matchResults.get(0).getMatchScore());
        assertEquals("Kubernetes",
                matchResults.get(0).getSkillsToLearn().get(0).get("skillName").asText());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        assertEquals("raw-job-match", task.get().getSourceLlmResponse());
        verify(graphRepository, never()).saveAllAndFlush(any());

        ArgumentCaptor<AIGrpcClient.ResumeMatchInput> resumeInput =
                ArgumentCaptor.forClass(AIGrpcClient.ResumeMatchInput.class);
        ArgumentCaptor<AIGrpcClient.JobMatchInput> jobInput =
                ArgumentCaptor.forClass(AIGrpcClient.JobMatchInput.class);
        verify(aiGrpcClient).analyzeJobMatch(
                resumeInput.capture(), jobInput.capture(), eq(audit()));
        assertEquals("[]", resumeInput.getValue().educationExperiences());
        assertEquals(
                "[{\"skill_name\":\"Java\",\"proficiency\":\"Advanced\"}]",
                resumeInput.getValue().professionalSkills());
        assertEquals(job.getName(), jobInput.getValue().name());
        assertEquals(job.getPublishDate().toString(), jobInput.getValue().publishDate());
        assertEquals(job.getSourcePlatform(), jobInput.getValue().sourcePlatform());
        assertEquals(job.getSourceUrl(), jobInput.getValue().sourceUrl());
        assertEquals(job.getTags(), jobInput.getValue().tags());
        assertEquals(job.getMajor(), jobInput.getValue().major());
        assertEquals(job.getNature(), jobInput.getValue().nature());
        assertEquals(job.getSalary(), jobInput.getValue().salary());
        assertEquals(job.getJobDescription(), jobInput.getValue().jobDescription());
        assertEquals(job.getCompanyName(), jobInput.getValue().companyName());
        assertEquals(job.getCompanySize(), jobInput.getValue().companySize());
        assertEquals(job.getCity(), jobInput.getValue().city());
        assertEquals(job.getProvince(), jobInput.getValue().province());
        assertEquals(job.getEducation(), jobInput.getValue().education());
        assertEquals(job.getExperience(), jobInput.getValue().experience());
        assertEquals(job.getOccupationId(), jobInput.getValue().occupationId());
    }

    @Test
    void repeatedMatchShouldAppendDistinctResults() {
        Resume resume = resume(101L, null);
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(job(201L)));
        when(aiGrpcClient.analyzeJobMatch(any(), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        82, "匹配结果", List.of(), List.of("继续积累项目经验"),
                        "spark-x", "raw-job-match"));

        UserAnalysisService.JobMatchData first =
                service.matchMyResumeToJob(7L, 201L, audit());
        UserAnalysisService.JobMatchData second =
                service.matchMyResumeToJob(7L, 201L, audit());

        assertEquals(2, matchResults.size());
        assertNotEquals(first.id(), second.id());
        assertEquals(first.id(), matchResults.get(0).getId());
        assertEquals(second.id(), matchResults.get(1).getId());
    }

    @Test
    void getLatestMyJobMatchShouldReadLatestResultForUserAndJob() {
        ObjectMapper mapper = new ObjectMapper();
        UserJobMatchResult stored = new UserJobMatchResult();
        stored.setId(501L);
        stored.setUserId(7L);
        stored.setResumeId(101L);
        stored.setJobId(201L);
        stored.setMatchScore(82);
        stored.setMatchSummary("核心能力匹配");
        stored.setCreatedAt(OffsetDateTime.parse("2026-08-25T10:00:00+08:00"));
        var skills = mapper.createArrayNode();
        skills.addObject()
                .put("skillName", "Kubernetes")
                .put("reason", "岗位要求")
                .put("suggestion", "完成部署练习");
        stored.setSkillsToLearn(skills);
        stored.setActionSuggestions(mapper.createArrayNode().add("完善项目说明"));
        when(matchResultRepository
                .findFirstByUserIdAndJobIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                        7L, 201L))
                .thenReturn(Optional.of(stored));

        UserAnalysisService.JobMatchData result = service.getLatestMyJobMatch(7L, 201L);

        assertEquals(501L, result.id());
        assertEquals("Kubernetes", result.skillsToLearn().get(0).skillName());
        assertEquals("完善项目说明", result.actionSuggestions().get(0));

        when(matchResultRepository
                .findFirstByUserIdAndJobIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                        8L, 201L))
                .thenReturn(Optional.empty());
        ApiException exception = assertThrows(
                ApiException.class, () -> service.getLatestMyJobMatch(8L, 201L));
        assertEquals(ApiException.ErrorCode.NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void matchResultPersistenceFailureShouldMarkTaskFailed() {
        Resume resume = resume(101L, null);
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(job(201L)));
        when(aiGrpcClient.analyzeJobMatch(any(), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        82, "匹配结果", List.of(), List.of(),
                        "spark-x", "raw-job-match"));
        when(matchResultRepository.saveAndFlush(any(UserJobMatchResult.class)))
                .thenThrow(new DataIntegrityViolationException("result write failed"));

        ApiException exception = assertThrows(
                ApiException.class, () -> service.matchMyResumeToJob(7L, 201L, audit()));

        assertEquals(ApiException.ErrorCode.INTERNAL_ERROR, exception.getErrorCode());
        assertEquals(TaskStatus.FAILED, task.get().getTaskStatus());
        assertEquals("raw-job-match", task.get().getSourceLlmResponse());
        assertEquals(0, matchResults.size());
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
    void matchShouldRejectResumeWhenAllStructuredFieldsAreEmpty() {
        Resume resume = resume(101L, null);
        resume.setProfessionalSkills(new ObjectMapper().createArrayNode());
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.matchMyResumeToJob(7L, 201L, audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
        verify(taskRepository, never()).saveAndFlush(any());
        verify(jobRepository, never()).findByIdAndDeletedAtIsNull(any());
        verify(aiGrpcClient, never()).analyzeJobMatch(any(), any(), any());
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
    void listSkillsShouldUseServerPaginationForCurrentUserOnly() {
        UserGraph graph = userGraph(501L, "Java");
        when(graphRepository.findByUserIdAndDeletedAtIsNull(eq(7L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(graph), PageRequest.of(1, 20), 21));

        Page<UserAnalysisService.UserSkillData> result = service.listMySkills(7L, 1, 20);

        assertEquals(1, result.getContent().size());
        assertEquals(501L, result.getContent().getFirst().id());
        assertEquals("ADVANCED", result.getContent().getFirst().proficiency());
        assertEquals(21L, result.getTotalElements());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(graphRepository).findByUserIdAndDeletedAtIsNull(eq(7L), pageable.capture());
        assertEquals(1, pageable.getValue().getPageNumber());
        assertEquals(20, pageable.getValue().getPageSize());
        assertEquals(Sort.Direction.ASC,
                pageable.getValue().getSort().getOrderFor("createdAt").getDirection());
    }

    @Test
    void getSkillShouldEnforceCurrentUserOwnership() {
        UserGraph graph = userGraph(501L, "Java");
        when(graphRepository.findByIdAndUserIdAndDeletedAtIsNull(501L, 7L))
                .thenReturn(Optional.of(graph));
        when(graphRepository.findByIdAndUserIdAndDeletedAtIsNull(501L, 8L))
                .thenReturn(Optional.empty());

        assertEquals(501L, service.getMySkill(7L, 501L).id());
        ApiException exception = assertThrows(ApiException.class,
                () -> service.getMySkill(8L, 501L));
        assertEquals(ApiException.ErrorCode.NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void batchSkillsShouldDeduplicateAndKeepRequestOrderWithinCurrentUser() {
        UserGraph first = userGraph(502L, "Go");
        UserGraph second = userGraph(501L, "Java");
        when(graphRepository.findByUserIdAndIdInAndDeletedAtIsNull(
                7L, List.of(502L, 501L, 999L)))
                .thenReturn(List.of(second, first));

        List<UserAnalysisService.UserSkillData> result =
                service.batchGetMySkills(7L, List.of(502L, 501L, 502L, 999L));

        assertEquals(List.of(502L, 501L), result.stream()
                .map(UserAnalysisService.UserSkillData::id).toList());
        verify(graphRepository).findByUserIdAndIdInAndDeletedAtIsNull(
                7L, List.of(502L, 501L, 999L));
    }

    @Test
    void batchSkillsShouldRequireOneToTwoHundredRawIds() {
        assertThrows(IllegalArgumentException.class,
                () -> service.batchGetMySkills(7L, List.of()));
        assertThrows(IllegalArgumentException.class, () ->
                service.batchGetMySkills(7L, java.util.Collections.nCopies(201, 1L)));
    }

    @Test
    void emptySkillResultShouldSucceedWithoutGraphWrites() {
        Resume resume = resume(101L, "本人没有可识别的技能经历");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(aiGrpcClient.analyzeUserSkills(resume.getContent(), audit())).thenReturn(
                new AIGrpcClient.UserSkillAnalysisResult(
                        List.of(), "spark-x", "raw-empty-skills"));

        UserAnalysisService.SkillAnalysisData result =
                service.analyzeMyResumeSkills(7L, audit());

        assertEquals(0, result.skills().size());
        assertEquals(TaskStatus.SUCCESS, task.get().getTaskStatus());
        assertEquals("raw-empty-skills", task.get().getSourceLlmResponse());
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
                                "AWS", "FAMILIAR", "使用AWS构建服务")),
                        "spark-x", "raw-unicode-skills"));

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
                new AIGrpcClient.UserSkillAnalysisResult(
                        List.of(), "spark-x", "raw-recovered-skills"));

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
                new AIGrpcClient.UserSkillAnalysisResult(
                        List.of(), "spark-x", "raw-persistence-failure"));
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
        assertEquals("raw-persistence-failure", task.get().getSourceLlmResponse());
    }

    @Test
    void invalidAIResultShouldMapToServiceUnavailableAndMarkTaskFailed() {
        Resume resume = resume(101L, "Java 开发经验");
        when(resumeRepository.findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(7L))
                .thenReturn(Optional.of(resume));
        when(jobRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(job(201L)));
        when(aiGrpcClient.analyzeJobMatch(any(), any(), eq(audit())))
                .thenReturn(new AIGrpcClient.JobMatchAnalysisResult(
                        101, "非法分数", List.of(), List.of(),
                        "spark-x", "raw-invalid-match"));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.matchMyResumeToJob(7L, 201L, audit()));

        assertEquals(ApiException.ErrorCode.SERVICE_UNAVAILABLE, exception.getErrorCode());
        assertEquals(TaskStatus.FAILED, task.get().getTaskStatus());
        assertEquals("raw-invalid-match", task.get().getSourceLlmResponse());
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

    private UserGraph userGraph(long id, String skillName) {
        UserGraph graph = new UserGraph();
        graph.setId(id);
        graph.setUserId(7L);
        graph.setResumeId(101L);
        graph.setSkillName(skillName);
        graph.setProficiency(
                com.baigon.occupation.entity.user.analysis.UserSkillProficiency.ADVANCED);
        graph.setEvidence(skillName + " 开发经验");
        graph.setCreatedAt(OffsetDateTime.parse("2026-08-20T10:00:00+08:00"));
        return graph;
    }

    private Resume resume(long id, String content) {
        Resume resume = new Resume();
        resume.setId(id);
        resume.setUserId(7L);
        resume.setContent(content);
        ObjectMapper mapper = new ObjectMapper();
        resume.setEducationExperiences(mapper.createArrayNode());
        resume.setWorkExperiences(mapper.createArrayNode());
        resume.setProjectExperiences(mapper.createArrayNode());
        var skills = mapper.createArrayNode();
        skills.addObject()
                .put("skill_name", "Java")
                .put("proficiency", "Advanced");
        resume.setProfessionalSkills(skills);
        resume.setAwards(mapper.createArrayNode());
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
