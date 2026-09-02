// 百工谱 — 技能目录与岗位技能解析任务查询测试
package com.baigon.occupation.service.skill;

import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillCandidateProjection;
import com.baigon.occupation.repository.skill.SkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillResolutionQueryServiceTest {

    private SkillRepository skillRepository;
    private JobSkillResolutionTaskRepository taskRepository;
    private JobSkillResolutionCandidateRepository candidateRepository;
    private SkillResolutionQueryService service;

    @BeforeEach
    void setUp() {
        skillRepository = mock(SkillRepository.class);
        taskRepository = mock(JobSkillResolutionTaskRepository.class);
        candidateRepository = mock(JobSkillResolutionCandidateRepository.class);
        service = new SkillResolutionQueryService(
                skillRepository, taskRepository, candidateRepository);
    }

    @Test
    void listSkillsShouldTrimKeywordAndUseDefaultPageSize() {
        when(skillRepository.search(eq("RAG"), any(Pageable.class)))
                .thenReturn(Page.empty());

        service.listSkills(2, 0, "  RAG  ");

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(skillRepository).search(eq("RAG"), pageable.capture());
        assertEquals(2, pageable.getValue().getPageNumber());
        assertEquals(20, pageable.getValue().getPageSize());
        assertEquals("name: ASC,id: ASC", pageable.getValue().getSort().toString());
    }

    @Test
    void listTasksShouldParseBothStatusesAndReturnTaskBodies() {
        JobSkillResolutionTask task = task();
        when(taskRepository.findByTaskStatusAndReviewStatusAndDeletedAtIsNull(
                eq(SkillResolutionTaskStatus.SUCCESS), eq(ReviewStatus.PENDING), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(task)));

        Page<JobSkillResolutionTask> page =
                service.listTasks(0, 10, "success", "pending");

        assertEquals(1, page.getTotalElements());
        assertEquals(task, page.getContent().get(0));
    }

    @Test
    void listTasksShouldUseQueryWithoutNullableEnumParameters() {
        when(taskRepository.findByDeletedAtIsNull(any(Pageable.class))).thenReturn(Page.empty());
        when(taskRepository.findByTaskStatusAndDeletedAtIsNull(
                eq(SkillResolutionTaskStatus.SUCCESS), any(Pageable.class))).thenReturn(Page.empty());
        when(taskRepository.findByReviewStatusAndDeletedAtIsNull(
                eq(ReviewStatus.PENDING), any(Pageable.class))).thenReturn(Page.empty());
        service.listTasks(0, 20, "", "");
        service.listTasks(0, 20, "SUCCESS", "");
        service.listTasks(0, 20, "", "PENDING");

        verify(taskRepository).findByDeletedAtIsNull(any(Pageable.class));
        verify(taskRepository).findByTaskStatusAndDeletedAtIsNull(
                eq(SkillResolutionTaskStatus.SUCCESS), any(Pageable.class));
        verify(taskRepository).findByReviewStatusAndDeletedAtIsNull(
                eq(ReviewStatus.PENDING), any(Pageable.class));
    }

    @Test
    void listTasksShouldRejectUnsupportedReviewStatus() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.listTasks(0, 20, "", "REJECTED"));

        assertEquals("review_status must be PENDING or PASSED", exception.getMessage());
    }

    @Test
    void getDetailShouldReturnTaskAndRankedCandidateIds() {
        JobSkillResolutionTask task = task();
        JobSkillResolutionCandidate candidate = new JobSkillResolutionCandidate();
        candidate.setId(50L);
        candidate.setTaskId(10L);
        candidate.setSkillId(300L);
        candidate.setRank(1);
        when(taskRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(task));
        when(candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(10L))
                .thenReturn(List.of(candidate));

        SkillResolutionQueryService.Detail detail = service.getDetail(10L).orElseThrow();

        assertEquals(task, detail.task());
        assertEquals(List.of(50L), detail.candidateIds());
    }

    @Test
    void listSimilarSkillsShouldReuseNearestVectorQueryWithFixedTopFiveLimit() {
        JobSkillResolutionTask task = task();
        SkillCandidateProjection candidate = mock(SkillCandidateProjection.class);
        when(taskRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(task));
        when(taskRepository.findSkillNameVectorLiteralById(10L))
                .thenReturn(Optional.of("[0.1,0.2]"));
        when(skillRepository.findNearestByNameVector("[0.1,0.2]", 5))
                .thenReturn(List.of(candidate));

        List<SkillCandidateProjection> result = service
                .listSimilarSkills(10L)
                .orElseThrow();

        assertEquals(List.of(candidate), result);
        verify(skillRepository).findNearestByNameVector("[0.1,0.2]", 5);
    }

    @Test
    void listSimilarSkillsShouldReturnEmptyListWhenTaskHasNoVector() {
        when(taskRepository.findByIdAndDeletedAtIsNull(10L))
                .thenReturn(Optional.of(task()));
        when(taskRepository.findSkillNameVectorLiteralById(10L))
                .thenReturn(Optional.empty());

        assertEquals(List.of(), service.listSimilarSkills(10L).orElseThrow());
    }

    private JobSkillResolutionTask task() {
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(10L);
        task.setJobSkillId(100L);
        task.setTaskStatus(SkillResolutionTaskStatus.SUCCESS);
        task.setReviewStatus(ReviewStatus.PENDING);
        return task;
    }

}
