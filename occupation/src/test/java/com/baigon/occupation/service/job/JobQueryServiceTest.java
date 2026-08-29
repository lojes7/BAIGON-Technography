// 百工谱 — 已审核岗位分页筛选与聚合详情测试
package com.baigon.occupation.service.job;

import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobQueryServiceTest {

    private JobRepository jobRepository;
    private JobSkillRepository jobSkillRepository;
    private JobQueryService service;

    @BeforeEach
    void setUp() {
        jobRepository = mock(JobRepository.class);
        jobSkillRepository = mock(JobSkillRepository.class);
        service = new JobQueryService(jobRepository, jobSkillRepository);
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
    void detailShouldReturnOnlyJobBodyAndJobSkillIds() {
        Job job = new Job();
        job.setId(10L);
        job.setMajorId(15L);
        job.setOccupationId(20L);
        JobSkill skill = new JobSkill();
        skill.setId(30L);
        skill.setSkillId(300L);

        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(jobSkillRepository.findByJobIdAndDeletedAtIsNullOrderByIdAsc(10L))
                .thenReturn(List.of(skill));
        JobQueryService.JobDetail detail = service.detail(10L).orElseThrow();

        assertEquals(job, detail.job());
        assertEquals(List.of(30L), detail.jobSkillIds());
    }

    @Test
    void detailShouldAllowJobWithoutJobSkills() {
        Job job = new Job();
        job.setId(10L);
        when(jobRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(job));
        when(jobSkillRepository.findByJobIdAndDeletedAtIsNullOrderByIdAsc(10L))
                .thenReturn(List.of());

        JobQueryService.JobDetail detail = service.detail(10L).orElseThrow();

        assertEquals(job, detail.job());
        assertEquals(List.of(), detail.jobSkillIds());
    }

    @Test
    void lookupJobsShouldUseTwoQueriesAndKeepFirstRequestOrder() {
        Job first = job(10L);
        Job third = job(30L);
        JobSkill firstSkill = jobSkill(101L, 10L);
        JobSkill thirdSkill = jobSkill(301L, 30L);
        Collection<Long> normalized = new LinkedHashSet<>(List.of(30L, 99L, 10L));
        when(jobRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(normalized))
                .thenReturn(List.of(first, third));
        when(jobSkillRepository.findByJobIdInAndDeletedAtIsNullOrderByJobIdAscIdAsc(
                List.of(10L, 30L))).thenReturn(List.of(firstSkill, thirdSkill));

        JobQueryService.JobLookup lookup = service.lookupJobs(List.of(30L, 99L, 10L, 30L));

        assertEquals(List.of(30L, 10L), lookup.items().stream()
                .map(item -> item.job().getId()).toList());
        assertEquals(List.of(301L), lookup.items().get(0).jobSkillIds());
        assertEquals(List.of(101L), lookup.items().get(1).jobSkillIds());
        assertEquals(List.of(99L), lookup.missingIds());
        verify(jobRepository).findByIdInAndDeletedAtIsNullOrderByIdAsc(normalized);
        verify(jobSkillRepository).findByJobIdInAndDeletedAtIsNullOrderByJobIdAscIdAsc(
                List.of(10L, 30L));
    }

    @Test
    void lookupJobSkillsShouldKeepFirstRequestOrderAndReportMissingIds() {
        JobSkill first = jobSkill(10L, 100L);
        JobSkill third = jobSkill(30L, 300L);
        Collection<Long> normalized = new LinkedHashSet<>(List.of(30L, 99L, 10L));
        when(jobSkillRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(normalized))
                .thenReturn(List.of(first, third));

        JobQueryService.JobSkillLookup lookup =
                service.lookupJobSkills(List.of(30L, 99L, 10L, 30L));

        assertEquals(List.of(30L, 10L), lookup.items().stream().map(JobSkill::getId).toList());
        assertEquals(List.of(99L), lookup.missingIds());
    }

    @Test
    void lookupShouldRejectRawBatchOverTwoHundredBeforeDeduplication() {
        assertThrows(IllegalArgumentException.class,
                () -> service.lookupJobs(Collections.nCopies(201, 10L)));
        verify(jobRepository, never()).findByIdInAndDeletedAtIsNullOrderByIdAsc(any());
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

    private Job job(long id) {
        Job job = new Job();
        job.setId(id);
        return job;
    }

    private JobSkill jobSkill(long id, long jobId) {
        JobSkill skill = new JobSkill();
        skill.setId(id);
        skill.setJobId(jobId);
        return skill;
    }
}
