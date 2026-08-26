// 百工谱 — 岗位技能全局身份判定测试
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillAlias;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillAliasRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobSkillIdentityServiceTest {

    private JobSkillRepository jobSkillRepository;
    private SkillAliasRepository aliasRepository;
    private SkillRepository skillRepository;
    private JobSkillResolutionTaskRepository taskRepository;
    private SkillRelationService relationService;
    private SkillResolutionAnalysisService analysisService;
    private Snowflake snowflake;
    private JobSkillIdentityService service;

    @BeforeEach
    void setUp() {
        jobSkillRepository = mock(JobSkillRepository.class);
        aliasRepository = mock(SkillAliasRepository.class);
        skillRepository = mock(SkillRepository.class);
        taskRepository = mock(JobSkillResolutionTaskRepository.class);
        relationService = mock(SkillRelationService.class);
        analysisService = mock(SkillResolutionAnalysisService.class);
        snowflake = mock(Snowflake.class);
        service = new JobSkillIdentityService(
                jobSkillRepository,
                aliasRepository,
                skillRepository,
                taskRepository,
                relationService,
                analysisService,
                snowflake);
    }

    @Test
    void aliasHitShouldAssignSkillAndRelationsWithoutCreatingResolutionTask() {
        Job job = job();
        JobSkill jobSkill = jobSkill("  JAVA  ");
        SkillAlias alias = new SkillAlias();
        alias.setAliasName("java");
        alias.setSkillId(300L);
        Skill skill = new Skill();
        skill.setId(300L);
        skill.setName("Java");
        when(aliasRepository.findActiveByNormalizedAliasName("JAVA"))
                .thenReturn(Optional.of(alias));
        when(skillRepository.findByIdAndDeletedAtIsNull(300L))
                .thenReturn(Optional.of(skill));

        service.saveAndResolve(job, jobSkill, 9001L, audit(), OffsetDateTime.now());

        assertEquals("JAVA", jobSkill.getSkillName());
        assertEquals(300L, jobSkill.getSkillId());
        verify(jobSkillRepository).save(jobSkill);
        verify(relationService).link(job, 300L);
        verify(taskRepository, never()).save(any(JobSkillResolutionTask.class));
        verify(analysisService, never()).submitAfterCommit(any(), any(AuditContext.class));
    }

    @Test
    void aliasMissShouldCreatePendingTaskAndScheduleAnalysisAfterCommit() {
        Job job = job();
        JobSkill jobSkill = jobSkill("  检索增强生成  ");
        OffsetDateTime now = OffsetDateTime.parse("2026-08-24T18:00:00+08:00");
        AuditContext audit = audit();
        when(aliasRepository.findActiveByNormalizedAliasName("检索增强生成"))
                .thenReturn(Optional.empty());
        when(snowflake.nextId()).thenReturn(7001L);

        service.saveAndResolve(job, jobSkill, 9001L, audit, now);

        assertEquals("检索增强生成", jobSkill.getSkillName());
        assertNull(jobSkill.getSkillId());
        ArgumentCaptor<JobSkillResolutionTask> taskCaptor =
                ArgumentCaptor.forClass(JobSkillResolutionTask.class);
        InOrder order = inOrder(jobSkillRepository, taskRepository, analysisService);
        order.verify(jobSkillRepository).save(jobSkill);
        order.verify(taskRepository).save(taskCaptor.capture());
        order.verify(analysisService).submitAfterCommit(
                eq(7001L), eq(audit.withTraceId(9001L)));

        JobSkillResolutionTask task = taskCaptor.getValue();
        assertEquals(7001L, task.getId());
        assertEquals(9001L, task.getTraceId());
        assertEquals(jobSkill.getId(), task.getJobSkillId());
        assertEquals("检索增强生成", task.getSkillName());
        assertEquals(SkillResolutionTaskStatus.PENDING, task.getTaskStatus());
        assertEquals(ReviewStatus.PENDING, task.getReviewStatus());
        assertEquals(0, task.getAttempts());
        assertEquals(now, task.getCreatedAt());
        assertEquals(now, task.getUpdatedAt());
        verify(relationService, never()).link(any(Job.class), anyLong());
    }

    private Job job() {
        Job job = new Job();
        job.setId(100L);
        job.setOccupationId(200L);
        job.setMajorId(201L);
        return job;
    }

    private JobSkill jobSkill(String name) {
        JobSkill skill = new JobSkill();
        skill.setId(500L);
        skill.setJobId(100L);
        skill.setSkillName(name);
        return skill;
    }

    private AuditContext audit() {
        return new AuditContext(8001L, 7L, "reviewer", "127.0.0.1",
                "POST", "/api/auth/job-analysis/20/review");
    }
}
