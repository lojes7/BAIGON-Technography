// 百工谱 — 职业/专业技能时间图谱查询业务层
package com.baigon.occupation.service.skill.graph;

import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.JobEvidence;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.ScopeType;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.SkillAggregate;
import com.baigon.occupation.service.skill.SkillHierarchyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SkillGraphQueryService {

    private static final ZoneId TIMELINE_ZONE = ZoneId.of("Asia/Shanghai");
    private static final int DEFAULT_EVIDENCE_LIMIT = 10;
    private static final int MAX_EVIDENCE_LIMIT = 50;

    private final SkillGraphQueryRepository graphRepository;
    private final OccupationRepository occupationRepository;
    private final MajorRepository majorRepository;
    private final SkillRepository skillRepository;
    private final SkillHierarchyService hierarchyService;

    public SkillGraphQueryService(SkillGraphQueryRepository graphRepository,
                                  OccupationRepository occupationRepository,
                                  MajorRepository majorRepository,
                                  SkillRepository skillRepository,
                                  SkillHierarchyService hierarchyService) {
        this.graphRepository = graphRepository;
        this.occupationRepository = occupationRepository;
        this.majorRepository = majorRepository;
        this.skillRepository = skillRepository;
        this.hierarchyService = hierarchyService;
    }

    public SkillGraph getGraph(String scopeType,
                               Long scopeId,
                               String fromMonth,
                               String toMonth,
                               Integer evidenceLimit) {
        ScopeType scope = scope(scopeType);
        long id = positiveId(scopeId);
        Timeline timeline = timeline(fromMonth, toMonth);
        int normalizedEvidenceLimit = evidenceLimit(evidenceLimit);
        ScopeDescriptor descriptor = descriptor(scope, id);

        long totalJobCount = graphRepository.countJobs(
                scope, id, timeline.publishedFrom(), timeline.publishedTo());
        List<SkillAggregate> aggregates = graphRepository.findSkills(
                scope, id, timeline.publishedFrom(), timeline.publishedTo());
        if (aggregates.isEmpty()) {
            return new SkillGraph(descriptor, timeline, totalJobCount, List.of());
        }

        List<Long> skillIds = aggregates.stream().map(SkillAggregate::skillId).toList();
        Map<Long, SkillHierarchyService.DirectRelations> relations =
                hierarchyService.directRelations(skillIds);
        Map<Long, Skill> parentSkills = parentSkills(relations.values());
        Map<Long, List<JobEvidence>> evidenceBySkill = graphRepository.findEvidence(
                        scope, id, timeline.publishedFrom(), timeline.publishedTo(),
                        normalizedEvidenceLimit)
                .stream()
                .collect(Collectors.groupingBy(
                        JobEvidence::skillId, LinkedHashMap::new, Collectors.toList()));

        List<SkillNode> nodes = new ArrayList<>();
        for (SkillAggregate aggregate : aggregates) {
            SkillHierarchyService.DirectRelations direct = relations.getOrDefault(
                    aggregate.skillId(), SkillHierarchyService.DirectRelations.empty());
            List<ParentSkill> parents = direct.parentSkillIds().stream()
                    .map(parentSkills::get)
                    .filter(java.util.Objects::nonNull)
                    .map(skill -> new ParentSkill(skill.getId(), skill.getName()))
                    .toList();
            double coverage = totalJobCount == 0
                    ? 0 : (double) aggregate.jobCount() / totalJobCount;
            nodes.add(new SkillNode(
                    aggregate.skillId(), aggregate.skillName(), aggregate.jobCount(),
                    coverage, parents,
                    List.copyOf(evidenceBySkill.getOrDefault(aggregate.skillId(), List.of()))));
        }
        return new SkillGraph(descriptor, timeline, totalJobCount, List.copyOf(nodes));
    }

    private ScopeDescriptor descriptor(ScopeType scope, long scopeId) {
        if (scope == ScopeType.OCCUPATION) {
            Occupation occupation = occupationRepository.findByIdAndDeletedAtIsNull(scopeId)
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "occupation not found"));
            return new ScopeDescriptor(scope.name(), occupation.getId(),
                    occupation.getCode(), occupation.getName());
        }
        Major major = majorRepository.findByIdAndDeletedAtIsNull(scopeId)
                .orElseThrow(() -> new ApiException(
                        ApiException.ErrorCode.NOT_FOUND, "major not found"));
        return new ScopeDescriptor(scope.name(), major.getId(), major.getCode(), major.getName());
    }

    private Map<Long, Skill> parentSkills(
            Collection<SkillHierarchyService.DirectRelations> relations) {
        Set<Long> ids = relations.stream()
                .flatMap(relation -> relation.parentSkillIds().stream())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) return Map.of();
        return skillRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(ids).stream()
                .collect(Collectors.toMap(
                        Skill::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new));
    }

    private Timeline timeline(String fromMonth, String toMonth) {
        YearMonth from = yearMonthOrNull(fromMonth, "from_month");
        YearMonth to = yearMonthOrNull(toMonth, "to_month");
        if (from != null && to != null && !from.isBefore(to)) {
            throw new IllegalArgumentException("from_month must be before to_month");
        }
        return new Timeline(
                from == null ? "" : from.toString(),
                to == null ? "" : to.toString(),
                monthStart(from), monthStart(to), TIMELINE_ZONE.getId());
    }

    private OffsetDateTime monthStart(YearMonth month) {
        return month == null ? null
                : month.atDay(1).atStartOfDay(TIMELINE_ZONE).toOffsetDateTime();
    }

    private YearMonth yearMonthOrNull(String value, String field) {
        if (value == null || value.isBlank()) return null;
        try {
            return YearMonth.parse(value.trim());
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(field + " must use YYYY-MM");
        }
    }

    private ScopeType scope(String value) {
        if (value == null) throw new IllegalArgumentException("scope_type is required");
        try {
            return ScopeType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("scope_type must be OCCUPATION or MAJOR");
        }
    }

    private long positiveId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("scope_id must be > 0");
        }
        return value;
    }

    private int evidenceLimit(Integer value) {
        int limit = value == null || value == 0 ? DEFAULT_EVIDENCE_LIMIT : value;
        if (limit < 1 || limit > MAX_EVIDENCE_LIMIT) {
            throw new IllegalArgumentException("evidence_limit must be between 1 and 50");
        }
        return limit;
    }

    public record ScopeDescriptor(String type, long id, String code, String name) {
    }

    public record Timeline(String fromMonth,
                           String toMonth,
                           OffsetDateTime publishedFrom,
                           OffsetDateTime publishedTo,
                           String timezone) {
    }

    public record ParentSkill(long id, String name) {
    }

    public record SkillNode(long id,
                            String name,
                            long jobCount,
                            double coverage,
                            List<ParentSkill> parents,
                            List<JobEvidence> evidenceJobs) {
    }

    public record SkillGraph(ScopeDescriptor scope,
                             Timeline timeline,
                             long totalJobCount,
                             List<SkillNode> skills) {
    }
}
