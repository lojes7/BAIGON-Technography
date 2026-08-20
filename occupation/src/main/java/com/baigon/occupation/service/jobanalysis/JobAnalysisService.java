// 百工谱 — 岗位职业匹配与真实 JD 串行分析服务
package com.baigon.occupation.service.jobanalysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.config.JobAnalysisConfig;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
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
import java.util.Set;
import java.util.concurrent.ExecutorService;

@Service
public class JobAnalysisService {

    private static final Set<String> PROFICIENCIES =
            Set.of("EXPERT", "ADVANCED", "FAMILIAR", "BASIC");

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisCandidateRepository candidateRepository;
    private final JobAnalysisResultRepository resultRepository;
    private final JobRepository jobRepository;
    private final OccupationRepository occupationRepository;
    private final AIGrpcClient aiGrpcClient;
    private final LogService logService;
    private final Snowflake snowflake;
    private final ExecutorService executor;
    private final TransactionOperations transactions;
    private final int candidateLimit;

    public JobAnalysisService(JobAnalysisTaskRepository taskRepository,
                              JobAnalysisCandidateRepository candidateRepository,
                              JobAnalysisResultRepository resultRepository,
                              JobRepository jobRepository,
                              OccupationRepository occupationRepository,
                              AIGrpcClient aiGrpcClient,
                              LogService logService,
                              Snowflake snowflake,
                              @Qualifier("jobAnalysisExecutor") ExecutorService executor,
                              @Qualifier("jobAnalysisTransactionOperations") TransactionOperations transactions,
                              JobAnalysisConfig config) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.resultRepository = resultRepository;
        this.jobRepository = jobRepository;
        this.occupationRepository = occupationRepository;
        this.aiGrpcClient = aiGrpcClient;
        this.logService = logService;
        this.snowflake = snowflake;
        this.executor = executor;
        this.transactions = transactions;
        this.candidateLimit = config.getCandidateLimit();
    }

    /** 审核事务成功提交后再启动后台串行分析，避免远程调用占用数据库事务。 */
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

    /**
     * 单个后台任务严格串行执行：先完成职业匹配，再分析真实 JD。
     * 别名命中时 occupationAnalysisStatus 已是 SUCCESS，因此直接进入 JD 分析。
     */
    public void analyze(Long taskId, AuditContext audit) {
        JobAnalysisTask task = taskRepository.findByIdAndDeletedAtIsNull(taskId)
                .orElseThrow(() -> new IllegalStateException("job analysis task not found"));
        if (task.getTaskStatus() == TaskStatus.SUCCESS) {
            return;
        }
        if (taskRepository.markAnalysisStarted(taskId) != 1) {
            throw new IllegalStateException("job analysis task not found while starting");
        }

        if (task.getOccupationAnalysisStatus() != TaskStatus.SUCCESS) {
            try {
                analyzeOccupation(task, audit);
            } catch (Exception exception) {
                String message = safeMessage(exception);
                taskRepository.markOccupationAnalysisFailed(taskId, message);
                logService.error(audit, message,
                        "job occupation analysis failed: task_id=" + taskId);
                return;
            }
        }

        try {
            analyzeJobDescription(task, audit);
            logService.info(audit, "job analysis success: task_id=" + taskId);
        } catch (Exception exception) {
            String message = safeMessage(exception);
            taskRepository.markJdAnalysisFailed(taskId, message);
            logService.error(audit, message, "job description analysis failed: task_id=" + taskId);
        }
    }

    /** 岗位名称向量化成功并保存职业候选后，调用方才会继续执行 JD 分析。 */
    private void analyzeOccupation(JobAnalysisTask task, AuditContext audit) throws Exception {
        if (task.getJobName() == null || task.getJobName().isBlank()) {
            throw new IllegalArgumentException("job_name is empty");
        }
        AIGrpcClient.EmbeddingCall call = aiGrpcClient.startBatch(List.of(task.getJobName()), audit);
        List<Float> vector = call.await().get(0);
        String vectorLiteral = vectorLiteral(vector);
        List<OccupationCandidateProjection> matches =
                occupationRepository.findNearestByNameVector(vectorLiteral, candidateLimit);
        completeOccupation(task.getId(), vectorLiteral, call.modelName(), matches);
        logService.info(audit, "job occupation analysis success: task_id=" + task.getId()
                + ", candidates=" + matches.size());
    }

    /** 使用 jobs 中最终审核快照的真实 JD，绝不使用演示文本或岗位名称代替。 */
    private void analyzeJobDescription(JobAnalysisTask task, AuditContext audit) throws Exception {
        Job job = jobRepository.findByIdAndDeletedAtIsNull(task.getJobId())
                .orElseThrow(() -> new IllegalStateException("job not found"));
        AIGrpcClient.JobDescriptionAnalysisCall call =
                aiGrpcClient.startJobDescriptionAnalysis(job.getJobDescription());
        List<AIGrpcClient.AnalyzedSkillResult> skills = call.await();
        completeJobDescription(task.getId(), task.getJobId(), skills);
        logService.info(audit, "job description analysis success: task_id=" + task.getId()
                + ", skills=" + skills.size());
    }

    /** 候选列表与职业分析成功状态在同一个短事务中提交。 */
    private void completeOccupation(Long taskId,
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
            if (taskRepository.markOccupationAnalysisSucceeded(
                    taskId, vector, modelName) != 1) {
                throw new IllegalStateException("job analysis task not found while completing occupation analysis");
            }
        });
    }

    /** AI 技能结果与总任务成功状态原子提交；空技能列表同样是合法成功结果。 */
    private void completeJobDescription(Long taskId,
                                        Long jobId,
                                        List<AIGrpcClient.AnalyzedSkillResult> skills) {
        transactions.executeWithoutResult(ignored -> {
            resultRepository.deleteByTaskId(taskId);
            OffsetDateTime now = OffsetDateTime.now();
            int rank = 1;
            for (AIGrpcClient.AnalyzedSkillResult skill : skills) {
                String proficiency = validateSkill(skill);
                JobAnalysisResult result = new JobAnalysisResult();
                result.setId(snowflake.nextId());
                result.setTaskId(taskId);
                result.setJobId(jobId);
                result.setSkillName(skill.name().trim());
                result.setSkillProficiency(proficiency);
                result.setEvidence(skill.evidence().trim());
                result.setRank(rank++);
                result.setCreatedAt(now);
                result.setUpdatedAt(now);
                resultRepository.save(result);
            }
            if (taskRepository.markJdAnalysisSucceeded(taskId) != 1) {
                throw new IllegalStateException("occupation analysis is not complete");
            }
        });
    }

    private String validateSkill(AIGrpcClient.AnalyzedSkillResult skill) {
        if (skill == null || skill.name() == null || skill.name().isBlank()
                || skill.name().trim().length() > 100) {
            throw new IllegalArgumentException("AI skill name is invalid");
        }
        String proficiency = normalizedProficiency(skill.proficiency());
        if (!PROFICIENCIES.contains(proficiency)) {
            throw new IllegalArgumentException("AI skill proficiency is invalid");
        }
        if (skill.evidence() == null || skill.evidence().isBlank()) {
            throw new IllegalArgumentException("AI skill evidence is empty");
        }
        return proficiency;
    }

    /** AI 技能契约和数据库均使用全大写；trim/uppercase 只作防御性边界规范化。 */
    private String normalizedProficiency(String value) {
        return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
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
