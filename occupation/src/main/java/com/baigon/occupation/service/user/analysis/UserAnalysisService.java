// 百工谱 — 当前用户简历技能分析、能力时间线与人岗匹配编排
package com.baigon.occupation.service.user.analysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import com.baigon.occupation.entity.user.analysis.UserGraph;
import com.baigon.occupation.entity.user.analysis.UserSkillProficiency;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.user.analysis.UserAnalysisTaskRepository;
import com.baigon.occupation.repository.user.analysis.UserGraphRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;

import java.text.Normalizer;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class UserAnalysisService {

    private static final int MAX_SKILLS = 100;
    private static final int MAX_SUGGESTIONS = 100;
    private static final int MAX_SKILL_NAME_LENGTH = 100;
    private static final int MAX_EVIDENCE_LENGTH = 1_000;
    private static final int MAX_TEXT_LENGTH = 2_000;
    private static final int MAX_MODEL_NAME_LENGTH = 64;
    private static final String STALE_TASK_ERROR = "ANALYSIS_TIMEOUT";

    private final UserAnalysisTaskRepository taskRepository;
    private final UserGraphRepository graphRepository;
    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final AIGrpcClient aiGrpcClient;
    private final LogService logService;
    private final Snowflake snowflake;
    private final ObjectMapper objectMapper;
    private final TransactionOperations transactions;
    private final Duration pendingStaleAfter;

    public UserAnalysisService(
            UserAnalysisTaskRepository taskRepository,
            UserGraphRepository graphRepository,
            ResumeRepository resumeRepository,
            JobRepository jobRepository,
            AIGrpcClient aiGrpcClient,
            LogService logService,
            Snowflake snowflake,
            ObjectMapper objectMapper,
            @Value("${ai.user-analysis-timeout-seconds:120}") long userAnalysisTimeoutSeconds,
            @Qualifier("userAnalysisTransactionOperations") TransactionOperations transactions) {
        if (userAnalysisTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.user-analysis-timeout-seconds must be > 0");
        }
        this.taskRepository = taskRepository;
        this.graphRepository = graphRepository;
        this.resumeRepository = resumeRepository;
        this.jobRepository = jobRepository;
        this.aiGrpcClient = aiGrpcClient;
        this.logService = logService;
        this.snowflake = snowflake;
        this.objectMapper = objectMapper;
        this.transactions = transactions;
        // 在 AI deadline 之外再预留一分钟完成 gRPC 取消传播与结果事务。
        this.pendingStaleAfter = Duration.ofSeconds(
                Math.addExact(userAnalysisTimeoutSeconds, 60L));
    }

    /** 分析当前用户最新简历；远程 AI 调用绝不占用数据库事务。 */
    public SkillAnalysisData analyzeMyResumeSkills(long userId, AuditContext audit) {
        PreparedAnalysis prepared = prepare(
                userId, null, UserAnalysisType.RESUME_SKILL_ANALYSIS, audit);
        AIGrpcClient.UserSkillAnalysisResult result;
        List<ValidatedSkill> skills;
        String modelName;
        try {
            result = aiGrpcClient.analyzeUserSkills(prepared.resumeContent(), audit);
            skills = validateSkills(result, prepared.resumeContent());
            modelName = requiredText(
                    result.modelName(), MAX_MODEL_NAME_LENGTH, "model name");
        } catch (RuntimeException exception) {
            markFailed(prepared.taskId(), exception, audit, "user resume skill analysis failed");
            throw aiFailure(exception);
        }
        try {
            SkillAnalysisData saved = completeSkills(prepared, modelName, skills);
            logService.info(audit, "user resume skill analysis success: resume_id="
                    + prepared.resumeId() + ", skills=" + skills.size());
            return saved;
        } catch (RuntimeException exception) {
            markFailed(prepared.taskId(), exception, audit, "persist user skill analysis failed");
            throw internalFailure(exception);
        }
    }

    /** 返回全部历史技能观察记录；createdAt 表示本次系统分析写入时间。 */
    public List<UserSkillData> listMySkills(long userId) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        return graphRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtAscRankAscIdAsc(userId)
                .stream()
                .map(this::toSkillData)
                .toList();
    }

    /** 人岗匹配严格只读取 jobs 表；不访问岗位分析结果、正式技能或职业表。 */
    public JobMatchData matchMyResumeToJob(long userId, long jobId, AuditContext audit) {
        if (jobId <= 0) {
            throw new IllegalArgumentException("job_id must be > 0");
        }
        PreparedAnalysis prepared = prepare(userId, jobId, UserAnalysisType.JOB_MATCH, audit);
        AIGrpcClient.JobMatchAnalysisResult result;
        ValidatedMatch match;
        String modelName;
        try {
            result = aiGrpcClient.analyzeJobMatch(
                    prepared.resumeContent(), prepared.jobInput(), audit);
            match = validateMatch(result);
            modelName = requiredText(
                    result.modelName(), MAX_MODEL_NAME_LENGTH, "model name");
        } catch (RuntimeException exception) {
            markFailed(prepared.taskId(), exception, audit, "user job match analysis failed");
            throw aiFailure(exception);
        }
        try {
            JobMatchData saved = completeMatch(prepared, modelName, match);
            logService.info(audit, "user job match success: resume_id=" + prepared.resumeId()
                    + ", job_id=" + jobId + ", score=" + match.score());
            return saved;
        } catch (RuntimeException exception) {
            markFailed(prepared.taskId(), exception, audit, "persist user job match failed");
            throw internalFailure(exception);
        }
    }

    private PreparedAnalysis prepare(
            long userId,
            Long jobId,
            UserAnalysisType type,
            AuditContext audit) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        try {
            PreparedAnalysis prepared = transactions.execute(ignored -> {
                Resume resume = resumeRepository
                        .findFirstByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                        .orElseThrow(() -> new ApiException(
                                ApiException.ErrorCode.NOT_FOUND, "resume not found"));
                if (resume.getContent() == null || resume.getContent().isBlank()) {
                    throw new ApiException(
                            ApiException.ErrorCode.BAD_REQUEST, "latest resume content is empty");
                }

                Job job = null;
                AIGrpcClient.JobMatchInput jobInput = null;
                if (type == UserAnalysisType.JOB_MATCH) {
                    job = jobRepository.findByIdAndDeletedAtIsNull(jobId)
                            .orElseThrow(() -> new ApiException(
                                    ApiException.ErrorCode.NOT_FOUND, "job not found"));
                    jobInput = toJobInput(job);
                }

                long taskId = snowflake.nextId();
                long traceId = audit.traceId() == null ? taskId : audit.traceId();
                OffsetDateTime now = OffsetDateTime.now();
                recoverOrRejectPending(userId, resume.getId(), jobId, type, now);
                UserAnalysisTask task = new UserAnalysisTask();
                task.setId(taskId);
                task.setCreatedAt(now);
                task.setUpdatedAt(now);
                task.setTraceId(traceId);
                task.setUserId(userId);
                task.setResumeId(resume.getId());
                task.setJobId(job == null ? null : job.getId());
                task.setTaskType(type);
                task.setTaskStatus(TaskStatus.PENDING);
                task.setSkillsToLearn(objectMapper.createArrayNode());
                task.setActionSuggestions(objectMapper.createArrayNode());
                taskRepository.saveAndFlush(task);
                return new PreparedAnalysis(
                        taskId, resume.getId(), resume.getContent(), job == null ? null : job.getId(), jobInput);
            });
            if (prepared == null) {
                throw new IllegalStateException("user analysis transaction returned no result");
            }
            return prepared;
        } catch (DataIntegrityViolationException exception) {
            if (isPendingConstraintViolation(exception)) {
                throw new ApiException(
                        ApiException.ErrorCode.TASK_ALREADY_RUNNING,
                        "analysis task already running");
            }
            throw new ApiException(
                    ApiException.ErrorCode.INTERNAL_ERROR,
                    "create user analysis task failed");
        }
    }

    private void recoverOrRejectPending(
            long userId,
            long resumeId,
            Long jobId,
            UserAnalysisType type,
            OffsetDateTime now) {
        taskRepository
                .findFirstByUserIdAndResumeIdAndJobIdAndTaskTypeAndTaskStatusAndDeletedAtIsNull(
                        userId, resumeId, jobId, type, TaskStatus.PENDING)
                .ifPresent(pending -> {
                    OffsetDateTime staleBefore = now.minus(pendingStaleAfter);
                    if (pending.getCreatedAt() == null
                            || pending.getCreatedAt().isAfter(staleBefore)) {
                        throw new ApiException(
                                ApiException.ErrorCode.TASK_ALREADY_RUNNING,
                                "analysis task already running");
                    }
                    // 进程异常退出可能遗留 PENDING；新请求先回收再创建全新任务。
                    pending.setTaskStatus(TaskStatus.FAILED);
                    pending.setErrorMsg(STALE_TASK_ERROR);
                    pending.setUpdatedAt(now);
                    taskRepository.saveAndFlush(pending);
                });
    }

    private boolean isPendingConstraintViolation(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null
                    && (message.contains("idx_user_analysis_tasks_resume_pending")
                    || message.contains("idx_user_analysis_tasks_job_pending"))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private SkillAnalysisData completeSkills(
            PreparedAnalysis prepared,
            String modelName,
            List<ValidatedSkill> skills) {
        SkillAnalysisData result = transactions.execute(ignored -> {
            UserAnalysisTask task = pendingTask(prepared.taskId());
            OffsetDateTime now = OffsetDateTime.now();
            List<UserGraph> graphs = new ArrayList<>(skills.size());
            int rank = 1;
            for (ValidatedSkill skill : skills) {
                UserGraph graph = new UserGraph();
                graph.setId(snowflake.nextId());
                graph.setCreatedAt(now);
                graph.setUpdatedAt(now);
                graph.setTaskId(task.getId());
                graph.setUserId(task.getUserId());
                graph.setResumeId(task.getResumeId());
                graph.setSkillName(skill.name());
                graph.setProficiency(skill.proficiency());
                graph.setEvidence(skill.evidence());
                graph.setRank(rank++);
                graphs.add(graph);
            }
            if (!graphs.isEmpty()) {
                graphRepository.saveAllAndFlush(graphs);
            }
            task.setTaskStatus(TaskStatus.SUCCESS);
            task.setModelName(modelName);
            task.setUpdatedAt(now);
            taskRepository.saveAndFlush(task);
            return new SkillAnalysisData(
                    task.getResumeId(), graphs.stream().map(this::toSkillData).toList());
        });
        if (result == null) {
            throw new IllegalStateException("user skill completion returned no result");
        }
        return result;
    }

    private JobMatchData completeMatch(
            PreparedAnalysis prepared,
            String modelName,
            ValidatedMatch match) {
        JobMatchData result = transactions.execute(ignored -> {
            UserAnalysisTask task = pendingTask(prepared.taskId());
            OffsetDateTime now = OffsetDateTime.now();
            JsonNode learningJson = objectMapper.valueToTree(match.skillsToLearn());
            JsonNode actionsJson = objectMapper.valueToTree(match.actionSuggestions());
            task.setTaskStatus(TaskStatus.SUCCESS);
            task.setModelName(modelName);
            task.setMatchScore(match.score());
            task.setMatchSummary(match.summary());
            task.setSkillsToLearn(learningJson);
            task.setActionSuggestions(actionsJson);
            task.setUpdatedAt(now);
            taskRepository.saveAndFlush(task);
            return new JobMatchData(
                    task.getResumeId(), task.getJobId(), match.score(), match.summary(),
                    match.skillsToLearn(), match.actionSuggestions(), now);
        });
        if (result == null) {
            throw new IllegalStateException("user job match completion returned no result");
        }
        return result;
    }

    private UserAnalysisTask pendingTask(long taskId) {
        UserAnalysisTask task = taskRepository.findByIdAndDeletedAtIsNull(taskId)
                .orElseThrow(() -> new IllegalStateException("user analysis task not found"));
        if (task.getTaskStatus() != TaskStatus.PENDING) {
            throw new IllegalStateException("user analysis task is not pending");
        }
        return task;
    }

    private void markFailed(long taskId, RuntimeException exception, AuditContext audit, String detail) {
        String safeError = safeError(exception);
        try {
            transactions.executeWithoutResult(ignored -> taskRepository
                    .findByIdAndDeletedAtIsNull(taskId)
                    .filter(task -> task.getTaskStatus() == TaskStatus.PENDING)
                    .ifPresent(task -> {
                        task.setTaskStatus(TaskStatus.FAILED);
                        task.setErrorMsg(safeError);
                        task.setUpdatedAt(OffsetDateTime.now());
                        taskRepository.saveAndFlush(task);
                    }));
        } catch (RuntimeException persistenceException) {
            // 失败状态写入不能覆盖原始异常，也不能把敏感输入写入日志。
            logService.error(audit, persistenceException.getClass().getSimpleName(),
                    detail + ": persist failed, task_id=" + taskId);
        }
        logService.error(audit, safeError, detail + ": task_id=" + taskId);
    }

    private ApiException aiFailure(RuntimeException exception) {
        if (exception instanceof ApiException apiException) {
            return apiException;
        }
        return new ApiException(
                ApiException.ErrorCode.SERVICE_UNAVAILABLE, "AI analysis unavailable");
    }

    private ApiException internalFailure(RuntimeException exception) {
        if (exception instanceof ApiException apiException
                && apiException.getErrorCode() == ApiException.ErrorCode.INTERNAL_ERROR) {
            return apiException;
        }
        return new ApiException(
                ApiException.ErrorCode.INTERNAL_ERROR, "persist user analysis failed");
    }

    private List<ValidatedSkill> validateSkills(
            AIGrpcClient.UserSkillAnalysisResult result,
            String resumeContent) {
        if (result == null || result.skills() == null || result.skills().size() > MAX_SKILLS) {
            throw new IllegalStateException("AI user skill result is invalid");
        }
        Set<String> names = new HashSet<>();
        List<ValidatedSkill> validated = new ArrayList<>(result.skills().size());
        String normalizedContent = normalizeWhitespace(resumeContent);
        for (AIGrpcClient.AnalyzedSkillResult item : result.skills()) {
            if (item == null) {
                throw new IllegalStateException("AI user skill item is missing");
            }
            String name = requiredText(item.name(), MAX_SKILL_NAME_LENGTH, "skill name");
            String evidence = requiredText(item.evidence(), MAX_EVIDENCE_LENGTH, "skill evidence");
            UserSkillProficiency proficiency = parseProficiency(item.proficiency());
            if (!names.add(name.toLowerCase(Locale.ROOT))) {
                throw new IllegalStateException("AI user skills contain duplicate names");
            }
            if (!normalizedContent.contains(normalizeWhitespace(evidence))) {
                throw new IllegalStateException("AI user skill evidence is not grounded");
            }
            validated.add(new ValidatedSkill(name, proficiency, evidence));
        }
        return List.copyOf(validated);
    }

    private ValidatedMatch validateMatch(AIGrpcClient.JobMatchAnalysisResult result) {
        if (result == null || result.score() < 0 || result.score() > 100) {
            throw new IllegalStateException("AI job match result is invalid");
        }
        String summary = requiredText(result.summary(), MAX_TEXT_LENGTH, "match summary");
        List<AIGrpcClient.SkillLearningSuggestionResult> rawSkills = result.skillsToLearn();
        List<String> rawActions = result.actionSuggestions();
        if (rawSkills == null || rawSkills.size() > MAX_SUGGESTIONS
                || rawActions == null || rawActions.size() > MAX_SUGGESTIONS) {
            throw new IllegalStateException("AI job match suggestions exceed limit");
        }

        Set<String> skillNames = new HashSet<>();
        List<LearningSuggestionData> skills = new ArrayList<>(rawSkills.size());
        for (AIGrpcClient.SkillLearningSuggestionResult item : rawSkills) {
            if (item == null) {
                throw new IllegalStateException("AI learning suggestion is missing");
            }
            String name = requiredText(item.skillName(), MAX_SKILL_NAME_LENGTH, "suggested skill");
            if (!skillNames.add(name.toLowerCase(Locale.ROOT))) {
                throw new IllegalStateException("AI learning suggestions contain duplicates");
            }
            skills.add(new LearningSuggestionData(
                    name,
                    requiredText(item.reason(), MAX_TEXT_LENGTH, "suggestion reason"),
                    requiredText(item.suggestion(), MAX_TEXT_LENGTH, "learning suggestion")));
        }

        Set<String> uniqueActions = new HashSet<>();
        List<String> actions = new ArrayList<>(rawActions.size());
        for (String item : rawActions) {
            String action = requiredText(item, MAX_TEXT_LENGTH, "action suggestion");
            if (!uniqueActions.add(action.toLowerCase(Locale.ROOT))) {
                throw new IllegalStateException("AI action suggestions contain duplicates");
            }
            actions.add(action);
        }
        return new ValidatedMatch(
                result.score(), summary, List.copyOf(skills), List.copyOf(actions));
    }

    private UserSkillProficiency parseProficiency(String value) {
        try {
            return UserSkillProficiency.valueOf(
                    value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("AI skill proficiency is invalid");
        }
    }

    private String requiredText(String value, int maxLength, String field) {
        String normalized = value == null ? "" : value.trim();
        int codePoints = normalized.codePointCount(0, normalized.length());
        if (normalized.isEmpty() || codePoints > maxLength) {
            throw new IllegalStateException("AI " + field + " is invalid");
        }
        return normalized;
    }

    private String normalizeWhitespace(String value) {
        String normalized = value == null
                ? ""
                : Normalizer.normalize(value, Normalizer.Form.NFKC);
        return normalized.replaceAll("\\s+", " ").trim();
    }

    private String safeError(RuntimeException exception) {
        if (exception instanceof ApiException apiException) {
            return apiException.getErrorCode().name();
        }
        return exception.getClass().getSimpleName();
    }

    private AIGrpcClient.JobMatchInput toJobInput(Job job) {
        return new AIGrpcClient.JobMatchInput(
                job.getName(),
                job.getPublishDate() == null ? "" : job.getPublishDate().toString(),
                job.getSourcePlatform(),
                job.getSourceUrl(),
                job.getTags(),
                job.getMajor(),
                job.getNature(),
                job.getSalary(),
                job.getCompanyName(),
                job.getCompanySize(),
                job.getCity(),
                job.getProvince(),
                job.getEducation(),
                job.getExperience(),
                job.getJobDescription(),
                job.getOccupationId());
    }

    private UserSkillData toSkillData(UserGraph graph) {
        return new UserSkillData(
                graph.getId(), graph.getResumeId(), graph.getSkillName(),
                graph.getProficiency().name(), graph.getEvidence(), graph.getCreatedAt());
    }

    private record PreparedAnalysis(
            long taskId,
            long resumeId,
            String resumeContent,
            Long jobId,
            AIGrpcClient.JobMatchInput jobInput) {
    }

    private record ValidatedSkill(
            String name,
            UserSkillProficiency proficiency,
            String evidence) {
    }

    private record ValidatedMatch(
            int score,
            String summary,
            List<LearningSuggestionData> skillsToLearn,
            List<String> actionSuggestions) {
    }

    public record UserSkillData(
            long id,
            long resumeId,
            String skillName,
            String proficiency,
            String evidence,
            OffsetDateTime createdAt) {
    }

    public record SkillAnalysisData(long resumeId, List<UserSkillData> skills) {
    }

    public record LearningSuggestionData(String skillName, String reason, String suggestion) {
    }

    public record JobMatchData(
            long resumeId,
            long jobId,
            int score,
            String summary,
            List<LearningSuggestionData> skillsToLearn,
            List<String> actionSuggestions,
            OffsetDateTime createdAt) {
    }
}
