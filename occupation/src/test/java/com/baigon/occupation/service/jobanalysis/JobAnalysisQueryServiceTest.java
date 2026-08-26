// 百工谱 — 岗位分析详情聚合查询测试
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisMajorCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.Set;

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
    private OccupationRepository occupationRepository;
    private MajorRepository majorRepository;
    private JobAnalysisQueryService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobAnalysisTaskRepository.class);
        candidateRepository = mock(JobAnalysisCandidateRepository.class);
        majorCandidateRepository = mock(JobAnalysisMajorCandidateRepository.class);
        resultRepository = mock(JobAnalysisResultRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        majorRepository = mock(MajorRepository.class);
        service = new JobAnalysisQueryService(
                taskRepository, candidateRepository, majorCandidateRepository, resultRepository,
                occupationRepository, majorRepository);
    }

    @Test
    void detailShouldReturnSelectedNamesCandidatesAndResults() {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(20L);
        task.setSelectedOccupationId(44L);
        task.setSelectedMajorId(55L);
        Occupation occupation = occupation(44L, "计算机程序设计员");
        Major major = major(55L, "软件工程");
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
        when(occupationRepository.findByIdInAndDeletedAtIsNull(Set.of(44L)))
                .thenReturn(List.of(occupation));
        when(majorRepository.findByIdInAndDeletedAtIsNull(Set.of(55L)))
                .thenReturn(List.of(major));

        JobAnalysisQueryService.JobAnalysisDetail detail = service.detail(20L).orElseThrow();

        assertEquals("计算机程序设计员", detail.summary().selectedOccupationName());
        assertEquals("软件工程", detail.summary().selectedMajorName());
        assertEquals(30L, detail.candidates().get(0).getId());
        assertEquals(35L, detail.majorCandidates().get(0).getId());
        assertEquals(40L, detail.results().get(0).getId());
    }

    @Test
    void listShouldResolveSelectedNamesWithTwoBatchQueries() {
        JobAnalysisTask first = task(20L, 44L, 55L);
        JobAnalysisTask second = task(21L, 45L, 56L);
        when(taskRepository.findByDeletedAtIsNull(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(first, second)));
        when(occupationRepository.findByIdInAndDeletedAtIsNull(Set.of(44L, 45L)))
                .thenReturn(List.of(
                        occupation(44L, "计算机程序设计员"),
                        occupation(45L, "软件和信息技术服务人员")));
        when(majorRepository.findByIdInAndDeletedAtIsNull(Set.of(55L, 56L)))
                .thenReturn(List.of(
                        major(55L, "软件工程"),
                        major(56L, "计算机科学与技术")));

        var page = service.list(0, 20, "");

        assertEquals("计算机程序设计员", page.getContent().get(0).selectedOccupationName());
        assertEquals("软件工程", page.getContent().get(0).selectedMajorName());
        assertEquals("软件和信息技术服务人员", page.getContent().get(1).selectedOccupationName());
        assertEquals("计算机科学与技术", page.getContent().get(1).selectedMajorName());
        verify(occupationRepository).findByIdInAndDeletedAtIsNull(Set.of(44L, 45L));
        verify(majorRepository).findByIdInAndDeletedAtIsNull(Set.of(55L, 56L));
    }

    private JobAnalysisTask task(long id, long occupationId, long majorId) {
        JobAnalysisTask task = new JobAnalysisTask();
        task.setId(id);
        task.setSelectedOccupationId(occupationId);
        task.setSelectedMajorId(majorId);
        return task;
    }

    private Occupation occupation(long id, String name) {
        Occupation occupation = new Occupation();
        occupation.setId(id);
        occupation.setName(name);
        return occupation;
    }

    private Major major(long id, String name) {
        Major major = new Major();
        major.setId(id);
        major.setName(name);
        return major;
    }
}
