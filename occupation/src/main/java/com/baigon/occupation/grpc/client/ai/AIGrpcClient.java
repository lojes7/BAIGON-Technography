// 百工谱 — ai-service 文本向量化与 JD 分析 gRPC 客户端
package com.baigon.occupation.grpc.client.ai;

import com.baigon.ai.AIServiceGrpc;
import com.baigon.ai.AnalyzeJobDescriptionRequest;
import com.baigon.ai.AnalyzeJobDescriptionResponse;
import com.baigon.ai.AnalyzeResumeRequest;
import com.baigon.ai.AnalyzeResumeResponse;
import com.baigon.ai.AnalyzedSkill;
import com.baigon.ai.BatchEmbedTextRequest;
import com.baigon.ai.BatchEmbedTextResponse;
import com.baigon.ai.EmbeddingVector;
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
    private final long timeoutSeconds;
    private final long resumeTimeoutSeconds;

    private final Object channelLock = new Object();
    private ManagedChannel channel;
    private String channelTarget = "";

    public AIGrpcClient(DiscoveryClient discoveryClient,
                        @Value("${ai.service-name:ai-service}") String serviceName,
                        @Value("${ai.dimensions:1024}") int dimensions,
                        @Value("${ai.batch-size:20}") int configuredBatchSize,
                        @Value("${ai.timeout-seconds:30}") long timeoutSeconds,
                        @Value("${ai.resume-timeout-seconds:120}") long resumeTimeoutSeconds) {
        if (dimensions != 1024) {
            throw new IllegalArgumentException("ai.dimensions must match vector(1024)");
        }
        if (configuredBatchSize < 1 || configuredBatchSize > 100) {
            throw new IllegalArgumentException("ai.batch-size must be between 1 and 100");
        }
        if (timeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.timeout-seconds must be > 0");
        }
        if (resumeTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("ai.resume-timeout-seconds must be > 0");
        }
        this.discoveryClient = discoveryClient;
        this.serviceName = serviceName;
        this.dimensions = dimensions;
        this.configuredBatchSize = configuredBatchSize;
        this.timeoutSeconds = timeoutSeconds;
        this.resumeTimeoutSeconds = resumeTimeoutSeconds;
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
                .withDeadlineAfter(timeoutSeconds, TimeUnit.SECONDS)
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
                        .withDeadlineAfter(timeoutSeconds, TimeUnit.SECONDS)
                        .analyzeJobDescription(request);
        return new JobDescriptionAnalysisCall(future);
    }

    /** 同步分析 OCR 简历正文；单次上传不自动重试模型请求。 */
    public String analyzeResume(String content) {
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
            if (response.getResumeJson().isBlank()) {
                throw new IllegalStateException("AI 返回空简历 JSON");
            }
            return response.getResumeJson();
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

    private String discoverTarget() {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        if (instances == null || instances.isEmpty()) {
            throw new IllegalStateException("Consul 中没有健康的 " + serviceName + " 实例");
        }
        ServiceInstance instance = instances.get(0);
        return instance.getHost() + ":" + instance.getPort();
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

        public List<AnalyzedSkillResult> await() throws Exception {
            try {
                AnalyzeJobDescriptionResponse response = future.get();
                List<AnalyzedSkillResult> results = new ArrayList<>(response.getSkillsCount());
                for (AnalyzedSkill skill : response.getSkillsList()) {
                    results.add(new AnalyzedSkillResult(
                            skill.getName(), skill.getProficiency(), skill.getEvidence()));
                }
                return List.copyOf(results);
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
}
