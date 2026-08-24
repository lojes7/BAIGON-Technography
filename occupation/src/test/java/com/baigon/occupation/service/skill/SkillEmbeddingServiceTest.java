// 百工谱 — 新建规范技能异步向量化测试
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillEmbeddingServiceTest {

    private static final long SKILL_ID = 30L;

    private SkillRepository skillRepository;
    private AIGrpcClient aiGrpcClient;
    private ExecutorService executor;
    private SkillEmbeddingService service;

    @BeforeEach
    void setUp() {
        skillRepository = mock(SkillRepository.class);
        aiGrpcClient = mock(AIGrpcClient.class);
        executor = mock(ExecutorService.class);
        service = new SkillEmbeddingService(
                skillRepository,
                aiGrpcClient,
                mock(LogService.class),
                executor,
                TransactionOperations.withoutTransaction());
    }

    @Test
    void successShouldEmbedCanonicalSkillNameAndPersistVector() throws Exception {
        Skill skill = skill(TaskStatus.PENDING);
        when(skillRepository.findByIdAndDeletedAtIsNull(SKILL_ID))
                .thenReturn(Optional.of(skill), Optional.of(skill));
        when(skillRepository.markEmbeddingStarted(SKILL_ID)).thenReturn(1);
        AIGrpcClient.EmbeddingCall call = mock(AIGrpcClient.EmbeddingCall.class);
        when(aiGrpcClient.startBatch(List.of("检索增强生成（RAG）"), audit()))
                .thenReturn(call);
        when(call.await()).thenReturn(List.of(List.of(0.3F, 0.4F)));
        when(skillRepository.markEmbeddingSucceeded(SKILL_ID, "[0.3,0.4]"))
                .thenReturn(1);

        service.embed(SKILL_ID, audit());

        // 新技能必须重新使用 skills.name，而不是待解析 alias 的文本生成向量。
        verify(aiGrpcClient).startBatch(List.of("检索增强生成（RAG）"), audit());
        verify(skillRepository).markEmbeddingSucceeded(SKILL_ID, "[0.3,0.4]");
        verify(skillRepository, never()).markEmbeddingFailed(
                any(), anyString(), any(OffsetDateTime.class));
    }

    @Test
    void successfulSkillShouldSkipClaimAndAi() {
        when(skillRepository.findByIdAndDeletedAtIsNull(SKILL_ID))
                .thenReturn(Optional.of(skill(TaskStatus.SUCCESS)));

        service.embed(SKILL_ID, audit());

        verify(skillRepository, never()).markEmbeddingStarted(any());
        verify(aiGrpcClient, never()).startBatch(any(), any(AuditContext.class));
    }

    @Test
    void failedClaimShouldSkipReloadAndAi() {
        when(skillRepository.findByIdAndDeletedAtIsNull(SKILL_ID))
                .thenReturn(Optional.of(skill(TaskStatus.PENDING)));
        when(skillRepository.markEmbeddingStarted(SKILL_ID)).thenReturn(0);

        service.embed(SKILL_ID, audit());

        verify(skillRepository, times(1)).findByIdAndDeletedAtIsNull(SKILL_ID);
        verify(aiGrpcClient, never()).startBatch(any(), any(AuditContext.class));
        verify(skillRepository, never()).markEmbeddingSucceeded(any(), anyString());
    }

    @Test
    void embeddingFailureShouldPersistFailedState() {
        Skill skill = skill(TaskStatus.PENDING);
        when(skillRepository.findByIdAndDeletedAtIsNull(SKILL_ID))
                .thenReturn(Optional.of(skill), Optional.of(skill));
        when(skillRepository.markEmbeddingStarted(SKILL_ID)).thenReturn(1);
        when(aiGrpcClient.startBatch(List.of("检索增强生成（RAG）"), audit()))
                .thenThrow(new IllegalStateException("embedding unavailable"));

        service.embed(SKILL_ID, audit());

        verify(skillRepository).markEmbeddingFailed(
                eq(SKILL_ID), eq("embedding unavailable"), any(OffsetDateTime.class));
        verify(skillRepository, never()).markEmbeddingSucceeded(any(), anyString());
    }

    @Test
    void submitAfterCommitShouldOnlySubmitAfterTransactionCommits() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            service.submitAfterCommit(SKILL_ID, audit());

            verify(executor, never()).submit(any(Runnable.class));
            List<TransactionSynchronization> synchronizations =
                    TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, synchronizations.size());

            synchronizations.getFirst().afterCommit();

            verify(executor).submit(any(Runnable.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    private Skill skill(TaskStatus status) {
        Skill skill = new Skill();
        skill.setId(SKILL_ID);
        skill.setName("检索增强生成（RAG）");
        skill.setEmbeddingStatus(status);
        return skill;
    }

    private AuditContext audit() {
        return new AuditContext(9001L, 7L, "reviewer", "127.0.0.1",
                "PUT", "/api/auth/occupation/job-skill-resolution/20/review");
    }
}
