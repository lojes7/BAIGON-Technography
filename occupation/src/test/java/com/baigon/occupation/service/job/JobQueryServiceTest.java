// 百工谱 — 已审核岗位分页筛选与聚合详情测试
package com.baigon.occupation.service.job;

import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobQueryServiceTest {

    private JobRepository jobRepository;
    private MajorRepository majorRepository;
    private OccupationRepository occupationRepository;
    private JobSkillRepository jobSkillRepository;
    private JobQueryService service;

    @BeforeEach
    void setUp() {
        jobRepository = mock(JobRepository.class);
        majorRepository = mock(MajorRepository.class);
        occupationRepository = mock(OccupationRepository.class);
        jobSkillRepository = mock(JobSkillRepository.class);
        service = new JobQueryService(
                jobRepository, majorRepository, occupationRepository, jobSkillRepository);
    }

    @Test
    void listShouldTrimFiltersAndUseDefaultPageSize() {
        Job job = new Job();
        job.setId(10L);
        when(jobRepository.search(
                eq("Java"), isNull(), eq(456L), eq("计算机"), eq("杭州"), eq("浙江"), eq("20K"),
                eq("百工"), eq("本科"), eq("全职"), eq("100人"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(job)));

        Page<Job> result = service.list(0, 0, new JobQueryService.JobSearchCriteria(
                " Java ", null, 456L, " 计算机 ", " 杭州 ", " 浙江 ", " 20K ",
                " 百工 ", " 本科 ", " 全职 ", " 100人 "));

        assertEquals(10L, result.getContent().get(0).getId());
        verify(jobRepository).search(
                eq("Java"), isNull(), eq(456L), eq("计算机"), eq("杭州"), eq("浙江"), eq("20K"),
                eq("百工"), eq("本科"), eq("全职"), eq("100人"),
                org.mockito.ArgumentMatchers.argThat(pageable ->
                        pageable.getPageNumber() == 0 && pageable.getPageSize() == 20
                                && pageable.getSort().getOrderFor("id").isDescending()));
    }

    @Test
    void detailShouldAggregateMajorOccupationAndJobSkills() {
        Job job = new Job();
        job.setId(10L);
        job.setMajorId(15L);
        job.setOccupationId(20L);
        Major major = new Major();
        major.setId(15L);
        Occupation occupation = new Occupation();
        occupation.setId(20L);
        JobSkill skill = new JobSkill();
        skill.setId(30L);

        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(majorRepository.findByIdAndDeletedAtIsNull(15L)).thenReturn(Optional.of(major));
        when(occupationRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(occupation));
        when(jobSkillRepository.findByJobIdAndDeletedAtIsNullOrderByIdAsc(10L))
                .thenReturn(List.of(skill));

        JobQueryService.JobDetail detail = service.detail(10L).orElseThrow();

        assertEquals(15L, detail.major().getId());
        assertEquals(20L, detail.occupation().getId());
        assertEquals(30L, detail.jobSkills().get(0).getId());
    }

    @Test
    void detailShouldAllowJobWithoutOccupation() {
        Job job = new Job();
        job.setId(10L);
        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(jobSkillRepository.findByJobIdAndDeletedAtIsNullOrderByIdAsc(10L))
                .thenReturn(List.of());

        JobQueryService.JobDetail detail = service.detail(10L).orElseThrow();

        assertNull(detail.major());
        assertNull(detail.occupation());
        assertEquals(List.of(), detail.jobSkills());
    }

    @Test
    void listShouldRejectInvalidPaginationAndOccupationId() {
        assertThrows(IllegalArgumentException.class,
                () -> service.list(-1, 20, JobQueryService.JobSearchCriteria.empty()));
        assertThrows(IllegalArgumentException.class,
                () -> service.list(0, 101, JobQueryService.JobSearchCriteria.empty()));
        assertThrows(IllegalArgumentException.class,
                () -> service.list(0, 20, new JobQueryService.JobSearchCriteria(
                        "", -1L, null, "", "", "", "", "", "", "", "")));
        assertThrows(IllegalArgumentException.class,
                () -> service.list(0, 20, new JobQueryService.JobSearchCriteria(
                        "", null, -1L, "", "", "", "", "", "", "", "")));
    }
}
