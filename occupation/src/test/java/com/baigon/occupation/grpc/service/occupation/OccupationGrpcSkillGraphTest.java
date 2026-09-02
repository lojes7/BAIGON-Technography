// 百工谱 — 职业/专业技能时间图谱 gRPC 契约映射测试
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.occupation.GetSkillGraphRequest;
import com.baigon.occupation.GetSkillGraphResponse;
import com.baigon.occupation.ListSkillGraphEvidenceJobsRequest;
import com.baigon.occupation.ListSkillGraphEvidenceJobsResponse;
import com.baigon.occupation.LookupSkillGraphMetricsRequest;
import com.baigon.occupation.LookupSkillGraphMetricsResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OccupationGrpcSkillGraphTest {

    private SkillGraphQueryService graphService;
    private OccupationGrpcService service;

    @BeforeEach
    void setUp() {
        graphService = mock(SkillGraphQueryService.class);
        service = new OccupationGrpcService(
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
    }

    @Test
    void graphShouldExposeOnlyScopeAndDirectSkillIds() {
        when(graphService.getGraph("OCCUPATION", 100L, "2026-05", "2026-06"))
                .thenReturn(new SkillGraphQueryService.SkillGraph(
                        100L, List.of(200L, 300L)));
        @SuppressWarnings("unchecked")
        StreamObserver<GetSkillGraphResponse> observer = mock(StreamObserver.class);

        service.getSkillGraph(GetSkillGraphRequest.newBuilder()
                .setScopeType("OCCUPATION")
                .setScopeId(100L)
                .setFromMonth("2026-05")
                .setToMonth("2026-06")
                .build(), observer);

        ArgumentCaptor<GetSkillGraphResponse> response =
                ArgumentCaptor.forClass(GetSkillGraphResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals(100L, response.getValue().getScopeId());
        assertEquals(List.of(200L, 300L), response.getValue().getDirectSkillIdsList());
    }

    @Test
    void metricLookupShouldExposeOnlyRelationMetrics() {
        when(graphService.lookupMetrics(
                "MAJOR", 100L, List.of(200L), "2026-05", "2026-06"))
                .thenReturn(new SkillGraphQueryService.MetricLookup(
                        List.of(new SkillGraphQueryService.SkillMetric(200L, 3L, 0.75)),
                        List.of(999L)));
        @SuppressWarnings("unchecked")
        StreamObserver<LookupSkillGraphMetricsResponse> observer = mock(StreamObserver.class);

        service.lookupSkillGraphMetrics(LookupSkillGraphMetricsRequest.newBuilder()
                .setScopeType("MAJOR")
                .setScopeId(100L)
                .addSkillIds(200L)
                .setFromMonth("2026-05")
                .setToMonth("2026-06")
                .build(), observer);

        ArgumentCaptor<LookupSkillGraphMetricsResponse> response =
                ArgumentCaptor.forClass(LookupSkillGraphMetricsResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(200L, response.getValue().getItems(0).getSkillId());
        assertEquals(3L, response.getValue().getItems(0).getJobCount());
        assertEquals(0.75, response.getValue().getItems(0).getCoverage());
        assertEquals(List.of(999L), response.getValue().getMissingIdsList());
    }

    @Test
    void evidenceShouldExposeOnlyPagedJobIds() {
        when(graphService.listEvidenceJobs(
                "OCCUPATION", 100L, 200L, "", "", 1, 20))
                .thenReturn(new SkillGraphQueryService.EvidencePage(
                        List.of(501L, 500L), 22L, 1, 20));
        @SuppressWarnings("unchecked")
        StreamObserver<ListSkillGraphEvidenceJobsResponse> observer = mock(StreamObserver.class);

        service.listSkillGraphEvidenceJobs(ListSkillGraphEvidenceJobsRequest.newBuilder()
                .setScopeType("OCCUPATION")
                .setScopeId(100L)
                .setSkillId(200L)
                .setPage(1)
                .setPageSize(20)
                .build(), observer);

        ArgumentCaptor<ListSkillGraphEvidenceJobsResponse> response =
                ArgumentCaptor.forClass(ListSkillGraphEvidenceJobsResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(List.of(501L, 500L), response.getValue().getJobIdsList());
        assertEquals(22L, response.getValue().getTotal());
        assertEquals(1, response.getValue().getPage());
        assertEquals(20, response.getValue().getPageSize());
    }
}
