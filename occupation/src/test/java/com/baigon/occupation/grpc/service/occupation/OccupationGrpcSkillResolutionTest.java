// 百工谱 — 规范技能与岗位技能解析 gRPC 编排测试
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.occupation.GetJobSkillResolutionTaskResponse;
import com.baigon.occupation.ListSkillsRequest;
import com.baigon.occupation.ListSkillsResponse;
import com.baigon.occupation.ReviewJobSkillResolutionTaskRequest;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillResolutionAction;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.service.EmbeddingTaskManager;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.audit.AuditLogQueryService;
import com.baigon.occupation.service.job.JobQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisReviewService;
import com.baigon.occupation.service.major.MajorCatalogService;
import com.baigon.occupation.service.occupation.OccupationCatalogService;
import com.baigon.occupation.service.skill.SkillResolutionQueryService;
import com.baigon.occupation.service.skill.SkillResolutionReviewService;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OccupationGrpcSkillResolutionTest {

    private SkillResolutionQueryService queryService;
    private SkillResolutionReviewService reviewService;
    private OccupationGrpcService service;

    @BeforeEach
    void setUp() {
        queryService = mock(SkillResolutionQueryService.class);
        reviewService = mock(SkillResolutionReviewService.class);
        service = new OccupationGrpcService(
                mock(MajorCatalogService.class),
                mock(OccupationCatalogService.class),
                mock(EmbeddingTaskManager.class),
                mock(JobAnalysisQueryService.class),
                mock(JobAnalysisReviewService.class),
                queryService,
                reviewService,
                mock(JobQueryService.class),
                mock(AuditLogQueryService.class),
                mock(LogService.class));
    }

    @Test
    void listSkillsShouldExposeEmbeddingStateAndPagination() {
        Skill skill = new Skill();
        skill.setId(300L);
        skill.setName("检索增强生成（RAG）");
        skill.setEmbeddingStatus(TaskStatus.SUCCESS);
        when(queryService.listSkills(1, 10, "RAG"))
                .thenReturn(new PageImpl<>(
                        List.of(skill), PageRequest.of(1, 10), 21));
        @SuppressWarnings("unchecked")
        StreamObserver<ListSkillsResponse> observer = mock(StreamObserver.class);

        service.listSkills(ListSkillsRequest.newBuilder()
                .setPage(1)
                .setPageSize(10)
                .setKeyword("RAG")
                .build(), observer);

        ArgumentCaptor<ListSkillsResponse> response =
                ArgumentCaptor.forClass(ListSkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals(21, response.getValue().getTotal());
        assertEquals(300L, response.getValue().getItems(0).getId());
        assertEquals(true, response.getValue().getItems(0).getIsEmbed());
    }

    @Test
    void createNewReviewShouldPassNullSkillIdAndReturnLatestDetail() {
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(10L);
        task.setTraceId(9001L);
        task.setJobSkillId(100L);
        task.setSkillName("检索增强生成");
        task.setTaskStatus(SkillResolutionTaskStatus.FAILED);
        task.setReviewStatus(ReviewStatus.PASSED);
        task.setResolutionAction(SkillResolutionAction.CREATE_NEW);
        task.setSelectedSkillId(300L);
        JobSkill jobSkill = new JobSkill();
        jobSkill.setId(100L);
        jobSkill.setJobId(200L);
        jobSkill.setSkillId(300L);
        jobSkill.setSkillName("检索增强生成");
        jobSkill.setSkillProficiency("ADVANCED");
        jobSkill.setEvidence("负责 RAG 检索链路");
        SkillResolutionQueryService.Detail detail =
                new SkillResolutionQueryService.Detail(
                        task, jobSkill, List.<JobSkillResolutionCandidate>of());
        when(reviewService.review(eq(10L), eq(SkillResolutionAction.CREATE_NEW),
                isNull(), eq("检索增强生成（RAG）"), any()))
                .thenReturn(Optional.of(task));
        when(queryService.getDetail(10L)).thenReturn(Optional.of(detail));
        @SuppressWarnings("unchecked")
        StreamObserver<GetJobSkillResolutionTaskResponse> observer = mock(StreamObserver.class);

        service.reviewJobSkillResolutionTask(
                ReviewJobSkillResolutionTaskRequest.newBuilder()
                        .setId(10L)
                        .setResolutionAction("CREATE_NEW")
                        .setNewSkillName("检索增强生成（RAG）")
                        .build(),
                observer);

        ArgumentCaptor<GetJobSkillResolutionTaskResponse> response =
                ArgumentCaptor.forClass(GetJobSkillResolutionTaskResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals(300L, response.getValue().getResolution()
                .getJobSkill().getSkillId());
        assertEquals("CREATE_NEW", response.getValue().getResolution()
                .getTask().getResolutionAction());
    }
}
