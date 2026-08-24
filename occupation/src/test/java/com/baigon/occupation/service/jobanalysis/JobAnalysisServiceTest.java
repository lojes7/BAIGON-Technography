// 百工谱 — 岗位职业匹配与真实 JD 串行分析测试
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.config.JobAnalysisConfig;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.grpc.client.ai.AIAnalysisException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisMajorCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorCandidateProjection;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationCandidateProjection;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.transaction.support.TransactionOperations;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisCandidateRepository candidateRepository;
    private JobAnalysisMajorCandidateRepository majorCandidateRepository;
    private JobAnalysisResultRepository resultRepository;
    private JobRepository jobRepository;
    private OccupationRepository occupationRepository;
    private MajorRepository majorRepository;
    private AIGrpcClient aiGrpcClient;
    private JobAnalysisService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        candidateRepository = mock(JobAnalysisCandidateRepository.class);
        majorCandidateRepository = mock(JobAnalysisMajorCandidateRepository.class);
        resultRepository = mock(JobAnalysisResultRepository.class);
        jobRepository = mock(JobRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        majorRepository = mock(MajorRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        JobAnalysisConfig config = new JobAnalysisConfig();
        // 使用非默认值，验证专业与职业候选确实共用同一配置。
        config.setCandidateLimit(3);
        service = new JobAnalysisService(
                taskRepository, candidateRepository, majorCandidateRepository, resultRepository,
                jobRepository, occupationRepository, majorRepository, aiGrpcClient,
                mock(LogService.class), new Snowflake(5, 1),
                mock(ExecutorService.class), TransactionOperations.withoutTransaction(), config);
    }

    @Test
    void aliasMissShouldMatchOccupationThenMajorBeforeAnalyzingRealJobDescription() throws Exception {
        JobAnalysisTask task = task(TaskStatus.PENDING, TaskStatus.PENDING);
        Job job = job();
        AIGrpcClient.EmbeddingCall occupationEmbeddingCall = mock(AIGrpcClient.EmbeddingCall.class);
        AIGrpcClient.EmbeddingCall majorEmbeddingCall = mock(AIGrpcClient.EmbeddingCall.class);
        AIGrpcClient.JobDescriptionAnalysisCall jdCall =
                mock(AIGrpcClient.JobDescriptionAnalysisCall.class);
        OccupationCandidateProjection candidate = mock(OccupationCandidateProjection.class);
        MajorCandidateProjection majorCandidate = mock(MajorCandidateProjection.class);
        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task));
        when(taskRepository.markAnalysisStarted(20L)).thenReturn(1);
        when(aiGrpcClient.startBatch(List.of("后端开发工程师"), audit()))
                .thenReturn(occupationEmbeddingCall);
        when(occupationEmbeddingCall.await()).thenReturn(List.of(List.of(0.1F, 0.2F)));
        when(occupationEmbeddingCall.modelName()).thenReturn("qwen-embedding");
        when(candidate.getId()).thenReturn(99L);
        when(candidate.getName()).thenReturn("计算机程序设计员");
        when(candidate.getSimilarity()).thenReturn(0.98D);
        when(occupationRepository.findNearestByNameVector(anyString(), eq(3)))
                .thenReturn(List.of(candidate));
        when(taskRepository.markOccupationAnalysisSucceeded(20L, "[0.1,0.2]", "qwen-embedding"))
                .thenReturn(1);
        when(aiGrpcClient.startBatch(List.of("软件工程"), audit()))
                .thenReturn(majorEmbeddingCall);
        when(majorEmbeddingCall.await()).thenReturn(List.of(List.of(0.3F, 0.4F)));
        when(majorEmbeddingCall.modelName()).thenReturn("qwen-embedding");
        when(majorCandidate.getId()).thenReturn(88L);
        when(majorCandidate.getName()).thenReturn("软件工程");
        when(majorCandidate.getSimilarity()).thenReturn(0.97D);
        when(majorRepository.findNearestByNameVector(anyString(), eq(3)))
                .thenReturn(List.of(majorCandidate));
        when(taskRepository.markMajorAnalysisSucceeded(20L, "[0.3,0.4]", "qwen-embedding"))
                .thenReturn(1);
        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(aiGrpcClient.startJobDescriptionAnalysis(job.getJobDescription())).thenReturn(jdCall);
        when(jdCall.await()).thenReturn(new AIGrpcClient.JobDescriptionAnalysisResult(
                List.of(new AIGrpcClient.AnalyzedSkillResult(
                        "Java", "ADVANCED", "熟练使用 Java")),
                "raw-jd-response"));
        when(taskRepository.markJdAnalysisSucceeded(20L, "raw-jd-response")).thenReturn(1);

        service.analyze(20L, audit());

        InOrder order = inOrder(aiGrpcClient, taskRepository);
        order.verify(aiGrpcClient).startBatch(List.of("后端开发工程师"), audit());
        order.verify(taskRepository).markOccupationAnalysisSucceeded(
                20L, "[0.1,0.2]", "qwen-embedding");
        order.verify(aiGrpcClient).startBatch(List.of("软件工程"), audit());
        order.verify(taskRepository).markMajorAnalysisSucceeded(
                20L, "[0.3,0.4]", "qwen-embedding");
        order.verify(aiGrpcClient).startJobDescriptionAnalysis("负责开发，熟练使用 Java");
        order.verify(taskRepository).markJdAnalysisSucceeded(20L, "raw-jd-response");
        verify(candidateRepository).save(any());
        verify(majorCandidateRepository).save(any());
        ArgumentCaptor<JobAnalysisResult> resultCaptor =
                ArgumentCaptor.forClass(JobAnalysisResult.class);
        verify(resultRepository).save(resultCaptor.capture());
        assertEquals(10L, resultCaptor.getValue().getJobId());
        assertEquals("Java", resultCaptor.getValue().getSkillName());
        assertEquals("ADVANCED", resultCaptor.getValue().getSkillProficiency());
    }

    @Test
    void aliasHitShouldSkipEmbeddingButStillAnalyzeJdAndAllowEmptySkills() throws Exception {
        JobAnalysisTask task = task(TaskStatus.SUCCESS, TaskStatus.SUCCESS);
        Job job = job();
        AIGrpcClient.JobDescriptionAnalysisCall jdCall =
                mock(AIGrpcClient.JobDescriptionAnalysisCall.class);
        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task));
        when(taskRepository.markAnalysisStarted(20L)).thenReturn(1);
        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(aiGrpcClient.startJobDescriptionAnalysis(job.getJobDescription())).thenReturn(jdCall);
        when(jdCall.await()).thenReturn(new AIGrpcClient.JobDescriptionAnalysisResult(
                List.of(), "raw-empty-jd-response"));
        when(taskRepository.markJdAnalysisSucceeded(20L, "raw-empty-jd-response"))
                .thenReturn(1);

        service.analyze(20L, audit());

        verify(aiGrpcClient, never()).startBatch(any(), any());
        verify(aiGrpcClient).startJobDescriptionAnalysis("负责开发，熟练使用 Java");
        verify(resultRepository).deleteByTaskId(20L);
        verify(resultRepository, never()).save(any());
        verify(taskRepository).markJdAnalysisSucceeded(20L, "raw-empty-jd-response");
    }

    @Test
    void embeddingFailureShouldStopBeforeJdAnalysis() {
        when(taskRepository.findByIdAndDeletedAtIsNull(20L))
                .thenReturn(Optional.of(task(TaskStatus.PENDING, TaskStatus.PENDING)));
        when(taskRepository.markAnalysisStarted(20L)).thenReturn(1);
        when(aiGrpcClient.startBatch(List.of("后端开发工程师"), audit()))
                .thenThrow(new IllegalStateException("ai unavailable"));

        service.analyze(20L, audit());

        verify(taskRepository).markOccupationAnalysisFailed(20L, "ai unavailable");
        verify(aiGrpcClient, never()).startJobDescriptionAnalysis(anyString());
    }

    @Test
    void jdFailureAfterAliasHitShouldMarkJdBranchFailed() {
        when(taskRepository.findByIdAndDeletedAtIsNull(20L))
                .thenReturn(Optional.of(task(TaskStatus.SUCCESS, TaskStatus.SUCCESS)));
        when(taskRepository.markAnalysisStarted(20L)).thenReturn(1);
        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job()));
        when(aiGrpcClient.startJobDescriptionAnalysis(anyString()))
                .thenThrow(new AIAnalysisException(
                        "jd response invalid", "raw-invalid-jd-response"));

        service.analyze(20L, audit());

        verify(taskRepository).markJdAnalysisFailed(
                20L, "jd response invalid", "raw-invalid-jd-response");
    }

    @Test
    void majorEmbeddingFailureShouldStopBeforeJdAnalysis() {
        when(taskRepository.findByIdAndDeletedAtIsNull(20L))
                .thenReturn(Optional.of(task(TaskStatus.SUCCESS, TaskStatus.PENDING)));
        when(taskRepository.markAnalysisStarted(20L)).thenReturn(1);
        when(aiGrpcClient.startBatch(List.of("软件工程"), audit()))
                .thenThrow(new IllegalStateException("major embedding unavailable"));

        service.analyze(20L, audit());

        verify(taskRepository).markMajorAnalysisFailed(20L, "major embedding unavailable");
        verify(aiGrpcClient, never()).startJobDescriptionAnalysis(anyString());
    }

    private JobAnalysisTask task(TaskStatus occupationStatus, TaskStatus majorStatus) {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setJobId(10L);
        task.setJobName("后端开发工程师");
        task.setJobMajor("软件工程");
        task.setTaskStatus(TaskStatus.PENDING);
        task.setOccupationAnalysisStatus(occupationStatus);
        task.setMajorAnalysisStatus(majorStatus);
        task.setJdAnalysisStatus(TaskStatus.PENDING);
        return task;
    }

    private Job job() {
        Job job = new Job();
        job.setId(10L);
        job.setJobDescription("负责开发，熟练使用 Java");
        return job;
    }

    private AuditContext audit() {
        return new AuditContext(1001L, 7L, "reviewer", "127.0.0.1", "POST", "/review");
    }
}
