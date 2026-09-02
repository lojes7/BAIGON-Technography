// 百工谱 — 规范技能与岗位技能解析 gRPC 编排测试
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.occupation.GetJobSkillResolutionTaskRequest;
import com.baigon.occupation.GetJobRequest;
import com.baigon.occupation.GetJobResponse;
import com.baigon.occupation.GetSkillRequest;
import com.baigon.occupation.GetSkillRelationsRequest;
import com.baigon.occupation.GetSkillRelationsResponse;
import com.baigon.occupation.GetSkillResponse;
import com.baigon.occupation.ListSkillsRequest;
import com.baigon.occupation.ListSkillsResponse;
import com.baigon.occupation.ListJobSkillResolutionSimilarSkillsResponse;
import com.baigon.occupation.LookupSkillsRequest;
import com.baigon.occupation.LookupSkillsResponse;
import com.baigon.occupation.ReviewJobSkillResolutionTaskRequest;
import com.baigon.occupation.ResourceIdResponse;
import com.baigon.occupation.SkillRelationMutationRequest;
import com.baigon.occupation.SkillRelationMutationResponse;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
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
import com.baigon.occupation.service.skill.SkillHierarchyService;
import com.baigon.occupation.service.skill.graph.SkillGraphQueryService;
import com.baigon.occupation.repository.skill.SkillCandidateProjection;
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
    private SkillHierarchyService hierarchyService;
    private JobQueryService jobQueryService;
    private OccupationGrpcService service;

    @BeforeEach
    void setUp() {
        queryService = mock(SkillResolutionQueryService.class);
        reviewService = mock(SkillResolutionReviewService.class);
        hierarchyService = mock(SkillHierarchyService.class);
        jobQueryService = mock(JobQueryService.class);
        service = new OccupationGrpcService(
                mock(MajorCatalogService.class),
                mock(OccupationCatalogService.class),
                mock(EmbeddingTaskManager.class),
                mock(JobAnalysisQueryService.class),
                mock(JobAnalysisReviewService.class),
                queryService,
                reviewService,
                hierarchyService,
                mock(SkillGraphQueryService.class),
                jobQueryService,
                mock(AuditLogQueryService.class),
                mock(LogService.class));
    }

    @Test
    void listSkillsShouldExposeOnlyIdsAndPagination() {
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
        assertEquals(List.of(300L), response.getValue().getIdsList());
    }

    @Test
    void getSkillShouldExposeOnlyTheSkillBody() {
        Skill skill = new Skill();
        skill.setId(300L);
        skill.setName("检索增强生成（RAG）");
        skill.setEmbeddingStatus(TaskStatus.SUCCESS);
        when(hierarchyService.getSkill(300L)).thenReturn(Optional.of(skill));
        @SuppressWarnings("unchecked")
        StreamObserver<GetSkillResponse> observer = mock(StreamObserver.class);

        service.getSkill(GetSkillRequest.newBuilder().setId(300L).build(), observer);

        ArgumentCaptor<GetSkillResponse> response =
                ArgumentCaptor.forClass(GetSkillResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(300L, response.getValue().getSkill().getSkill().getId());
        assertEquals("检索增强生成（RAG）",
                response.getValue().getSkill().getSkill().getName());
        assertEquals(true, response.getValue().getSkill().getSkill().getIsEmbed());
    }

    @Test
    void lookupSkillsShouldExposeBatchDetailsAndMissingIds() {
        Skill first = new Skill();
        first.setId(100L);
        first.setName("机器学习");
        first.setEmbeddingStatus(TaskStatus.SUCCESS);
        when(hierarchyService.lookupSkills(List.of(100L, 999L)))
                .thenReturn(new SkillHierarchyService.SkillLookup(
                        List.of(first), List.of(999L)));
        @SuppressWarnings("unchecked")
        StreamObserver<LookupSkillsResponse> observer = mock(StreamObserver.class);

        service.lookupSkills(LookupSkillsRequest.newBuilder()
                .addAllSkillIds(List.of(100L, 999L))
                .build(), observer);

        ArgumentCaptor<LookupSkillsResponse> response =
                ArgumentCaptor.forClass(LookupSkillsResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(100L, response.getValue().getItems(0).getId());
        assertEquals("机器学习", response.getValue().getItems(0).getName());
        assertEquals(true, response.getValue().getItems(0).getIsEmbed());
        assertEquals(List.of(999L), response.getValue().getMissingSkillIdsList());
    }

    @Test
    void getSkillRelationsShouldExposeOnlyTheRequestedOneHopDirection() {
        when(hierarchyService.getDirectRelations(300L)).thenReturn(Optional.of(
                new SkillHierarchyService.DirectRelations(
                        List.of(100L, 200L), List.of(400L))));
        @SuppressWarnings("unchecked")
        StreamObserver<GetSkillRelationsResponse> observer = mock(StreamObserver.class);

        service.getSkillRelations(GetSkillRelationsRequest.newBuilder()
                .setId(300L)
                .setDirection("parents")
                .build(), observer);

        ArgumentCaptor<GetSkillRelationsResponse> response =
                ArgumentCaptor.forClass(GetSkillRelationsResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(List.of(100L, 200L), response.getValue().getSkillIdsList());
    }

    @Test
    void addSkillRelationShouldReturnTheMutatedDirectedPair() {
        @SuppressWarnings("unchecked")
        StreamObserver<SkillRelationMutationResponse> observer = mock(StreamObserver.class);

        service.addSkillRelation(SkillRelationMutationRequest.newBuilder()
                .setParentSkillId(100L)
                .setChildSkillId(200L)
                .build(), observer);

        verify(hierarchyService).addRelation(100L, 200L);
        ArgumentCaptor<SkillRelationMutationResponse> response =
                ArgumentCaptor.forClass(SkillRelationMutationResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(100L, response.getValue().getParentSkillId());
        assertEquals(200L, response.getValue().getChildSkillId());
    }

    @Test
    void getJobShouldExposeJobSkillsWithoutCanonicalHierarchy() {
        Job job = new Job();
        job.setId(10L);
        job.setName("大模型应用工程师");
        when(jobQueryService.detail(10L)).thenReturn(Optional.of(
                new JobQueryService.JobDetail(job, List.of(20L))));
        @SuppressWarnings("unchecked")
        StreamObserver<GetJobResponse> observer = mock(StreamObserver.class);

        service.getJob(GetJobRequest.newBuilder().setId(10L).build(), observer);

        ArgumentCaptor<GetJobResponse> response = ArgumentCaptor.forClass(GetJobResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(List.of(20L), response.getValue().getJob().getJobSkillIdsList());
    }

    @Test
    void listResolutionSimilarSkillsShouldExposeRankedTopFiveResults() {
        SkillCandidateProjection candidate = mock(SkillCandidateProjection.class);
        when(candidate.getId()).thenReturn(300L);
        when(candidate.getName()).thenReturn("检索增强生成（RAG）");
        when(candidate.getSimilarity()).thenReturn(0.92D);
        when(queryService.listSimilarSkills(10L))
                .thenReturn(Optional.of(List.of(candidate)));
        @SuppressWarnings("unchecked")
        StreamObserver<ListJobSkillResolutionSimilarSkillsResponse> observer =
                mock(StreamObserver.class);

        service.listJobSkillResolutionSimilarSkills(
                GetJobSkillResolutionTaskRequest.newBuilder().setId(10L).build(),
                observer);

        ArgumentCaptor<ListJobSkillResolutionSimilarSkillsResponse> response =
                ArgumentCaptor.forClass(ListJobSkillResolutionSimilarSkillsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(300L, response.getValue().getItems(0).getSkillId());
        assertEquals(1, response.getValue().getItems(0).getRank());
        assertEquals(0.92D, response.getValue().getItems(0).getSimilarity());
    }

    @Test
    void createNewReviewShouldPassNullSkillIdAndReturnOnlyTaskId() {
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(10L);
        task.setTraceId(9001L);
        task.setJobSkillId(100L);
        task.setSkillName("检索增强生成");
        task.setTaskStatus(SkillResolutionTaskStatus.FAILED);
        task.setReviewStatus(ReviewStatus.PASSED);
        task.setResolutionAction(SkillResolutionAction.CREATE_NEW);
        task.setSelectedSkillId(300L);
        when(reviewService.review(eq(10L), eq(SkillResolutionAction.CREATE_NEW),
                isNull(), eq("检索增强生成（RAG）"), eq(List.of(400L, 500L)), any()))
                .thenReturn(Optional.of(task));
        @SuppressWarnings("unchecked")
        StreamObserver<ResourceIdResponse> observer = mock(StreamObserver.class);

        service.reviewJobSkillResolutionTask(
                ReviewJobSkillResolutionTaskRequest.newBuilder()
                        .setId(10L)
                        .setResolutionAction("CREATE_NEW")
                        .setNewSkillName("检索增强生成（RAG）")
                        .addAllParentSkillIds(List.of(400L, 500L))
                        .build(),
                observer);

        ArgumentCaptor<ResourceIdResponse> response =
                ArgumentCaptor.forClass(ResourceIdResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals(10L, response.getValue().getId());
    }
}
