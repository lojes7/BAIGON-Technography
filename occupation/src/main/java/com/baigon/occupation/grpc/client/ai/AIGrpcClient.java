// 百工谱 — ai-service 文本向量化与 JD 分析 gRPC 客户端
package com.baigon.occupation.grpc.client.ai;

import com.baigon.ai.AIServiceGrpc;
import com.baigon.ai.AnalyzeJobDescriptionRequest;
import com.baigon.ai.AnalyzeJobDescriptionResponse;
import com.baigon.ai.AnalyzeResumeRequest;
import com.baigon.ai.AnalyzeResumeResponse;
import com.baigon.ai.AnalyzeJobMatchRequest;
import com.baigon.ai.AnalyzeJobMatchResponse;
import com.baigon.ai.AnalyzeUserSkillsRequest;
import com.baigon.ai.AnalyzeUserSkillsResponse;
import com.baigon.ai.AnalyzedSkill;
import com.baigon.ai.BatchEmbedTextRequest;
import com.baigon.ai.BatchEmbedTextResponse;
import com.baigon.ai.EmbeddingVector;
import com.baigon.ai.JobMatchProfile;
import com.baigon.ai.ResumeMatchProfile;
import com.baigon.ai.SkillLearningSuggestion;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.error.ApiException;
import com.google.common.util.concurrent.ListenableFuture;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

/** 通过 Consul 发现 ai-service；单次业务步骤不自动重试。 */
@Component
public class AIGrpcClient {

    private final DiscoveryClient discoveryClient;
    private final String serviceName;
    private final int dimensions;
    private final int configuredBatchSize;
    private final long embeddingTimeoutSeconds;
    private final long jobDescriptionTimeoutSeconds;
    private final long resumeTimeoutSeconds;
    private final long userAnalysisTimeoutSeconds;

    private final Object channelLock = new Object();
    private ManagedChannel channel;
    private String channelTarget = "";

    public AIGrpcClient(DiscoveryClient discoveryClient,
                        @Value("${ai.service-name:ai-service}") String serviceName,
                        @Value("${ai.dimensions:1024}") int dimensions,
                        @Value("${ai.batch-size:20}") int configuredBatchSize,
                        @Value("${ai.timeout-seconds:150}") long embeddingTimeoutSeconds,
                        @Value("${ai.job-description-timeout-seconds:180}")
                        long jobDescriptionTimeoutSeconds,
                        @Value("${ai.resume-timeout-seconds:120}") long resumeTimeoutSeconds,
                        @Value("${ai.user-analysis-timeout-seconds:120}") long userAnalysisTimeoutSeconds) {
        if (dimensions != 1024) {
            throw new IllegalArgumentException("ai.dimensions must match vector(1024)");
        }
        if (configuredBatchSize < 1 || configuredBatchSize > 100) {
            throw new IllegalArgumentException("ai.batch-size must be between 1 and 100");
        }
        if (embeddingTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.timeout-seconds must be > 0");
        }
        if (jobDescriptionTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.job-description-timeout-seconds must be > 0");
        }
        if (resumeTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.resume-timeout-seconds must be > 0");
        }
        if (userAnalysisTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.user-analysis-timeout-seconds must be > 0");
        }
        this.discoveryClient = discoveryClient;
        this.serviceName = serviceName;
        this.dimensions = dimensions;
        this.configuredBatchSize = configuredBatchSize;
        this.embeddingTimeoutSeconds = embeddingTimeoutSeconds;
        this.jobDescriptionTimeoutSeconds = jobDescriptionTimeoutSeconds;
        this.resumeTimeoutSeconds = resumeTimeoutSeconds;
        this.userAnalysisTimeoutSeconds = userAnalysisTimeoutSeconds;
    }

    public int getConfiguredBatchSize() {
        return configuredBatchSize;
    }

    /** 创建可取消的异步调用，Stop 接口可立即向当前 gRPC 请求发送取消信号。 */
    public EmbeddingCall startBatch(List<String> texts, AuditContext audit) {
        if (texts == null || texts.isEmpty()) {
            throw new IllegalArgumentException("embedding texts must not be empty");
        }
        String target = discoverTarget();
        ManagedChannel activeChannel = channelFor(target);
        BatchEmbedTextRequest request = BatchEmbedTextRequest.newBuilder()
                .addAllTexts(texts)
                .setDimensions(dimensions)
                .setChunkSize(Math.min(texts.size(), configuredBatchSize))
                .setTraceId(audit.traceId() == null ? "" : String.valueOf(audit.traceId()))
                .setUserId(audit.userId())
                .setUserName(audit.userName())
                .setUserIp(audit.userIp())
                .setRequestMethod(audit.requestMethod())
                .setRequestUrl(audit.requestUrl())
                .build();

        ListenableFuture<BatchEmbedTextResponse> future = AIServiceGrpc.newFutureStub(activeChannel)
                .withDeadlineAfter(embeddingTimeoutSeconds, TimeUnit.SECONDS)
                .batchEmbedText(request);
        return new EmbeddingCall(future, texts.size(), dimensions);
    }

    /** 异步发送真实 JD；AnalyzeJobDescription 契约只接收 jd，不混入审计字段。 */
    public JobDescriptionAnalysisCall startJobDescriptionAnalysis(String jobDescription) {
        if (jobDescription == null || jobDescription.isBlank()) {
            throw new IllegalArgumentException("job_description is empty");
        }
        String target = discoverTarget();
        ManagedChannel activeChannel = channelFor(target);
        AnalyzeJobDescriptionRequest request = AnalyzeJobDescriptionRequest.newBuilder()
                .setJd(jobDescription)
                .build();
        ListenableFuture<AnalyzeJobDescriptionResponse> future =
                AIServiceGrpc.newFutureStub(activeChannel)
                        .withDeadlineAfter(jobDescriptionTimeoutSeconds, TimeUnit.SECONDS)
                        .analyzeJobDescription(request);
        return new JobDescriptionAnalysisCall(future);
    }

    /** 同步分析 OCR 简历正文；单次上传不自动重试模型请求。 */
    public ResumeAnalysisResult analyzeResume(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("resume content is empty");
        }
        try {
            String target = discoverTarget();
            ManagedChannel activeChannel = channelFor(target);
            AnalyzeResumeResponse response = AIServiceGrpc.newBlockingStub(activeChannel)
                    .withDeadlineAfter(resumeTimeoutSeconds, TimeUnit.SECONDS)
                    .analyzeResume(AnalyzeResumeRequest.newBuilder()
                            .setContent(content)
                            .build());
            rejectInvalidResponse(
                    response.getErrorCode(),
                    response.getSourceLlmResponse(),
                    "resume analysis response is invalid");
            if (response.getResumeJson().isBlank()) {
                throw new IllegalStateException("AI 返回空简历 JSON");
            }
            return new ResumeAnalysisResult(
                    response.getResumeJson(), response.getSourceLlmResponse());
        } catch (AIAnalysisException exception) {
            throw exception;
        } catch (StatusRuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "resume analysis unavailable");
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "resume analysis unavailable");
        }
    }

    /** 从当前简历正文提取带证据的用户技能；审计字段只用于链路日志。 */
    public UserSkillAnalysisResult analyzeUserSkills(String content, AuditContext audit) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("resume content is empty");
        }
        try {
            ManagedChannel activeChannel = channelFor(discoverTarget());
            AnalyzeUserSkillsResponse response = AIServiceGrpc.newBlockingStub(activeChannel)
                    .withDeadlineAfter(userAnalysisTimeoutSeconds, TimeUnit.SECONDS)
                    .analyzeUserSkills(AnalyzeUserSkillsRequest.newBuilder()
                            .setResumeContent(content)
                            .setTraceId(audit.traceId() == null ? "" : String.valueOf(audit.traceId()))
                            .setUserId(audit.userId())
                            .setUserName(audit.userName())
                            .setUserIp(audit.userIp())
                            .setRequestMethod(audit.requestMethod())
                            .setRequestUrl(audit.requestUrl())
                            .build());
            rejectInvalidResponse(
                    response.getErrorCode(),
                    response.getSourceLlmResponse(),
                    "user skill analysis response is invalid");
            List<AnalyzedSkillResult> skills = new ArrayList<>(response.getSkillsCount());
            for (AnalyzedSkill skill : response.getSkillsList()) {
                skills.add(new AnalyzedSkillResult(
                        skill.getName(), skill.getProficiency(), skill.getEvidence()));
            }
            return new UserSkillAnalysisResult(
                    List.copyOf(skills), response.getModel(), response.getSourceLlmResponse());
        } catch (AIAnalysisException exception) {
            throw exception;
        } catch (StatusRuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "user skill analysis unavailable");
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "user skill analysis unavailable");
        }
    }

    /** 人岗匹配只发送简历结构化字段和 jobs 业务字段，不读取简历正文或岗位分析表。 */
    public JobMatchAnalysisResult analyzeJobMatch(
            ResumeMatchInput resume,
            JobMatchInput job,
            AuditContext audit) {
        if (resume == null || job == null) {
            throw new IllegalArgumentException("job match input is incomplete");
        }
        try {
            ResumeMatchProfile resumeProfile = ResumeMatchProfile.newBuilder()
                    .setEducationExperiences(orEmpty(resume.educationExperiences()))
                    .setWorkExperiences(orEmpty(resume.workExperiences()))
                    .setProjectExperiences(orEmpty(resume.projectExperiences()))
                    .setProfessionalSkills(orEmpty(resume.professionalSkills()))
                    .setAwards(orEmpty(resume.awards()))
                    .build();
            JobMatchProfile.Builder profile = JobMatchProfile.newBuilder()
                    .setName(orEmpty(job.name()))
                    .setPublishDate(orEmpty(job.publishDate()))
                    .setSourcePlatform(orEmpty(job.sourcePlatform()))
                    .setSourceUrl(orEmpty(job.sourceUrl()))
                    .setTags(orEmpty(job.tags()))
                    .setMajor(orEmpty(job.major()))
                    .setNature(orEmpty(job.nature()))
                    .setSalary(orEmpty(job.salary()))
                    .setCompanyName(orEmpty(job.companyName()))
                    .setCompanySize(orEmpty(job.companySize()))
                    .setCity(orEmpty(job.city()))
                    .setProvince(orEmpty(job.province()))
                    .setEducation(orEmpty(job.education()))
                    .setExperience(orEmpty(job.experience()))
                    .setJobDescription(orEmpty(job.jobDescription()))
                    .setOccupationId(job.occupationId() == null ? 0L : job.occupationId());
            ManagedChannel activeChannel = channelFor(discoverTarget());
            AnalyzeJobMatchResponse response = AIServiceGrpc.newBlockingStub(activeChannel)
                    .withDeadlineAfter(userAnalysisTimeoutSeconds, TimeUnit.SECONDS)
                    .analyzeJobMatch(AnalyzeJobMatchRequest.newBuilder()
                            .setResume(resumeProfile)
                            .setJob(profile)
                            .setTraceId(audit.traceId() == null ? "" : String.valueOf(audit.traceId()))
                            .setUserId(audit.userId())
                            .setUserName(audit.userName())
                            .setUserIp(audit.userIp())
                            .setRequestMethod(audit.requestMethod())
                            .setRequestUrl(audit.requestUrl())
                            .build());
            rejectInvalidResponse(
                    response.getErrorCode(),
                    response.getSourceLlmResponse(),
                    "job match analysis response is invalid");
            List<SkillLearningSuggestionResult> learning =
                    new ArrayList<>(response.getSkillsToLearnCount());
            for (SkillLearningSuggestion item : response.getSkillsToLearnList()) {
                learning.add(new SkillLearningSuggestionResult(
                        item.getSkillName(), item.getReason(), item.getSuggestion()));
            }
            return new JobMatchAnalysisResult(
                    response.getScore(), response.getSummary(), List.copyOf(learning),
                    List.copyOf(response.getActionSuggestionsList()), response.getModel(),
                    response.getSourceLlmResponse());
        } catch (AIAnalysisException exception) {
            throw exception;
        } catch (StatusRuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "job match analysis unavailable");
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(
                    ApiException.ErrorCode.SERVICE_UNAVAILABLE,
                    "job match analysis unavailable");
        }
    }

    private String discoverTarget() {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        if (instances == null || instances.isEmpty()) {
            throw new IllegalStateException("Consul 中没有健康的 " + serviceName + " 实例");
        }
        ServiceInstance instance = instances.get(0);
        return instance.getHost() + ":" + instance.getPort();
    }

    private String orEmpty(String value) {
        return value == null ? "" : value;
    }

    /** AI 已返回内容但明确标记校验失败时，保留原始响应用于任务落库。 */
    private void rejectInvalidResponse(
            String errorCode,
            String sourceLlmResponse,
            String message) {
        if (errorCode != null && !errorCode.isBlank()) {
            throw new AIAnalysisException(message, sourceLlmResponse);
        }
    }

    private ManagedChannel channelFor(String target) {
        synchronized (channelLock) {
            if (channel != null && !channel.isShutdown() && target.equals(channelTarget)) {
                return channel;
            }
            closeChannel();
            channelTarget = target;
            channel = ManagedChannelBuilder.forTarget(target).usePlaintext().build();
            return channel;
        }
    }

    @PreDestroy
    public void shutdown() {
        synchronized (channelLock) {
            closeChannel();
        }
    }

    private void closeChannel() {
        if (channel != null) {
            channel.shutdownNow();
        }
        channel = null;
        channelTarget = "";
    }

    public static final class EmbeddingCall {
        private final ListenableFuture<BatchEmbedTextResponse> future;
        private final int expectedCount;
        private final int expectedDimensions;
        private String modelName = "";

        private EmbeddingCall(ListenableFuture<BatchEmbedTextResponse> future,
                              int expectedCount,
                              int expectedDimensions) {
            this.future = future;
            this.expectedCount = expectedCount;
            this.expectedDimensions = expectedDimensions;
        }

        public List<List<Float>> await() throws Exception {
            try {
                BatchEmbedTextResponse response = future.get();
                if (response.getDimensions() != expectedDimensions) {
                    throw new IllegalStateException("AI 返回向量维度不匹配");
                }
                if (response.getEmbeddingsCount() != expectedCount) {
                    throw new IllegalStateException("AI 返回向量数量不匹配");
                }
                modelName = response.getModel();
                List<List<Float>> vectors = new ArrayList<>(expectedCount);
                for (EmbeddingVector embedding : response.getEmbeddingsList()) {
                    List<Float> values = List.copyOf(embedding.getValuesList());
                    validateVector(values, expectedDimensions);
                    vectors.add(values);
                }
                return vectors;
            } catch (CancellationException exception) {
                throw exception;
            } catch (ExecutionException exception) {
                Throwable cause = exception.getCause();
                if (cause instanceof Exception checked) {
                    throw checked;
                }
                throw new IllegalStateException("AI gRPC 调用失败", cause);
            }
        }

        public void cancel() {
            future.cancel(true);
        }

        /** await 成功后返回本次 AI 响应中的真实模型名称。 */
        public String modelName() {
            return modelName;
        }

        private static void validateVector(List<Float> vector, int dimensions) {
            if (vector.size() != dimensions) {
                throw new IllegalStateException("AI 返回单条向量维度不匹配");
            }
            for (Float value : vector) {
                if (value == null || !Float.isFinite(value)) {
                    throw new IllegalStateException("AI 返回向量包含非法浮点值");
                }
            }
        }
    }

    /** JD 分析异步调用句柄，保留强类型技能对象，不接收 JSON 字符串。 */
    public static final class JobDescriptionAnalysisCall {
        private final ListenableFuture<AnalyzeJobDescriptionResponse> future;

        private JobDescriptionAnalysisCall(ListenableFuture<AnalyzeJobDescriptionResponse> future) {
            this.future = future;
        }

        public JobDescriptionAnalysisResult await() throws Exception {
            try {
                AnalyzeJobDescriptionResponse response = future.get();
                if (!response.getErrorCode().isBlank()) {
                    throw new AIAnalysisException(
                            "job description analysis response is invalid",
                            response.getSourceLlmResponse());
                }
                List<AnalyzedSkillResult> results = new ArrayList<>(response.getSkillsCount());
                for (AnalyzedSkill skill : response.getSkillsList()) {
                    results.add(new AnalyzedSkillResult(
                            skill.getName(), skill.getProficiency(), skill.getEvidence()));
                }
                return new JobDescriptionAnalysisResult(
                        List.copyOf(results), response.getSourceLlmResponse());
            } catch (CancellationException exception) {
                throw exception;
            } catch (ExecutionException exception) {
                Throwable cause = exception.getCause();
                if (cause instanceof Exception checked) {
                    throw checked;
                }
                throw new IllegalStateException("AI JD 分析 gRPC 调用失败", cause);
            }
        }
    }

    public record AnalyzedSkillResult(String name, String proficiency, String evidence) {
    }

    public record JobDescriptionAnalysisResult(
            List<AnalyzedSkillResult> skills,
            String sourceLlmResponse) {
    }

    public record ResumeAnalysisResult(
            String resumeJson,
            String sourceLlmResponse) {
    }

    public record UserSkillAnalysisResult(
            List<AnalyzedSkillResult> skills,
            String modelName,
            String sourceLlmResponse) {
    }

    /** 与 resumes 表五个 JSONB 列一一对应，不包含可能为空的 content。 */
    public record ResumeMatchInput(
            String educationExperiences,
            String workExperiences,
            String projectExperiences,
            String professionalSkills,
            String awards) {
    }

    /** 与 jobs 表业务列一一对应，不包含岗位分析表或内部审计字段。 */
    public record JobMatchInput(
            String name,
            String publishDate,
            String sourcePlatform,
            String sourceUrl,
            String tags,
            String major,
            String nature,
            String salary,
            String companyName,
            String companySize,
            String city,
            String province,
            String education,
            String experience,
            String jobDescription,
            Long occupationId) {
    }

    public record SkillLearningSuggestionResult(
            String skillName,
            String reason,
            String suggestion) {
    }

    public record JobMatchAnalysisResult(
            int score,
            String summary,
            List<SkillLearningSuggestionResult> skillsToLearn,
            List<String> actionSuggestions,
            String modelName,
            String sourceLlmResponse) {
    }
}
