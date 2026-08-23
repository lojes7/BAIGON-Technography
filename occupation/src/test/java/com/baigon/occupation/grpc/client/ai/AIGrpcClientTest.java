// 百工谱 — AI gRPC 客户端用户分析契约测试
package com.baigon.occupation.grpc.client.ai;

import com.baigon.ai.AIServiceGrpc;
import com.baigon.ai.AnalyzeJobDescriptionRequest;
import com.baigon.ai.AnalyzeJobDescriptionResponse;
import com.baigon.ai.AnalyzeJobMatchRequest;
import com.baigon.ai.AnalyzeJobMatchResponse;
import com.baigon.ai.AnalyzeResumeRequest;
import com.baigon.ai.AnalyzeResumeResponse;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
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
        assertEquals("raw-user-skills", result.sourceLlmResponse());
        AnalyzeUserSkillsRequest request = backend.skillRequest;
        assertEquals("熟练使用 Java", request.getResumeContent());
        assertAudit(request.getTraceId(), request.getUserId(), request.getUserName(),
                request.getUserIp(), request.getRequestMethod(), request.getRequestUrl(),
                "/api/auth/resumes/analyze-skills");
    }

    @Test
    void analyzeResumeShouldReturnBusinessJsonAndRawResponse() {
        AIGrpcClient.ResumeAnalysisResult result = client.analyzeResume("OCR 简历正文");

        assertEquals("{\"education_experience\":[]}", result.resumeJson());
        assertEquals("raw-resume", result.sourceLlmResponse());
        assertEquals("OCR 简历正文", backend.resumeRequest.getContent());
    }

    @Test
    void analyzeJobDescriptionShouldReturnSkillsAndRawResponse() throws Exception {
        AIGrpcClient.JobDescriptionAnalysisResult result =
                client.startJobDescriptionAnalysis("熟练使用 Java").await();

        assertEquals("Java", result.skills().get(0).name());
        assertEquals("raw-job-description", result.sourceLlmResponse());
        assertEquals("熟练使用 Java", backend.jobDescriptionRequest.getJd());
    }

    @Test
    void analyzeJobMatchShouldForwardStructuredResumeAndOnlyJobsSnapshot() {
        AIGrpcClient.ResumeMatchInput resume = new AIGrpcClient.ResumeMatchInput(
                "[]",
                "[]",
                "[]",
                "[{\"skill_name\":\"Java\",\"proficiency\":\"Advanced\"}]",
                "[]");
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
                resume, input, audit("/api/jobs/201/match"));

        assertEquals(82, result.score());
        assertEquals("Kubernetes", result.skillsToLearn().get(0).skillName());
        assertEquals("补充量化项目成果", result.actionSuggestions().get(0));
        assertEquals("raw-job-match", result.sourceLlmResponse());
        AnalyzeJobMatchRequest request = backend.matchRequest;
        assertEquals(resume.educationExperiences(),
                request.getResume().getEducationExperiences());
        assertEquals(resume.workExperiences(), request.getResume().getWorkExperiences());
        assertEquals(resume.projectExperiences(),
                request.getResume().getProjectExperiences());
        assertEquals(resume.professionalSkills(),
                request.getResume().getProfessionalSkills());
        assertEquals(resume.awards(), request.getResume().getAwards());
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

    @Test
    void invalidChatResponsesShouldPreserveRawContentInDomainException() {
        backend.invalidResponses = true;

        AIAnalysisException resume = assertThrows(
                AIAnalysisException.class,
                () -> client.analyzeResume("OCR 简历正文"));
        AIAnalysisException skills = assertThrows(
                AIAnalysisException.class,
                () -> client.analyzeUserSkills(
                        "熟练使用 Java", audit("/api/auth/resumes/analyze-skills")));
        AIAnalysisException match = assertThrows(
                AIAnalysisException.class,
                () -> client.analyzeJobMatch(
                        minimalResumeInput(), minimalJobInput(), audit("/api/jobs/201/match")));
        AIAnalysisException jobDescription = assertThrows(
                AIAnalysisException.class,
                () -> client.startJobDescriptionAnalysis("熟练使用 Java").await());

        assertEquals("raw-invalid-resume", resume.getSourceLlmResponse());
        assertEquals("raw-invalid-user-skills", skills.getSourceLlmResponse());
        assertEquals("raw-invalid-job-match", match.getSourceLlmResponse());
        assertEquals("raw-invalid-job-description", jobDescription.getSourceLlmResponse());
    }

    private AIGrpcClient.ResumeMatchInput minimalResumeInput() {
        return new AIGrpcClient.ResumeMatchInput(
                "[]", "[]", "[]",
                "[{\"skill_name\":\"Java\",\"proficiency\":\"Advanced\"}]",
                "[]");
    }

    private AIGrpcClient.JobMatchInput minimalJobInput() {
        return new AIGrpcClient.JobMatchInput(
                "Java 后端工程师", "", "", "", "", "", "", "", "", "",
                "", "", "", "", "熟练使用 Java", null);
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
        private AnalyzeJobDescriptionRequest jobDescriptionRequest;
        private AnalyzeResumeRequest resumeRequest;
        private AnalyzeUserSkillsRequest skillRequest;
        private AnalyzeJobMatchRequest matchRequest;
        private boolean invalidResponses;

        @Override
        public void analyzeJobDescription(
                AnalyzeJobDescriptionRequest request,
                StreamObserver<AnalyzeJobDescriptionResponse> observer) {
            jobDescriptionRequest = request;
            AnalyzeJobDescriptionResponse.Builder response =
                    AnalyzeJobDescriptionResponse.newBuilder();
            if (invalidResponses) {
                response.setSourceLlmResponse("raw-invalid-job-description")
                        .setErrorCode("LLM_RESPONSE_INVALID");
            } else {
                response.addSkills(AnalyzedSkill.newBuilder()
                                .setName("Java")
                                .setProficiency("ADVANCED")
                                .setEvidence("熟练使用 Java"))
                        .setSourceLlmResponse("raw-job-description");
            }
            observer.onNext(response.build());
            observer.onCompleted();
        }

        @Override
        public void analyzeResume(
                AnalyzeResumeRequest request,
                StreamObserver<AnalyzeResumeResponse> observer) {
            resumeRequest = request;
            AnalyzeResumeResponse.Builder response = AnalyzeResumeResponse.newBuilder();
            if (invalidResponses) {
                response.setSourceLlmResponse("raw-invalid-resume")
                        .setErrorCode("LLM_RESPONSE_INVALID");
            } else {
                response.setResumeJson("{\"education_experience\":[]}")
                        .setSourceLlmResponse("raw-resume");
            }
            observer.onNext(response.build());
            observer.onCompleted();
        }

        @Override
        public void analyzeUserSkills(
                AnalyzeUserSkillsRequest request,
                StreamObserver<AnalyzeUserSkillsResponse> observer) {
            skillRequest = request;
            AnalyzeUserSkillsResponse.Builder response =
                    AnalyzeUserSkillsResponse.newBuilder();
            if (invalidResponses) {
                response.setSourceLlmResponse("raw-invalid-user-skills")
                        .setErrorCode("LLM_RESPONSE_INVALID");
            } else {
                response.addSkills(AnalyzedSkill.newBuilder()
                                .setName("Java")
                                .setProficiency("ADVANCED")
                                .setEvidence("熟练使用 Java"))
                        .setModel("spark-test")
                        .setSourceLlmResponse("raw-user-skills");
            }
            observer.onNext(response.build());
            observer.onCompleted();
        }

        @Override
        public void analyzeJobMatch(
                AnalyzeJobMatchRequest request,
                StreamObserver<AnalyzeJobMatchResponse> observer) {
            matchRequest = request;
            AnalyzeJobMatchResponse.Builder response = AnalyzeJobMatchResponse.newBuilder();
            if (invalidResponses) {
                response.setSourceLlmResponse("raw-invalid-job-match")
                        .setErrorCode("LLM_RESPONSE_INVALID");
            } else {
                response.setScore(82)
                        .setSummary("核心能力匹配")
                        .addSkillsToLearn(SkillLearningSuggestion.newBuilder()
                                .setSkillName("Kubernetes")
                                .setReason("岗位要求容器编排")
                                .setSuggestion("完成部署实践"))
                        .addActionSuggestions("补充量化项目成果")
                        .setModel("spark-test")
                        .setSourceLlmResponse("raw-job-match");
            }
            observer.onNext(response.build());
            observer.onCompleted();
        }
    }
}
