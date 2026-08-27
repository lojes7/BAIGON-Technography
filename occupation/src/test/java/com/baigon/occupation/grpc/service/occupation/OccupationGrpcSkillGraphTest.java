// 百工谱 — 职业/专业技能时间图谱 gRPC 契约映射测试
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.occupation.GetSkillGraphRequest;
import com.baigon.occupation.GetSkillGraphResponse;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.JobEvidence;
import com.baigon.occupation.service.EmbeddingTaskManager;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.audit.AuditLogQueryService;
import com.baigon.occupation.service.job.JobQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisReviewService;
import com.baigon.occupation.service.major.MajorCatalogService;
import com.baigon.occupation.service.occupation.OccupationCatalogService;
import com.baigon.occupation.service.skill.SkillHierarchyService;
import com.baigon.occupation.service.skill.SkillResolutionQueryService;
import com.baigon.occupation.service.skill.SkillResolutionReviewService;
import com.baigon.occupation.service.skill.graph.SkillGraphQueryService;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OccupationGrpcSkillGraphTest {

    @Test
    void graphShouldExposeScopeTimelineCoverageParentsAndJobEvidence() {
        SkillGraphQueryService graphService = mock(SkillGraphQueryService.class);
        OccupationGrpcService service = new OccupationGrpcService(
                mock(MajorCatalogService.class),
                mock(OccupationCatalogService.class),
                mock(EmbeddingTaskManager.class),
                mock(JobAnalysisQueryService.class),
                mock(JobAnalysisReviewService.class),
                mock(SkillResolutionQueryService.class),
                mock(SkillResolutionReviewService.class),
                mock(SkillHierarchyService.class),
                graphService,
                mock(JobQueryService.class),
                mock(AuditLogQueryService.class),
                mock(LogService.class));
        OffsetDateTime from = OffsetDateTime.parse("2026-05-01T00:00:00+08:00");
        OffsetDateTime to = OffsetDateTime.parse("2026-06-01T00:00:00+08:00");
        when(graphService.getGraph("OCCUPATION", 100L, "2026-05", "2026-06", 10))
                .thenReturn(new SkillGraphQueryService.SkillGraph(
                        new SkillGraphQueryService.ScopeDescriptor(
                                "OCCUPATION", 100L, "2-02-10-09", "软件工程技术人员"),
                        new SkillGraphQueryService.Timeline(
                                "2026-05", "2026-06", from, to, "Asia/Shanghai"),
                        4L,
                        List.of(new SkillGraphQueryService.SkillNode(
                                200L, "Spring Boot", 3L, 0.75,
                                List.of(new SkillGraphQueryService.ParentSkill(201L, "Java")),
                                List.of(new JobEvidence(
                                        200L, 300L, "Java 开发工程师", "示例企业",
                                        "智联招聘", "https://example.test/job/300", from))))));
        @SuppressWarnings("unchecked")
        StreamObserver<GetSkillGraphResponse> observer = mock(StreamObserver.class);

        service.getSkillGraph(GetSkillGraphRequest.newBuilder()
                .setScopeType("OCCUPATION")
                .setScopeId(100L)
                .setFromMonth("2026-05")
                .setToMonth("2026-06")
                .setEvidenceLimit(10)
                .build(), observer);

        ArgumentCaptor<GetSkillGraphResponse> response =
                ArgumentCaptor.forClass(GetSkillGraphResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals("软件工程技术人员", response.getValue().getScope().getName());
        assertEquals("Asia/Shanghai", response.getValue().getTimeline().getTimezone());
        assertEquals(4L, response.getValue().getTotalJobCount());
        assertEquals(0.75, response.getValue().getSkills(0).getCoverage());
        assertEquals("Java", response.getValue().getSkills(0).getParents(0).getName());
        assertEquals("Java 开发工程师",
                response.getValue().getSkills(0).getEvidenceJobs(0).getJobName());
    }
}
