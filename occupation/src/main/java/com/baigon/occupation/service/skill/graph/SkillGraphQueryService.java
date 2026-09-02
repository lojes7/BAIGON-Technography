// 百工谱 — 职业/专业技能时间图谱查询业务层
package com.baigon.occupation.service.skill.graph;

import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.ScopeType;
import com.baigon.occupation.repository.skill.graph.SkillGraphQueryRepository.SkillMetricAggregate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class SkillGraphQueryService {

    private static final ZoneId TIMELINE_ZONE = ZoneId.of("Asia/Shanghai");
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_LOOKUP_SKILLS = 200;

    private final SkillGraphQueryRepository graphRepository;
    private final OccupationRepository occupationRepository;
    private final MajorRepository majorRepository;

    public SkillGraphQueryService(SkillGraphQueryRepository graphRepository,
                                  OccupationRepository occupationRepository,
                                  MajorRepository majorRepository) {
        this.graphRepository = graphRepository;
        this.occupationRepository = occupationRepository;
        this.majorRepository = majorRepository;
    }

    public SkillGraph getGraph(String scopeType,
                               Long scopeId,
                               String fromMonth,
                               String toMonth) {
        ScopeType scope = scope(scopeType);
        long id = positiveId(scopeId);
        Timeline timeline = timeline(fromMonth, toMonth);
        validateScope(scope, id);

        List<Long> directSkillIds = graphRepository.findDirectSkillIds(
                scope, id, timeline.publishedFrom(), timeline.publishedTo());
        return new SkillGraph(id, List.copyOf(directSkillIds));
    }

    public MetricLookup lookupMetrics(String scopeType,
                                      Long scopeId,
                                      Collection<Long> skillIds,
                                      String fromMonth,
                                      String toMonth) {
        ScopeType scope = scope(scopeType);
        long id = positiveId(scopeId);
        LinkedHashSet<Long> ids = normalizedSkillIds(skillIds);
        Timeline timeline = timeline(fromMonth, toMonth);
        validateScope(scope, id);

        long totalJobCount = graphRepository.countJobs(
                scope, id, timeline.publishedFrom(), timeline.publishedTo());
        Map<Long, SkillMetric> metricsById = new LinkedHashMap<>();
        graphRepository.findMetrics(
                        scope, id, ids, timeline.publishedFrom(), timeline.publishedTo())
                .stream()
                .map(aggregate -> metric(aggregate, totalJobCount))
                .forEach(metric -> metricsById.put(metric.skillId(), metric));
        List<SkillMetric> items = ids.stream()
                .map(metricsById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<Long> missingIds = ids.stream()
                .filter(skillId -> !metricsById.containsKey(skillId))
                .toList();
        return new MetricLookup(List.copyOf(items), List.copyOf(missingIds));
    }

    public EvidencePage listEvidenceJobs(String scopeType,
                                         Long scopeId,
                                         Long skillId,
                                         String fromMonth,
                                         String toMonth,
                                         int page,
                                         int pageSize) {
        ScopeType scope = scope(scopeType);
        long id = positiveId(scopeId);
        long normalizedSkillId = positiveSkillId(skillId);
        Timeline timeline = timeline(fromMonth, toMonth);
        int size = normalizedPageSize(page, pageSize);
        validateScope(scope, id);

        long total = graphRepository.countEvidenceJobs(
                scope, id, normalizedSkillId,
                timeline.publishedFrom(), timeline.publishedTo());
        List<Long> jobIds = total == 0 ? List.of() : graphRepository.findEvidenceJobIds(
                scope, id, normalizedSkillId,
                timeline.publishedFrom(), timeline.publishedTo(), page, size);
        return new EvidencePage(List.copyOf(jobIds), total, page, size);
    }

    private SkillMetric metric(SkillMetricAggregate aggregate, long totalJobCount) {
        double coverage = totalJobCount == 0
                ? 0 : (double) aggregate.jobCount() / totalJobCount;
        return new SkillMetric(aggregate.skillId(), aggregate.jobCount(), coverage);
    }

    private void validateScope(ScopeType scope, long scopeId) {
        if (scope == ScopeType.OCCUPATION) {
            if (occupationRepository.findByIdAndDeletedAtIsNull(scopeId).isEmpty()) {
                throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "occupation not found");
            }
            return;
        }
        if (majorRepository.findByIdAndDeletedAtIsNull(scopeId).isEmpty()) {
            throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "major not found");
        }
    }

    private Timeline timeline(String fromMonth, String toMonth) {
        YearMonth from = yearMonthOrNull(fromMonth, "from_month");
        YearMonth to = yearMonthOrNull(toMonth, "to_month");
        if (from != null && to != null && !from.isBefore(to)) {
            throw new IllegalArgumentException("from_month must be before to_month");
        }
        return new Timeline(monthStart(from), monthStart(to));
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

    private LinkedHashSet<Long> normalizedSkillIds(Collection<Long> values) {
        if (values == null || values.isEmpty() || values.size() > MAX_LOOKUP_SKILLS) {
            throw new IllegalArgumentException("skill_ids must contain between 1 and 200 ids");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Long value : values) ids.add(positiveSkillId(value));
        return ids;
    }

    private long positiveSkillId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("skill_id must be > 0");
        }
        return value;
    }

    private int normalizedPageSize(int page, int pageSize) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        int size = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return size;
    }

    private record Timeline(OffsetDateTime publishedFrom, OffsetDateTime publishedTo) {
    }

    public record SkillGraph(long scopeId, List<Long> directSkillIds) {
    }

    public record SkillMetric(long skillId, long jobCount, double coverage) {
    }

    public record MetricLookup(List<SkillMetric> items, List<Long> missingIds) {
    }

    public record EvidencePage(List<Long> jobIds,
                               long total,
                               int page,
                               int pageSize) {
    }
}
