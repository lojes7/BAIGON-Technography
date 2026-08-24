// 百工谱 — 新建规范技能异步向量化
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ExecutorService;

@Service
public class SkillEmbeddingService {

    private final SkillRepository skillRepository;
    private final AIGrpcClient aiGrpcClient;
    private final LogService logService;
    private final ExecutorService executor;
    private final TransactionOperations transactions;

    public SkillEmbeddingService(
            SkillRepository skillRepository,
            AIGrpcClient aiGrpcClient,
            LogService logService,
            @Qualifier("skillResolutionExecutor") ExecutorService executor,
            @Qualifier("skillResolutionTransactionOperations") TransactionOperations transactions) {
        this.skillRepository = skillRepository;
        this.aiGrpcClient = aiGrpcClient;
        this.logService = logService;
        this.executor = executor;
        this.transactions = transactions;
    }

    /** 新技能与别名全部提交后，再独立以规范名称生成向量。 */
    public void submitAfterCommit(Long skillId, AuditContext audit) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("new skill embedding must be scheduled inside a transaction");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    executor.submit(() -> embed(skillId, audit));
                } catch (RuntimeException exception) {
                    // 数据库仍是 PENDING，可由安全重放再次提交。
                    logService.error(audit, safeMessage(exception),
                            "submit new skill embedding failed: skill_id=" + skillId);
                }
            }
        });
    }

    public void embed(Long skillId, AuditContext audit) {
        Skill snapshot = skillRepository.findByIdAndDeletedAtIsNull(skillId)
                .orElseThrow(() -> new IllegalStateException("skill not found"));
        if (snapshot.getEmbeddingStatus() == TaskStatus.SUCCESS) {
            return;
        }
        // Repository 通过 next_retry_at 租约保证同一技能不会被多个 worker 同时领取。
        if (skillRepository.markEmbeddingStarted(skillId) != 1) {
            return;
        }
        Skill skill = skillRepository.findByIdAndDeletedAtIsNull(skillId)
                .orElseThrow(() -> new IllegalStateException("skill not found after claim"));
        try {
            AIGrpcClient.EmbeddingCall call =
                    aiGrpcClient.startBatch(List.of(skill.getName()), audit);
            String vector = vectorLiteral(call.await().getFirst());
            transactions.executeWithoutResult(status -> {
                if (skillRepository.markEmbeddingSucceeded(skillId, vector) != 1) {
                    throw new IllegalStateException("skill changed while saving embedding");
                }
            });
            logService.info(audit, "new skill embedded: skill_id=" + skillId);
        } catch (Exception exception) {
            String message = safeMessage(exception);
            skillRepository.markEmbeddingFailed(
                    skillId, message, OffsetDateTime.now().plusMinutes(5));
            logService.error(audit, message,
                    "embed new skill failed: skill_id=" + skillId);
        }
    }

    private String vectorLiteral(List<Float> vector) {
        StringBuilder builder = new StringBuilder(vector.size() * 12).append('[');
        for (int index = 0; index < vector.size(); index++) {
            if (index > 0) builder.append(',');
            builder.append(vector.get(index));
        }
        return builder.append(']').toString();
    }

    private static String safeMessage(Throwable throwable) {
        String message = throwable == null ? null : throwable.getMessage();
        String safe = message == null || message.isBlank()
                ? throwable == null ? "unknown skill embedding error"
                : throwable.getClass().getSimpleName()
                : message;
        return safe.length() <= 2000 ? safe : safe.substring(0, 2000);
    }
}
