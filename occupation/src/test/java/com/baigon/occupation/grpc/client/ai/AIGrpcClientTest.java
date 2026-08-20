// 百工谱 — AI gRPC 客户端用户分析契约测试
package com.baigon.occupation.grpc.client.ai;

import com.baigon.ai.AIServiceGrpc;
import com.baigon.ai.AnalyzeJobMatchRequest;
import com.baigon.ai.AnalyzeJobMatchResponse;
import com.baigon.ai.AnalyzeUserSkillsRequest;
import com.baigon.ai.AnalyzeUserSkillsResponse;
import com.baigon.ai.AnalyzedSkill;
import com.baigon.ai.SkillLearningSuggestion;
import com.baigon.occupation.service.AuditContext;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AIGrpcClientTest {

    private CapturingAIService backend;
    private Server server;
    private AIGrpcClient client;

    @BeforeEach
    void setUp() throws Exception {
        backend = new CapturingAIService();
        server = ServerBuilder.forPort(0).addService(backend).build().start();
        ServiceInstance instance = mock(ServiceInstance.class);
        when(instance.getHost()).thenReturn("127.0.0.1");
        when(instance.getPort()).thenReturn(server.getPort());
        DiscoveryClient discovery = mock(DiscoveryClient.class);
        when(discovery.getInstances("ai-service")).thenReturn(List.of(instance));
        client = new AIGrpcClient(
                discovery, "ai-service", 1024, 20, 30, 120, 120);
    }

    @AfterEach
    void tearDown() {
        client.shutdown();
        server.shutdownNow();
    }

    @Test
    void analyzeUserSkillsShouldForwardAuditAndMapTypedResult() {
        AIGrpcClient.UserSkillAnalysisResult result = client.analyzeUserSkills(
                "熟练使用 Java",
                audit("/api/auth/resumes/analyze-skills"));

        assertEquals("spark-test", result.modelName());
        assertEquals("Java", result.skills().get(0).name());
        assertEquals("ADVANCED", result.skills().get(0).proficiency());
        AnalyzeUserSkillsRequest request = backend.skillRequest;
        assertEquals("熟练使用 Java", request.getResumeContent());
        assertAudit(request.getTraceId(), request.getUserId(), request.getUserName(),
                request.getUserIp(), request.getRequestMethod(), request.getRequestUrl(),
                "/api/auth/resumes/analyze-skills");
    }

    @Test
    void analyzeJobMatchShouldForwardOnlyJobsSnapshotAndMapSuggestions() {
        AIGrpcClient.JobMatchInput input = new AIGrpcClient.JobMatchInput(
                "Java 后端工程师",
                "2026-08-20T10:00:00+08:00",
                "智联招聘",
                "https://example.com/jobs/201",
                "Java,云原生",
                "计算机科学",
                "全职",
                "15K-25K",
                "百工科技",
                "100-499人",
                "杭州",
                "浙江",
                "本科",
                "3年",
                "负责 Java 后端和 Kubernetes 部署",
                301L);

        AIGrpcClient.JobMatchAnalysisResult result = client.analyzeJobMatch(
                "三年 Java 后端开发经验", input, audit("/api/jobs/201/match"));

        assertEquals(82, result.score());
        assertEquals("Kubernetes", result.skillsToLearn().get(0).skillName());
        assertEquals("补充量化项目成果", result.actionSuggestions().get(0));
        AnalyzeJobMatchRequest request = backend.matchRequest;
        assertEquals("三年 Java 后端开发经验", request.getResumeContent());
        assertEquals(input.name(), request.getJob().getName());
        assertEquals(input.publishDate(), request.getJob().getPublishDate());
        assertEquals(input.sourcePlatform(), request.getJob().getSourcePlatform());
        assertEquals(input.sourceUrl(), request.getJob().getSourceUrl());
        assertEquals(input.tags(), request.getJob().getTags());
        assertEquals(input.major(), request.getJob().getMajor());
        assertEquals(input.nature(), request.getJob().getNature());
        assertEquals(input.salary(), request.getJob().getSalary());
        assertEquals(input.companyName(), request.getJob().getCompanyName());
        assertEquals(input.companySize(), request.getJob().getCompanySize());
        assertEquals(input.city(), request.getJob().getCity());
        assertEquals(input.province(), request.getJob().getProvince());
        assertEquals(input.education(), request.getJob().getEducation());
        assertEquals(input.experience(), request.getJob().getExperience());
        assertEquals(input.jobDescription(), request.getJob().getJobDescription());
        assertEquals(input.occupationId().longValue(), request.getJob().getOccupationId());
        assertAudit(request.getTraceId(), request.getUserId(), request.getUserName(),
                request.getUserIp(), request.getRequestMethod(), request.getRequestUrl(),
                "/api/jobs/201/match");
    }

    private AuditContext audit(String requestUrl) {
        return new AuditContext(1001L, 7L, "student01", "127.0.0.1", "POST", requestUrl);
    }

    private void assertAudit(
            String traceId,
            long userId,
            String userName,
            String userIp,
            String requestMethod,
            String requestUrl,
            String expectedRequestUrl) {
        assertEquals("1001", traceId);
        assertEquals(7L, userId);
        assertEquals("student01", userName);
        assertEquals("127.0.0.1", userIp);
        assertEquals("POST", requestMethod);
        assertEquals(expectedRequestUrl, requestUrl);
    }

    private static class CapturingAIService extends AIServiceGrpc.AIServiceImplBase {
        private AnalyzeUserSkillsRequest skillRequest;
        private AnalyzeJobMatchRequest matchRequest;

        @Override
        public void analyzeUserSkills(
                AnalyzeUserSkillsRequest request,
                StreamObserver<AnalyzeUserSkillsResponse> observer) {
            skillRequest = request;
            observer.onNext(AnalyzeUserSkillsResponse.newBuilder()
                    .addSkills(AnalyzedSkill.newBuilder()
                            .setName("Java")
                            .setProficiency("ADVANCED")
                            .setEvidence("熟练使用 Java")
                            .build())
                    .setModel("spark-test")
                    .build());
            observer.onCompleted();
        }

        @Override
        public void analyzeJobMatch(
                AnalyzeJobMatchRequest request,
                StreamObserver<AnalyzeJobMatchResponse> observer) {
            matchRequest = request;
            observer.onNext(AnalyzeJobMatchResponse.newBuilder()
                    .setScore(82)
                    .setSummary("核心能力匹配")
                    .addSkillsToLearn(SkillLearningSuggestion.newBuilder()
                            .setSkillName("Kubernetes")
                            .setReason("岗位要求容器编排")
                            .setSuggestion("完成部署实践")
                            .build())
                    .addActionSuggestions("补充量化项目成果")
                    .setModel("spark-test")
                    .build());
            observer.onCompleted();
        }
    }
}
