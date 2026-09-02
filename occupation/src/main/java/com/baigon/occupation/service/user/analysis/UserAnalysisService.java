// 百工谱 — 当前用户简历技能分析、能力时间线与人岗匹配编排
package com.baigon.occupation.service.user.analysis;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.user.Resume;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import com.baigon.occupation.entity.user.analysis.UserGraph;
import com.baigon.occupation.entity.user.analysis.UserJobMatchResult;
import com.baigon.occupation.entity.user.analysis.UserSkillProficiency;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.ai.AIAnalysisException;
import com.baigon.occupation.grpc.client.ai.AIGrpcClient;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.user.analysis.UserAnalysisTaskRepository;
import com.baigon.occupation.repository.user.analysis.UserGraphRepository;
import com.baigon.occupation.repository.user.analysis.UserJobMatchResultRepository;
import com.baigon.occupation.repository.user.resume.ResumeRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;

import java.text.Normalizer;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class UserAnalysisService {

    private static final int MAX_SKILLS = 100;
    private static final int MAX_SUGGESTIONS = 100;
    private static final int MAX_SKILL_NAME_LENGTH = 100;
    private static final int MAX_EVIDENCE_LENGTH = 1_000;
    private static final int MAX_TEXT_LENGTH = 2_000;
    private static final int MAX_MODEL_NAME_LENGTH = 64;
    private static final int DEFAULT_SKILL_PAGE_SIZE = 20;
    private static final int MAX_SKILL_PAGE_SIZE = 100;
    private static final int MAX_BATCH_SIZE = 200;
    private static final String STALE_TASK_ERROR = "ANALYSIS_TIMEOUT";

    private final UserAnalysisTaskRepository taskRepository;
    private final UserGraphRepository graphRepository;
    private final UserJobMatchResultRepository matchResultRepository;
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
            UserJobMatchResultRepository matchResultRepository,
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
        this.matchResultRepository = matchResultRepository;
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
        String sourceLlmResponse = null;
        try {
            result = aiGrpcClient.analyzeUserSkills(prepared.resumeContent(), audit);
            sourceLlmResponse = result.sourceLlmResponse();
            skills = validateSkills(result, prepared.resumeContent());
            modelName = requiredText(
                    result.modelName(), MAX_MODEL_NAME_LENGTH, "model name");
        } catch (RuntimeException exception) {
            markFailed(
                    prepared.taskId(), exception,
                    sourceLlmResponse(exception, sourceLlmResponse),
                    audit, "user resume skill analysis failed");
            throw aiFailure(exception);
        }
        try {
            SkillAnalysisData saved = completeSkills(
                    prepared, modelName, skills, sourceLlmResponse);
            logService.info(audit, "user resume skill analysis success: resume_id="
                    + prepared.resumeId() + ", skills=" + skills.size());
            return saved;
        } catch (RuntimeException exception) {
            markFailed(
                    prepared.taskId(), exception, sourceLlmResponse,
                    audit, "persist user skill analysis failed");
            throw internalFailure(exception);
        }
    }

    /** 服务端分页返回历史技能观察记录；createdAt 表示本次系统分析写入时间。 */
    public Page<UserSkillData> listMySkills(long userId, int page, int pageSize) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        int normalizedPageSize = normalizedSkillPageSize(pageSize);
        return graphRepository
                .findByUserIdAndDeletedAtIsNull(
                        userId,
                        PageRequest.of(page, normalizedPageSize, Sort.by(
                                Sort.Order.asc("createdAt"),
                                Sort.Order.asc("rank"),
                                Sort.Order.asc("id"))))
                .map(this::toSkillData);
    }

    /** 单条技能详情同时校验当前用户所有权。 */
    public UserSkillData getMySkill(long userId, long id) {
        if (userId <= 0 || id <= 0) {
            throw new IllegalArgumentException("user_id and id must be > 0");
        }
        return graphRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .map(this::toSkillData)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND, "user skill not found"));
    }

    /** 批量技能详情按请求顺序返回，并通过 user_id 防止越权读取。 */
    public List<UserSkillData> batchGetMySkills(long userId, Collection<Long> values) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        List<Long> ids = validatedIds(values);
        Map<Long, UserGraph> byId = new LinkedHashMap<>();
        graphRepository.findByUserIdAndIdInAndDeletedAtIsNull(userId, ids)
                .forEach(item -> byId.put(item.getId(), item));
        return ids.stream()
                .distinct()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(this::toSkillData)
                .toList();
    }

    public int normalizedSkillPageSize(int pageSize) {
        if (pageSize < 0 || pageSize > MAX_SKILL_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return pageSize == 0 ? DEFAULT_SKILL_PAGE_SIZE : pageSize;
    }

    private List<Long> validatedIds(Collection<Long> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("ids must not be empty");
        }
        if (values.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("ids must contain at most 200 values");
        }
        List<Long> ids = List.copyOf(values);
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("ids must contain positive values");
        }
        // 在仓库查询前去重，并保持首次出现顺序。
        return ids.stream().distinct().toList();
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
        String sourceLlmResponse = null;
        try {
            result = aiGrpcClient.analyzeJobMatch(
                    prepared.resumeInput(), prepared.jobInput(), audit);
            sourceLlmResponse = result.sourceLlmResponse();
            match = validateMatch(result);
            modelName = requiredText(
                    result.modelName(), MAX_MODEL_NAME_LENGTH, "model name");
        } catch (RuntimeException exception) {
            markFailed(
                    prepared.taskId(), exception,
                    sourceLlmResponse(exception, sourceLlmResponse),
                    audit, "user job match analysis failed");
            throw aiFailure(exception);
        }
        try {
            JobMatchData saved = completeMatch(
                    prepared, modelName, match, sourceLlmResponse);
            logService.info(audit, "user job match success: resume_id=" + prepared.resumeId()
                    + ", job_id=" + jobId + ", score=" + match.score());
            return saved;
        } catch (RuntimeException exception) {
            markFailed(
                    prepared.taskId(), exception, sourceLlmResponse,
                    audit, "persist user job match failed");
            throw internalFailure(exception);
        }
    }

    /** 按岗位查询当前用户最新一次人岗匹配，不暴露内部分析任务。 */
    public JobMatchData getLatestMyJobMatch(long userId, long jobId) {
        if (userId <= 0 || jobId <= 0) {
            throw new IllegalArgumentException("user_id and job_id must be > 0");
        }
        return matchResultRepository
                .findFirstByUserIdAndJobIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                        userId, jobId)
                .map(this::toJobMatchData)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND, "job match not found"));
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

                String resumeContent = null;
                AIGrpcClient.ResumeMatchInput resumeInput = null;
                Job job = null;
                AIGrpcClient.JobMatchInput jobInput = null;
                if (type == UserAnalysisType.RESUME_SKILL_ANALYSIS) {
                    if (resume.getContent() == null || resume.getContent().isBlank()) {
                        throw new ApiException(
                                ApiException.ErrorCode.BAD_REQUEST,
                                "latest resume content is empty");
                    }
                    resumeContent = resume.getContent();
                } else {
                    // 人岗匹配不读取可能为空的 content，只使用五组结构化简历字段。
                    resumeInput = toResumeMatchInput(resume);
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
                taskRepository.saveAndFlush(task);
                return new PreparedAnalysis(
                        taskId, resume.getId(), resumeContent, resumeInput,
                        job == null ? null : job.getId(), jobInput);
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
            List<ValidatedSkill> skills,
            String sourceLlmResponse) {
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
            task.setSourceLlmResponse(sourceLlmResponse);
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
            ValidatedMatch match,
            String sourceLlmResponse) {
        JobMatchData result = transactions.execute(ignored -> {
            UserAnalysisTask task = pendingTask(prepared.taskId());
            OffsetDateTime now = OffsetDateTime.now();
            JsonNode learningJson = objectMapper.valueToTree(match.skillsToLearn());
            JsonNode actionsJson = objectMapper.valueToTree(match.actionSuggestions());

            UserJobMatchResult matchResult = new UserJobMatchResult();
            matchResult.setId(snowflake.nextId());
            matchResult.setCreatedAt(now);
            matchResult.setUpdatedAt(now);
            matchResult.setTaskId(task.getId());
            matchResult.setUserId(task.getUserId());
            matchResult.setResumeId(task.getResumeId());
            matchResult.setJobId(task.getJobId());
            matchResult.setMatchScore(match.score());
            matchResult.setMatchSummary(match.summary());
            matchResult.setSkillsToLearn(learningJson);
            matchResult.setActionSuggestions(actionsJson);
            matchResultRepository.saveAndFlush(matchResult);

            task.setTaskStatus(TaskStatus.SUCCESS);
            task.setModelName(modelName);
            task.setSourceLlmResponse(sourceLlmResponse);
            task.setUpdatedAt(now);
            taskRepository.saveAndFlush(task);
            return new JobMatchData(
                    matchResult.getId(), task.getResumeId(), task.getJobId(),
                    match.score(), match.summary(),
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

    private JobMatchData toJobMatchData(UserJobMatchResult result) {
        try {
            List<LearningSuggestionData> skills = List.copyOf(objectMapper.convertValue(
                    result.getSkillsToLearn(),
                    new TypeReference<List<LearningSuggestionData>>() { }));
            List<String> actions = List.copyOf(objectMapper.convertValue(
                    result.getActionSuggestions(),
                    new TypeReference<List<String>>() { }));
            return new JobMatchData(
                    result.getId(), result.getResumeId(), result.getJobId(),
                    result.getMatchScore(), result.getMatchSummary(),
                    skills, actions, result.getCreatedAt());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalStateException("stored user job match result is invalid", exception);
        }
    }

    private void markFailed(
            long taskId,
            RuntimeException exception,
            String sourceLlmResponse,
            AuditContext audit,
            String detail) {
        String safeError = safeError(exception);
        try {
            transactions.executeWithoutResult(ignored -> taskRepository
                    .findByIdAndDeletedAtIsNull(taskId)
                    .filter(task -> task.getTaskStatus() == TaskStatus.PENDING)
                    .ifPresent(task -> {
                        task.setTaskStatus(TaskStatus.FAILED);
                        task.setErrorMsg(safeError);
                        task.setSourceLlmResponse(sourceLlmResponse);
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

    private String sourceLlmResponse(RuntimeException exception, String fallback) {
        return exception instanceof AIAnalysisException analysisException
                ? analysisException.getSourceLlmResponse()
                : fallback;
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
        String normalizedContent = normalizeEvidence(resumeContent);
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
            if (!normalizedContent.contains(normalizeEvidence(evidence))) {
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

    /** 证据匹配忽略 PDF/OCR 排版空白，但保留所有实际文本字符。 */
    private String normalizeEvidence(String value) {
        String normalized = value == null
                ? ""
                : Normalizer.normalize(value, Normalizer.Form.NFKC);
        return normalized.replaceAll("\\s+", "");
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

    private AIGrpcClient.ResumeMatchInput toResumeMatchInput(Resume resume) {
        JsonNode education = resumeArrayOrEmpty(
                resume.getEducationExperiences(), "education_experiences");
        JsonNode work = resumeArrayOrEmpty(
                resume.getWorkExperiences(), "work_experiences");
        JsonNode project = resumeArrayOrEmpty(
                resume.getProjectExperiences(), "project_experiences");
        JsonNode skills = resumeArrayOrEmpty(
                resume.getProfessionalSkills(), "professional_skills");
        JsonNode awards = resumeArrayOrEmpty(resume.getAwards(), "awards");
        if (education.isEmpty() && work.isEmpty() && project.isEmpty()
                && skills.isEmpty() && awards.isEmpty()) {
            throw new ApiException(
                    ApiException.ErrorCode.BAD_REQUEST,
                    "latest resume structured fields are empty");
        }
        return new AIGrpcClient.ResumeMatchInput(
                education.toString(), work.toString(), project.toString(),
                skills.toString(), awards.toString());
    }

    private JsonNode resumeArrayOrEmpty(JsonNode value, String field) {
        if (value == null) {
            return objectMapper.createArrayNode();
        }
        if (!value.isArray()) {
            throw new ApiException(
                    ApiException.ErrorCode.BAD_REQUEST,
                    "latest resume " + field + " is not an array");
        }
        return value;
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
            AIGrpcClient.ResumeMatchInput resumeInput,
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
            long id,
            long resumeId,
            long jobId,
            int score,
            String summary,
            List<LearningSuggestionData> skillsToLearn,
            List<String> actionSuggestions,
            OffsetDateTime createdAt) {
    }
}
