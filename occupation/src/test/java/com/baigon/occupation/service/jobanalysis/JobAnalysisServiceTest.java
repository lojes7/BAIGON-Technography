// 百工谱 — 岗位名称向量候选测试
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.config.JobAnalysisConfig;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.grpc.AIGrpcClient;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.occupation.OccupationCandidateProjection;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionOperations;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisCandidateRepository candidateRepository;
    private OccupationRepository occupationRepository;
    private AIGrpcClient aiGrpcClient;
    private JobAnalysisService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        candidateRepository = mock(JobAnalysisCandidateRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        JobAnalysisConfig config = new JobAnalysisConfig();
        service = new JobAnalysisService(
                taskRepository, candidateRepository, occupationRepository,
                aiGrpcClient, mock(LogService.class), new Snowflake(5, 1),
                mock(ExecutorService.class), TransactionOperations.withoutTransaction(), config);
    }

    @Test
    void shouldQueryConfiguredTopNAndPersistModelCandidates() throws Exception {
        JobAnalysisTask task = task();
        AIGrpcClient.EmbeddingCall call = mock(AIGrpcClient.EmbeddingCall.class);
        OccupationCandidateProjection candidate = mock(OccupationCandidateProjection.class);
        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task));
        when(aiGrpcClient.startBatch(List.of("后端开发工程师"), audit())).thenReturn(call);
        when(call.await()).thenReturn(List.of(List.of(0.1F, 0.2F)));
        when(call.modelName()).thenReturn("qwen-embedding");
        when(candidate.getId()).thenReturn(99L);
        when(candidate.getName()).thenReturn("计算机程序设计员");
        when(candidate.getSimilarity()).thenReturn(0.98D);
        when(occupationRepository.findNearestByNameVector(anyString(), eq(5)))
                .thenReturn(List.of(candidate));
        when(taskRepository.markAnalysisSucceeded(20L, "[0.1,0.2]", "qwen-embedding"))
                .thenReturn(1);

        service.analyze(20L, audit());

        verify(taskRepository).markAnalysisStarted(20L);
        verify(occupationRepository).findNearestByNameVector("[0.1,0.2]", 5);
        verify(candidateRepository).save(any(JobAnalysisCandidate.class));
        verify(taskRepository).markAnalysisSucceeded(20L, "[0.1,0.2]", "qwen-embedding");
    }

    @Test
    void aiFailureShouldKeepJobAndMarkOnlyAnalysisTaskFailed() {
        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task()));
        when(aiGrpcClient.startBatch(List.of("后端开发工程师"), audit()))
                .thenThrow(new IllegalStateException("ai unavailable"));

        service.analyze(20L, audit());

        verify(taskRepository).markAnalysisFailed(20L, "ai unavailable");
    }

    private JobAnalysisTask task() {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setJobName("后端开发工程师");
        return task;
    }

    private AuditContext audit() {
        return new AuditContext(1001L, 7L, "reviewer", "127.0.0.1", "POST", "/review");
    }
}
