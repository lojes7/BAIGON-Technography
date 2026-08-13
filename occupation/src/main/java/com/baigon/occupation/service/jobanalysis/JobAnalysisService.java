// 百工谱 — 岗位名称向量匹配服务
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
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ExecutorService;

@Service
public class JobAnalysisService {

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisCandidateRepository candidateRepository;
    private final OccupationRepository occupationRepository;
    private final AIGrpcClient aiGrpcClient;
    private final LogService logService;
    private final Snowflake snowflake;
    private final ExecutorService executor;
    private final TransactionOperations transactions;
    private final int candidateLimit;

    public JobAnalysisService(JobAnalysisTaskRepository taskRepository,
                              JobAnalysisCandidateRepository candidateRepository,
                              OccupationRepository occupationRepository,
                              AIGrpcClient aiGrpcClient,
                              LogService logService,
                              Snowflake snowflake,
                              @Qualifier("jobAnalysisExecutor") ExecutorService executor,
                              @Qualifier("jobAnalysisTransactionOperations") TransactionOperations transactions,
                              JobAnalysisConfig config) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.occupationRepository = occupationRepository;
        this.aiGrpcClient = aiGrpcClient;
        this.logService = logService;
        this.snowflake = snowflake;
        this.executor = executor;
        this.transactions = transactions;
        this.candidateLimit = config.getCandidateLimit();
    }

    /** 审核事务成功提交后再启动 AI，避免远程调用占用数据库事务。 */
    public void submitAfterCommit(Long taskId, AuditContext audit) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("job analysis must be scheduled inside a transaction");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    executor.submit(() -> analyze(taskId, audit));
                } catch (RuntimeException exception) {
                    String message = safeMessage(exception);
                    taskRepository.markAnalysisFailed(taskId, message);
                    logService.error(audit, message, "submit job analysis failed: task_id=" + taskId);
                }
            }
        });
    }

    /** AI 失败只更新分析任务；jobs 已在审核事务中提交。 */
    public void analyze(Long taskId, AuditContext audit) {
        JobAnalysisTask task = taskRepository.findByIdAndDeletedAtIsNull(taskId)
                .orElseThrow(() -> new IllegalStateException("job analysis task not found"));
        taskRepository.markAnalysisStarted(taskId);
        try {
            if (task.getJobName() == null || task.getJobName().isBlank()) {
                throw new IllegalArgumentException("job_name is empty");
            }
            AIGrpcClient.EmbeddingCall call = aiGrpcClient.startBatch(List.of(task.getJobName()), audit);
            List<Float> vector = call.await().get(0);
            String vectorLiteral = vectorLiteral(vector);
            List<OccupationCandidateProjection> matches =
                    occupationRepository.findNearestByNameVector(vectorLiteral, candidateLimit);
            complete(taskId, vectorLiteral, call.modelName(), matches);
            logService.info(audit, "job analysis success: task_id=" + taskId + ", candidates=" + matches.size());
        } catch (Exception exception) {
            String message = safeMessage(exception);
            taskRepository.markAnalysisFailed(taskId, message);
            logService.error(audit, message, "job analysis failed: task_id=" + taskId);
        }
    }

    /** 候选列表与任务成功状态必须在同一个短事务中提交。 */
    private void complete(Long taskId,
                          String vector,
                          String modelName,
                          List<OccupationCandidateProjection> matches) {
        transactions.executeWithoutResult(ignored -> {
            candidateRepository.deleteByTaskId(taskId);
            OffsetDateTime now = OffsetDateTime.now();
            int rank = 1;
            for (OccupationCandidateProjection match : matches) {
                JobAnalysisCandidate candidate = new JobAnalysisCandidate();
                candidate.setId(snowflake.nextId());
                candidate.setTaskId(taskId);
                candidate.setOccupationId(match.getId());
                candidate.setOccupationName(match.getName());
                candidate.setRank(rank++);
                candidate.setSimilarity(match.getSimilarity());
                candidate.setCreatedAt(now);
                candidate.setUpdatedAt(now);
                candidateRepository.save(candidate);
            }
            if (taskRepository.markAnalysisSucceeded(taskId, vector, modelName) != 1) {
                throw new IllegalStateException("job analysis task not found while completing");
            }
        });
    }

    private String vectorLiteral(List<Float> vector) {
        StringBuilder builder = new StringBuilder(vector.size() * 10).append('[');
        for (int index = 0; index < vector.size(); index++) {
            if (index > 0) builder.append(',');
            Float value = vector.get(index);
            if (value == null || !Float.isFinite(value)) {
                throw new IllegalArgumentException("AI vector contains invalid value");
            }
            builder.append(value);
        }
        return builder.append(']').toString();
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) message = exception.getClass().getSimpleName();
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }
}
