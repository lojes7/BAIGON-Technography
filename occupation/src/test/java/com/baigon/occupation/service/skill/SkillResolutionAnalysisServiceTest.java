// 百工谱 — 岗位技能规范候选异步生成测试
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.config.JobAnalysisConfig;
import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillCandidateProjection;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionOperations;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillResolutionAnalysisServiceTest {

    private static final long TASK_ID = 20L;

    private JobSkillResolutionTaskRepository taskRepository;
    private JobSkillResolutionCandidateRepository candidateRepository;
    private SkillRepository skillRepository;
    private AIGrpcClient aiGrpcClient;
    private Snowflake snowflake;
    private SkillResolutionAnalysisService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobSkillResolutionTaskRepository.class);
        candidateRepository = mock(JobSkillResolutionCandidateRepository.class);
        skillRepository = mock(SkillRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        snowflake = mock(Snowflake.class);
        JobAnalysisConfig config = new JobAnalysisConfig();
        // 使用非默认值，验证技能候选与专业、职业候选共用同一个 Top N 配置。
        config.setCandidateLimit(3);
        service = new SkillResolutionAnalysisService(
                taskRepository,
                candidateRepository,
                skillRepository,
                aiGrpcClient,
                mock(LogService.class),
                snowflake,
                mock(ExecutorService.class),
                TransactionOperations.withoutTransaction(),
                config);
    }

    @Test
    void successShouldUseConfiguredCandidateLimitAndPersistRankedCandidates() throws Exception {
        AIGrpcClient.EmbeddingCall call = claimedTaskWithEmbedding();
        SkillCandidateProjection first = candidate(301L, "检索增强生成（RAG）", 0.98D);
        SkillCandidateProjection second = candidate(302L, "向量数据库", 0.87D);
        when(skillRepository.findNearestByNameVector("[0.1,0.2]", 3))
                .thenReturn(List.of(first, second));
        when(taskRepository.markGenerationSucceeded(
                TASK_ID, "[0.1,0.2]", "qwen-embedding"))
                .thenReturn(1);
        when(snowflake.nextId()).thenReturn(1001L, 1002L);

        service.analyze(TASK_ID, audit());

        verify(aiGrpcClient).startBatch(List.of("检索增强生成"), taskAudit());
        verify(skillRepository).findNearestByNameVector("[0.1,0.2]", 3);
        verify(candidateRepository).deleteByTaskId(TASK_ID);
        ArgumentCaptor<JobSkillResolutionCandidate> candidates =
                ArgumentCaptor.forClass(JobSkillResolutionCandidate.class);
        verify(candidateRepository, org.mockito.Mockito.times(2)).save(candidates.capture());
        assertEquals(List.of(1, 2), candidates.getAllValues().stream()
                .map(JobSkillResolutionCandidate::getRank).toList());
        assertEquals(List.of(301L, 302L), candidates.getAllValues().stream()
                .map(JobSkillResolutionCandidate::getSkillId).toList());
        verify(taskRepository).markGenerationSucceeded(
                TASK_ID, "[0.1,0.2]", "qwen-embedding");
        // 调用句柄在成功后才暴露真实模型名。
        verify(call).modelName();
    }

    @Test
    void repeatedClaimShouldReturnWithoutCallingAi() {
        when(taskRepository.markGenerationStarted(TASK_ID)).thenReturn(0);

        service.analyze(TASK_ID, audit());

        verify(taskRepository, never()).findByIdAndDeletedAtIsNull(any());
        verify(aiGrpcClient, never()).startBatch(any(), any(AuditContext.class));
        verify(taskRepository, never()).markGenerationSucceeded(any(), anyString(), anyString());
        verify(taskRepository, never()).markGenerationFailed(any(), anyString());
    }

    @Test
    void emptyCandidatesShouldStillMarkGenerationSucceeded() throws Exception {
        claimedTaskWithEmbedding();
        when(skillRepository.findNearestByNameVector("[0.1,0.2]", 3))
                .thenReturn(List.of());
        when(taskRepository.markGenerationSucceeded(
                TASK_ID, "[0.1,0.2]", "qwen-embedding"))
                .thenReturn(1);

        service.analyze(TASK_ID, audit());

        verify(candidateRepository).deleteByTaskId(TASK_ID);
        verify(candidateRepository, never()).save(any(JobSkillResolutionCandidate.class));
        verify(taskRepository).markGenerationSucceeded(
                TASK_ID, "[0.1,0.2]", "qwen-embedding");
        verify(taskRepository, never()).markGenerationFailed(any(), anyString());
    }

    @Test
    void embeddingFailureShouldMarkGenerationFailed() {
        when(taskRepository.markGenerationStarted(TASK_ID)).thenReturn(1);
        when(taskRepository.findByIdAndDeletedAtIsNull(TASK_ID))
                .thenReturn(Optional.of(task()));
        when(aiGrpcClient.startBatch(List.of("检索增强生成"), taskAudit()))
                .thenThrow(new IllegalStateException("embedding unavailable"));

        service.analyze(TASK_ID, audit());

        verify(taskRepository).markGenerationFailed(TASK_ID, "embedding unavailable");
        verify(candidateRepository, never()).deleteByTaskId(any());
        verify(taskRepository, never()).markGenerationSucceeded(any(), anyString(), anyString());
    }

    private AIGrpcClient.EmbeddingCall claimedTaskWithEmbedding() throws Exception {
        AIGrpcClient.EmbeddingCall call = mock(AIGrpcClient.EmbeddingCall.class);
        when(taskRepository.markGenerationStarted(TASK_ID)).thenReturn(1);
        when(taskRepository.findByIdAndDeletedAtIsNull(TASK_ID))
                .thenReturn(Optional.of(task()));
        when(aiGrpcClient.startBatch(List.of("检索增强生成"), taskAudit()))
                .thenReturn(call);
        when(call.await()).thenReturn(List.of(List.of(0.1F, 0.2F)));
        when(call.modelName()).thenReturn("qwen-embedding");
        return call;
    }

    private SkillCandidateProjection candidate(long id, String name, double similarity) {
        SkillCandidateProjection candidate = mock(SkillCandidateProjection.class);
        when(candidate.getId()).thenReturn(id);
        when(candidate.getName()).thenReturn(name);
        when(candidate.getSimilarity()).thenReturn(similarity);
        return candidate;
    }

    private JobSkillResolutionTask task() {
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(TASK_ID);
        task.setTraceId(9001L);
        task.setSkillName("检索增强生成");
        return task;
    }

    private AuditContext audit() {
        return new AuditContext(8001L, 7L, "reviewer", "127.0.0.1",
                "PUT", "/api/auth/occupation/job-skill-resolution/20/review");
    }

    private AuditContext taskAudit() {
        return audit().withTraceId(9001L);
    }
}
