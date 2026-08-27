// 百工谱 — 职业/专业技能时间图谱业务测试
package com.baigon.occupation.service.skill.graph;

import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.JobEvidence;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.ScopeType;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.SkillAggregate;
import com.baigon.occupation.service.skill.SkillHierarchyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SkillGraphQueryServiceTest {

    private SkillGraphQueryRepository graphRepository;
    private OccupationRepository occupationRepository;
    private SkillRepository skillRepository;
    private SkillHierarchyService hierarchyService;
    private SkillGraphQueryService service;

    @BeforeEach
    void setUp() {
        graphRepository = mock(SkillGraphQueryRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        skillRepository = mock(SkillRepository.class);
        hierarchyService = mock(SkillHierarchyService.class);
        service = new SkillGraphQueryService(
                graphRepository, occupationRepository, mock(MajorRepository.class),
                skillRepository, hierarchyService);
    }

    @Test
    void occupationGraphShouldUseMonthBoundariesAndCalculateCoverage() {
        Occupation occupation = new Occupation();
        occupation.setId(100L);
        occupation.setCode("2-02-10-09");
        occupation.setName("软件工程技术人员");
        when(occupationRepository.findByIdAndDeletedAtIsNull(100L))
                .thenReturn(Optional.of(occupation));

        OffsetDateTime from = OffsetDateTime.parse("2026-05-01T00:00:00+08:00");
        OffsetDateTime to = OffsetDateTime.parse("2026-06-01T00:00:00+08:00");
        when(graphRepository.countJobs(ScopeType.OCCUPATION, 100L, from, to))
                .thenReturn(4L);
        when(graphRepository.findSkills(ScopeType.OCCUPATION, 100L, from, to))
                .thenReturn(List.of(new SkillAggregate(200L, "Spring Boot", 3L)));
        when(hierarchyService.directRelations(List.of(200L)))
                .thenReturn(Map.of(200L,
                        new SkillHierarchyService.DirectRelations(List.of(201L), List.of())));
        Skill parent = new Skill();
        parent.setId(201L);
        parent.setName("Java");
        when(skillRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(anyCollection()))
                .thenReturn(List.of(parent));
        when(graphRepository.findEvidence(ScopeType.OCCUPATION, 100L, from, to, 10))
                .thenReturn(List.of(new JobEvidence(
                        200L, 300L, "Java 开发工程师", "示例企业", "智联招聘",
                        "https://example.test/job/300", from)));

        SkillGraphQueryService.SkillGraph graph = service.getGraph(
                "OCCUPATION", 100L, "2026-05", "2026-06", 0);

        assertEquals(4L, graph.totalJobCount());
        assertEquals(0.75, graph.skills().getFirst().coverage());
        assertEquals("Java", graph.skills().getFirst().parents().getFirst().name());
        assertEquals("Java 开发工程师",
                graph.skills().getFirst().evidenceJobs().getFirst().jobName());
        assertEquals("Asia/Shanghai", graph.timeline().timezone());
    }

    @Test
    void invalidOrReversedMonthShouldBeRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.getGraph("OCCUPATION", 1L, "2026/05", "", 10));
        assertThrows(IllegalArgumentException.class,
                () -> service.getGraph("MAJOR", 1L, "2026-06", "2026-05", 10));
    }
}
