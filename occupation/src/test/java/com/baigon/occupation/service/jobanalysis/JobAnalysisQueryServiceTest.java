// 百工谱 — 岗位分析详情聚合查询测试
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JobAnalysisQueryServiceTest {

    @Test
    void detailShouldReturnCandidatesAndJobAnalysisResults() {
        JobAnalysisTaskRepository taskRepository = mock(JobAnalysisTaskRepository.class);
        JobAnalysisCandidateRepository candidateRepository = mock(JobAnalysisCandidateRepository.class);
        JobAnalysisResultRepository resultRepository = mock(JobAnalysisResultRepository.class);
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        JobAnalysisCandidate candidate = new JobAnalysisCandidate();
        candidate.setId(30L);
        JobAnalysisResult result = new JobAnalysisResult();
        result.setId(40L);

        when(taskRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(task));
        when(candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(candidate));
        when(resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(20L))
                .thenReturn(List.of(result));

        JobAnalysisQueryService service = new JobAnalysisQueryService(
                taskRepository, candidateRepository, resultRepository);
        JobAnalysisQueryService.JobAnalysisDetail detail = service.detail(20L).orElseThrow();

        assertEquals(30L, detail.candidates().get(0).getId());
        assertEquals(40L, detail.results().get(0).getId());
    }
}
