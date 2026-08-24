// 百工谱 — 岗位技能三动作人工归一测试
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillAlias;
import com.baigon.occupation.entity.skill.SkillResolutionAction;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.job.JobRepository;
import com.baigon.occupation.repository.job.JobSkillRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionCandidateRepository;
import com.baigon.occupation.repository.skill.JobSkillResolutionTaskRepository;
import com.baigon.occupation.repository.skill.SkillAliasRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillResolutionReviewServiceTest {

    private JobSkillResolutionTaskRepository taskRepository;
    private JobSkillResolutionCandidateRepository candidateRepository;
    private JobSkillRepository jobSkillRepository;
    private JobRepository jobRepository;
    private SkillRepository skillRepository;
    private SkillAliasRepository aliasRepository;
    private SkillRelationService relationService;
    private SkillEmbeddingService embeddingService;
    private Snowflake snowflake;
    private SkillResolutionReviewService service;

    @BeforeEach
    void setUp() {
        taskRepository = mock(JobSkillResolutionTaskRepository.class);
        candidateRepository = mock(JobSkillResolutionCandidateRepository.class);
        jobSkillRepository = mock(JobSkillRepository.class);
        jobRepository = mock(JobRepository.class);
        skillRepository = mock(SkillRepository.class);
        aliasRepository = mock(SkillAliasRepository.class);
        relationService = mock(SkillRelationService.class);
        embeddingService = mock(SkillEmbeddingService.class);
        snowflake = mock(Snowflake.class);
        service = new SkillResolutionReviewService(
                taskRepository, candidateRepository, jobSkillRepository, jobRepository,
                skillRepository, aliasRepository, relationService, embeddingService,
                mock(LogService.class), snowflake);
        when(aliasRepository.insertIfAbsent(
                anyLong(), anyLong(), anyLong(), anyString(), any(), anyLong()))
                .thenReturn(1);
    }

    @Test
    void reviewerCanSelectCandidateAndResolveAllRelations() {
        JobSkillResolutionTask task = arrangeTask(SkillResolutionTaskStatus.SUCCESS);
        Skill skill = skill(300L, "检索增强生成");
        when(candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(10L, 300L))
                .thenReturn(true);
        when(skillRepository.findByIdForUpdate(300L)).thenReturn(Optional.of(skill));

        JobSkillResolutionTask reviewed = service.review(
                10L, SkillResolutionAction.SELECT_CANDIDATE, 300L, "", audit())
                .orElseThrow();

        assertEquals(300L, jobSkill().getSkillId());
        assertEquals(ReviewStatus.PASSED, reviewed.getReviewStatus());
        assertEquals(SkillResolutionAction.SELECT_CANDIDATE, reviewed.getResolutionAction());
        assertEquals(300L, reviewed.getSelectedSkillId());
        verify(relationService).link(job(), 300L);
        verify(embeddingService, never()).submitAfterCommit(anyLong(), any());
    }

    @Test
    void reviewerCanSelectExistingOnlyWhenItIsOutsideCandidates() {
        arrangeTask(SkillResolutionTaskStatus.FAILED);
        Skill skill = skill(301L, "RAG");
        when(candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(10L, 301L))
                .thenReturn(false);
        when(skillRepository.findByIdForUpdate(301L)).thenReturn(Optional.of(skill));

        service.review(10L, SkillResolutionAction.SELECT_EXISTING, 301L, null, audit())
                .orElseThrow();

        assertEquals(301L, jobSkill().getSkillId());
        verify(relationService).link(job(), 301L);
    }

    @Test
    void selectExistingRejectsCandidateToKeepActionsUnambiguous() {
        arrangeTask(SkillResolutionTaskStatus.SUCCESS);
        when(candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(10L, 300L))
                .thenReturn(true);

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                10L, SkillResolutionAction.SELECT_EXISTING, 300L, null, audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
        verify(skillRepository, never()).findByIdForUpdate(anyLong());
    }

    @Test
    void reviewerCanCreateNewSkillAndScheduleIndependentEmbedding() {
        arrangeTask(SkillResolutionTaskStatus.SUCCESS);
        when(snowflake.nextId()).thenReturn(500L, 501L, 502L);
        when(skillRepository.insertPendingIfAbsent(500L, "大模型检索")).thenReturn(1);
        Skill created = skill(500L, "大模型检索");
        when(skillRepository.findByIdForUpdate(500L)).thenReturn(Optional.of(created));

        service.review(10L, SkillResolutionAction.CREATE_NEW, null,
                "  大模型检索  ", audit()).orElseThrow();

        verify(skillRepository).insertPendingIfAbsent(500L, "大模型检索");
        verify(embeddingService).submitAfterCommit(500L, audit());
        assertEquals(500L, jobSkill().getSkillId());
        verify(relationService).link(job(), 500L);
    }

    @Test
    void pendingTaskCannotBeReviewed() {
        arrangeTask(SkillResolutionTaskStatus.RUNNING);

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                10L, SkillResolutionAction.CREATE_NEW, null, "RAG", audit()));

        assertEquals(ApiException.ErrorCode.BAD_REQUEST, exception.getErrorCode());
        verify(jobSkillRepository, never()).findByIdForUpdate(anyLong());
    }

    @Test
    void aliasMappedToAnotherSkillReturnsConflictWithoutPartialResolution() {
        arrangeTask(SkillResolutionTaskStatus.SUCCESS);
        Skill selected = skill(300L, "检索增强生成");
        when(candidateRepository.existsByTaskIdAndSkillIdAndDeletedAtIsNull(10L, 300L))
                .thenReturn(true);
        when(skillRepository.findByIdForUpdate(300L)).thenReturn(Optional.of(selected));
        when(aliasRepository.insertIfAbsent(
                anyLong(), anyLong(), anyLong(), anyString(), any(), anyLong()))
                .thenReturn(0);
        SkillAlias conflict = new SkillAlias();
        conflict.setSkillId(999L);
        when(aliasRepository.findActiveByNormalizedAliasName("检索增强生成"))
                .thenReturn(Optional.of(conflict));

        ApiException exception = assertThrows(ApiException.class, () -> service.review(
                10L, SkillResolutionAction.SELECT_CANDIDATE, 300L, null, audit()));

        assertEquals(ApiException.ErrorCode.CONFLICT, exception.getErrorCode());
        verify(relationService, never()).link(any(), anyLong());
    }

    private JobSkillResolutionTask arrangeTask(SkillResolutionTaskStatus status) {
        JobSkillResolutionTask task = new JobSkillResolutionTask();
        task.setId(10L);
        task.setTraceId(1001L);
        task.setJobSkillId(100L);
        task.setSkillName("RAG");
        task.setTaskStatus(status);
        task.setReviewStatus(ReviewStatus.PENDING);
        JobSkill jobSkill = newJobSkill();
        Job job = newJob();
        when(taskRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(task));
        when(jobSkillRepository.findByIdForUpdate(100L)).thenReturn(Optional.of(jobSkill));
        when(jobRepository.findByIdAndDeletedAtIsNull(200L)).thenReturn(Optional.of(job));
        return task;
    }

    private JobSkill jobSkill() {
        // Mock 始终返回同一个引用，便于直接断言回填结果。
        return jobSkillRepository.findByIdForUpdate(100L).orElseThrow();
    }

    private Job job() {
        return jobRepository.findByIdAndDeletedAtIsNull(200L).orElseThrow();
    }

    private JobSkill newJobSkill() {
        JobSkill item = new JobSkill();
        item.setId(100L);
        item.setJobId(200L);
        item.setSkillName("RAG");
        return item;
    }

    private Job newJob() {
        Job item = new Job();
        item.setId(200L);
        item.setOccupationId(20L);
        item.setMajorId(30L);
        return item;
    }

    private Skill skill(long id, String name) {
        Skill item = new Skill();
        item.setId(id);
        item.setName(name);
        return item;
    }

    private AuditContext audit() {
        return new AuditContext(1001L, 7L, "reviewer", "127.0.0.1",
                "PUT", "/job-skill-resolution/10/review");
    }
}
