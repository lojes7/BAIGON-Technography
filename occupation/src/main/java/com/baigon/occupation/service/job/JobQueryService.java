// 百工谱 — 已审核岗位查询业务层
package com.baigon.occupation.service.job;

import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** jobs 的分页检索，以及岗位本体和正式技能关系 ID 查询。 */
@Service
@Transactional(readOnly = true)
public class JobQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_LOOKUP_IDS = 200;

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;

    public JobQueryService(JobRepository jobRepository,
                           JobSkillRepository jobSkillRepository) {
        this.jobRepository = jobRepository;
        this.jobSkillRepository = jobSkillRepository;
    }

    public Page<Job> list(int page, int pageSize, JobSearchCriteria criteria) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        JobSearchCriteria filter = criteria == null ? JobSearchCriteria.empty() : criteria;
        Long occupationId = occupationId(filter.occupationId());
        Long majorId = majorId(filter.majorId());
        PageRequest pageable = PageRequest.of(
                page,
                normalizedPageSize(pageSize),
                Sort.by(Sort.Direction.DESC, "id"));
        return jobRepository.search(
                text(filter.name()), occupationId, majorId, text(filter.major()), text(filter.city()),
                text(filter.province()), text(filter.salary()), text(filter.company()),
                text(filter.education()), text(filter.nature()), text(filter.companySize()),
                pageable);
    }

    public Optional<JobDetail> detail(long id) {
        if (id <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return jobRepository.findByIdAndDeletedAtIsNull(id).map(job -> {
            List<Long> jobSkillIds = jobSkillRepository
                    .findByJobIdAndDeletedAtIsNullOrderByIdAsc(job.getId()).stream()
                    .map(JobSkill::getId)
                    .toList();
            return new JobDetail(job, List.copyOf(jobSkillIds));
        });
    }

    /** 批量读取岗位详情与岗位技能关系 ID；固定两次查询，避免逐岗位 N+1。 */
    public JobLookup lookupJobs(Collection<Long> values) {
        LinkedHashSet<Long> ids = normalizedIds(values);
        List<Job> jobs = jobRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(ids);
        Map<Long, List<Long>> skillIdsByJob = new LinkedHashMap<>();
        if (!jobs.isEmpty()) {
            for (JobSkill skill : jobSkillRepository
                    .findByJobIdInAndDeletedAtIsNullOrderByJobIdAscIdAsc(
                            jobs.stream().map(Job::getId).toList())) {
                skillIdsByJob.computeIfAbsent(skill.getJobId(), ignored -> new java.util.ArrayList<>())
                        .add(skill.getId());
            }
        }
        Map<Long, Job> jobsById = new LinkedHashMap<>();
        jobs.forEach(job -> jobsById.put(job.getId(), job));
        List<JobDetail> items = ids.stream()
                .map(jobsById::get)
                .filter(java.util.Objects::nonNull)
                .map(job -> new JobDetail(job, List.copyOf(
                        skillIdsByJob.getOrDefault(job.getId(), List.of()))))
                .toList();
        List<Long> missingIds = ids.stream()
                .filter(requestedId -> !jobsById.containsKey(requestedId))
                .toList();
        return new JobLookup(List.copyOf(items), List.copyOf(missingIds));
    }

    public Optional<JobSkill> getJobSkill(Long id) {
        return jobSkillRepository.findByIdAndDeletedAtIsNull(positiveId(id));
    }

    public JobSkillLookup lookupJobSkills(Collection<Long> values) {
        LinkedHashSet<Long> ids = normalizedIds(values);
        List<JobSkill> loaded = jobSkillRepository
                .findByIdInAndDeletedAtIsNullOrderByIdAsc(ids);
        Map<Long, JobSkill> loadedById = new LinkedHashMap<>();
        loaded.forEach(item -> loadedById.put(item.getId(), item));
        List<JobSkill> items = ids.stream()
                .map(loadedById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<Long> missingIds = ids.stream()
                .filter(requestedId -> !loadedById.containsKey(requestedId))
                .toList();
        return new JobSkillLookup(List.copyOf(items), List.copyOf(missingIds));
    }

    public int normalizedPageSize(int pageSize) {
        if (pageSize < 0 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
    }

    private Long occupationId(Long value) {
        if (value == null || value == 0) {
            return null;
        }
        if (value < 0) {
            throw new IllegalArgumentException("occupation_id must be > 0");
        }
        return value;
    }

    private Long majorId(Long value) {
        if (value == null || value == 0) {
            return null;
        }
        if (value < 0) {
            throw new IllegalArgumentException("major_id must be > 0");
        }
        return value;
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }

    private LinkedHashSet<Long> normalizedIds(Collection<Long> values) {
        if (values == null || values.isEmpty() || values.size() > MAX_LOOKUP_IDS) {
            throw new IllegalArgumentException("ids must contain between 1 and 200 ids");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Long value : values) ids.add(positiveId(value));
        return ids;
    }

    private long positiveId(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return value;
    }

    public record JobSearchCriteria(
            String name,
            Long occupationId,
            Long majorId,
            String major,
            String city,
            String province,
            String salary,
            String company,
            String education,
            String nature,
            String companySize) {

        public static JobSearchCriteria empty() {
            return new JobSearchCriteria("", null, null, "", "", "", "", "", "", "", "");
        }
    }

    public record JobDetail(Job job, List<Long> jobSkillIds) {
    }

    public record JobLookup(List<JobDetail> items, List<Long> missingIds) {
    }

    public record JobSkillLookup(List<JobSkill> items, List<Long> missingIds) {
    }
}
