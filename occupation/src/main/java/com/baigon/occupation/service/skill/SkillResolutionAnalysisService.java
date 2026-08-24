// 百工谱 — 岗位技能规范候选异步生成
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
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ExecutorService;

@Service
public class SkillResolutionAnalysisService {

    private final JobSkillResolutionTaskRepository taskRepository;
    private final JobSkillResolutionCandidateRepository candidateRepository;
    private final SkillRepository skillRepository;
    private final AIGrpcClient aiGrpcClient;
    private final LogService logService;
    private final Snowflake snowflake;
    private final ExecutorService executor;
    private final TransactionOperations transactions;
    private final int candidateLimit;

    public SkillResolutionAnalysisService(
            JobSkillResolutionTaskRepository taskRepository,
            JobSkillResolutionCandidateRepository candidateRepository,
            SkillRepository skillRepository,
            AIGrpcClient aiGrpcClient,
            LogService logService,
            Snowflake snowflake,
            @Qualifier("skillResolutionExecutor") ExecutorService executor,
            @Qualifier("skillResolutionTransactionOperations") TransactionOperations transactions,
            JobAnalysisConfig config) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.skillRepository = skillRepository;
        this.aiGrpcClient = aiGrpcClient;
        this.logService = logService;
        this.snowflake = snowflake;
        this.executor = executor;
        this.transactions = transactions;
        this.candidateLimit = config.getCandidateLimit();
    }

    /** 只有岗位分析审核事务真正提交后，才允许开始生成技能候选。 */
    public void submitAfterCommit(Long taskId, AuditContext audit) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("skill resolution must be scheduled inside a transaction");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    executor.submit(() -> analyze(taskId, audit));
                } catch (RuntimeException exception) {
                    // 保持 PENDING，便于之后安全重放，不伪造为已执行失败。
                    logService.error(audit, safeMessage(exception),
                            "submit skill resolution failed: task_id=" + taskId);
                }
            }
        });
    }

    /** 原子领取后在事务外调用 AI，最后用一个短事务替换候选并提交成功状态。 */
    public void analyze(Long taskId, AuditContext audit) {
        if (taskRepository.markGenerationStarted(taskId) != 1) {
            return;
        }
        JobSkillResolutionTask task = taskRepository.findByIdAndDeletedAtIsNull(taskId)
                .orElseThrow(() -> new IllegalStateException("skill resolution task not found"));
        AuditContext taskAudit = audit.withTraceId(task.getTraceId());
        try {
            AIGrpcClient.EmbeddingCall call =
                    aiGrpcClient.startBatch(List.of(task.getSkillName()), taskAudit);
            List<Float> vector = call.await().getFirst();
            String vectorLiteral = vectorLiteral(vector);
            List<SkillCandidateProjection> nearest =
                    skillRepository.findNearestByNameVector(vectorLiteral, candidateLimit);
            transactions.executeWithoutResult(status -> saveCandidates(
                    taskId, nearest, vectorLiteral, call.modelName()));
            logService.info(taskAudit, "skill resolution candidates generated: task_id="
                    + taskId + ", candidates=" + nearest.size());
        } catch (Exception exception) {
            String message = safeMessage(exception);
            taskRepository.markGenerationFailed(taskId, message);
            logService.error(taskAudit, message,
                    "generate skill resolution candidates failed: task_id=" + taskId);
        }
    }

    private void saveCandidates(Long taskId,
                                List<SkillCandidateProjection> candidates,
                                String vector,
                                String modelName) {
        candidateRepository.deleteByTaskId(taskId);
        OffsetDateTime now = OffsetDateTime.now();
        int rank = 1;
        for (SkillCandidateProjection item : candidates) {
            JobSkillResolutionCandidate candidate = new JobSkillResolutionCandidate();
            candidate.setId(snowflake.nextId());
            candidate.setTaskId(taskId);
            candidate.setSkillId(item.getId());
            candidate.setSkillName(item.getName());
            candidate.setRank(rank++);
            candidate.setSimilarity(item.getSimilarity());
            candidate.setCreatedAt(now);
            candidate.setUpdatedAt(now);
            candidateRepository.save(candidate);
        }
        if (taskRepository.markGenerationSucceeded(taskId, vector, modelName) != 1) {
            throw new IllegalStateException("skill resolution task changed while saving candidates");
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
                ? throwable == null ? "unknown skill resolution error"
                : throwable.getClass().getSimpleName()
                : message;
        return safe.length() <= 2000 ? safe : safe.substring(0, 2000);
    }
}
