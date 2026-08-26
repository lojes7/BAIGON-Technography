// 百工谱 — 岗位分析 gRPC 契约映射测试
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.occupation.GetJobAnalysisTaskRequest;
import com.baigon.occupation.GetJobAnalysisTaskResponse;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
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
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OccupationGrpcJobAnalysisTest {

    @Test
    void detailShouldExposeSelectedOccupationAndMajorNames() {
        JobAnalysisQueryService queryService = mock(JobAnalysisQueryService.class);
        OccupationGrpcService service = new OccupationGrpcService(
                mock(MajorCatalogService.class),
                mock(OccupationCatalogService.class),
                mock(EmbeddingTaskManager.class),
                queryService,
                mock(JobAnalysisReviewService.class),
                mock(SkillResolutionQueryService.class),
                mock(SkillResolutionReviewService.class),
                mock(SkillHierarchyService.class),
                mock(JobQueryService.class),
                mock(AuditLogQueryService.class),
                mock(LogService.class));
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setJobId(10L);
        task.setTraceId(9001L);
        task.setSelectedOccupationId(44L);
        task.setSelectedMajorId(55L);
        when(queryService.detail(20L)).thenReturn(Optional.of(
                new JobAnalysisQueryService.JobAnalysisDetail(
                        new JobAnalysisQueryService.JobAnalysisTaskView(
                                task, "计算机程序设计员", "软件工程"),
                        List.of(), List.of(), List.of())));
        @SuppressWarnings("unchecked")
        StreamObserver<GetJobAnalysisTaskResponse> observer = mock(StreamObserver.class);

        service.getJobAnalysisTask(
                GetJobAnalysisTaskRequest.newBuilder().setId(20L).build(), observer);

        ArgumentCaptor<GetJobAnalysisTaskResponse> response =
                ArgumentCaptor.forClass(GetJobAnalysisTaskResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals("计算机程序设计员",
                response.getValue().getAnalysis().getTask().getSelectedOccupationName());
        assertEquals("软件工程",
                response.getValue().getAnalysis().getTask().getSelectedMajorName());
    }
}
