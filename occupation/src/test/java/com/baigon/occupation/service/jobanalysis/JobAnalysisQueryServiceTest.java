// 百工谱 — 岗位分析详情聚合查询测试
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisMajorCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobAnalysisQueryServiceTest {

    private JobAnalysisTaskRepository taskRepository;
    private JobAnalysisCandidateRepository candidateRepository;
    private JobAnalysisMajorCandidateRepository majorCandidateRepository;
    private JobAnalysisResultRepository resultRepository;
    private JobAnalysisQueryService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        candidateRepository = mock(JobAnalysisCandidateRepository.class);
        majorCandidateRepository = mock(JobAnalysisMajorCandidateRepository.class);
        resultRepository = mock(JobAnalysisResultRepository.class);
        service = new JobAnalysisQueryService(
                taskRepository, candidateRepository, majorCandidateRepository, resultRepository);
    }

    @Test
    void detailShouldReturnTaskAndChildResourceIds() {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setSelectedOccupationId(44L);
        task.setSelectedMajorId(55L);
        JobAnalysisCandidate candidate = new JobAnalysisCandidate();
        candidate.setId(30L);
        JobAnalysisMajorCandidate majorCandidate = new JobAnalysisMajorCandidate();
        majorCandidate.setId(35L);
        JobAnalysisResult result = new JobAnalysisResult();
        result.setId(40L);

        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task));
        when(candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(candidate));
        when(majorCandidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(majorCandidate));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(result));
        JobAnalysisQueryService.JobAnalysisDetail detail = service.detail(20L).orElseThrow();

        assertEquals(task, detail.task());
        assertEquals(List.of(30L), detail.candidateIds());
        assertEquals(List.of(35L), detail.majorCandidateIds());
        assertEquals(List.of(40L), detail.resultIds());
    }

    @Test
    void listShouldReturnTaskPageWithoutHydratingRelatedCatalogs() {
        JobAnalysisTask first = task(20L, 44L, 55L);
        JobAnalysisTask second = task(21L, 45L, 56L);
        when(taskRepository.findByDeletedAtIsNull(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(first, second)));

        var page = service.list(0, 20, "", "");

        assertEquals(List.of(first, second), page.getContent());
        verify(taskRepository).findByDeletedAtIsNull(any(Pageable.class));
    }

    private JobAnalysisTask task(long id, long occupationId, long majorId) {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(id);
        task.setSelectedOccupationId(occupationId);
        task.setSelectedMajorId(majorId);
        return task;
    }

}
