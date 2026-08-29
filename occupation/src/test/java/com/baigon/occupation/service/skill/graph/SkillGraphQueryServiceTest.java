// 百工谱 — 职业/专业技能时间图谱业务测试
package com.baigon.occupation.service.skill.graph;

import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.ScopeType;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.SkillMetricAggregate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillGraphQueryServiceTest {

    private SkillGraphQueryRepository graphRepository;
    private OccupationRepository occupationRepository;
    private MajorRepository majorRepository;
    private SkillGraphQueryService service;

    @BeforeEach
    void setUp() {
        graphRepository = mock(SkillGraphQueryRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        majorRepository = mock(MajorRepository.class);
        service = new SkillGraphQueryService(
                graphRepository, occupationRepository, majorRepository);
    }

    @Test
    void occupationGraphShouldReturnOnlyDirectSkillIdsWithinMonthBoundaries() {
        when(occupationRepository.findByIdAndDeletedAtIsNull(100L))
                .thenReturn(Optional.of(occupation(100L)));
        OffsetDateTime from = OffsetDateTime.parse("2026-05-01T00:00:00+08:00");
        OffsetDateTime to = OffsetDateTime.parse("2026-06-01T00:00:00+08:00");
        when(graphRepository.findDirectSkillIds(ScopeType.OCCUPATION, 100L, from, to))
                .thenReturn(List.of(200L, 300L));

        SkillGraphQueryService.SkillGraph graph = service.getGraph(
                "OCCUPATION", 100L, "2026-05", "2026-06");

        assertEquals(100L, graph.scopeId());
        assertEquals(List.of(200L, 300L), graph.directSkillIds());
        verify(graphRepository, never()).countJobs(ScopeType.OCCUPATION, 100L, from, to);
    }

    @Test
    void metricsShouldDeduplicateIdsAndCalculateDirectCoverage() {
        when(occupationRepository.findByIdAndDeletedAtIsNull(100L))
                .thenReturn(Optional.of(occupation(100L)));
        OffsetDateTime from = OffsetDateTime.parse("2026-05-01T00:00:00+08:00");
        OffsetDateTime to = OffsetDateTime.parse("2026-06-01T00:00:00+08:00");
        TreeSet<Long> skillIds = new TreeSet<>(List.of(200L, 300L));
        when(graphRepository.countJobs(ScopeType.OCCUPATION, 100L, from, to))
                .thenReturn(4L);
        when(graphRepository.findMetrics(
                ScopeType.OCCUPATION, 100L, skillIds, from, to))
                .thenReturn(List.of(new SkillMetricAggregate(200L, 3L)));

        SkillGraphQueryService.MetricLookup lookup = service.lookupMetrics(
                "occupation", 100L, List.of(300L, 200L, 300L), "2026-05", "2026-06");

        assertEquals(1, lookup.items().size());
        assertEquals(200L, lookup.items().getFirst().skillId());
        assertEquals(3L, lookup.items().getFirst().jobCount());
        assertEquals(0.75, lookup.items().getFirst().coverage());
        assertEquals(List.of(300L), lookup.missingIds());
    }

    @Test
    void evidenceShouldReturnOnlyPagedJobIds() {
        when(occupationRepository.findByIdAndDeletedAtIsNull(100L))
                .thenReturn(Optional.of(occupation(100L)));
        when(graphRepository.countEvidenceJobs(
                ScopeType.OCCUPATION, 100L, 200L, null, null)).thenReturn(3L);
        when(graphRepository.findEvidenceJobIds(
                ScopeType.OCCUPATION, 100L, 200L, null, null, 1, 2))
                .thenReturn(List.of(501L));

        SkillGraphQueryService.EvidencePage page = service.listEvidenceJobs(
                "OCCUPATION", 100L, 200L, "", "", 1, 2);

        assertEquals(List.of(501L), page.jobIds());
        assertEquals(3L, page.total());
        assertEquals(1, page.page());
        assertEquals(2, page.pageSize());
    }

    @Test
    void invalidOrReversedMonthShouldBeRejectedBeforeRepositoryAccess() {
        assertThrows(IllegalArgumentException.class,
                () -> service.getGraph("OCCUPATION", 1L, "2026/05", ""));
        assertThrows(IllegalArgumentException.class,
                () -> service.getGraph("MAJOR", 1L, "2026-06", "2026-05"));
    }

    private Occupation occupation(long id) {
        Occupation occupation = new Occupation();
        occupation.setId(id);
        return occupation;
    }
}
