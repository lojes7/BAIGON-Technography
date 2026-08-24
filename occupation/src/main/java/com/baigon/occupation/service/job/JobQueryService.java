// 百工谱 — 已审核岗位查询业务层
package com.baigon.occupation.service.job;

import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/** jobs 的分页检索，以及岗位、专业、职业和正式技能关系的聚合查询。 */
@Service
@Transactional(readOnly = true)
public class JobQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final JobRepository jobRepository;
    private final MajorRepository majorRepository;
    private final OccupationRepository occupationRepository;
    private final JobSkillRepository jobSkillRepository;

    public JobQueryService(JobRepository jobRepository,
                           MajorRepository majorRepository,
                           OccupationRepository occupationRepository,
                           JobSkillRepository jobSkillRepository) {
        this.jobRepository = jobRepository;
        this.majorRepository = majorRepository;
        this.occupationRepository = occupationRepository;
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
            Major major = job.getMajorId() == null
                    ? null
                    : majorRepository.findByIdAndDeletedAtIsNull(job.getMajorId()).orElse(null);
            Occupation occupation = job.getOccupationId() == null
                    ? null
                    : occupationRepository.findByIdAndDeletedAtIsNull(job.getOccupationId()).orElse(null);
            List<JobSkill> skills =
                    jobSkillRepository.findByJobIdAndDeletedAtIsNullOrderByIdAsc(job.getId());
            return new JobDetail(job, major, occupation, skills);
        });
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

    public record JobDetail(Job job, Major major, Occupation occupation, List<JobSkill> jobSkills) {
    }
}
