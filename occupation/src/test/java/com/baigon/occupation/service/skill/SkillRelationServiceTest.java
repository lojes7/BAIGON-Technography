// 百工谱 — 职业与专业规范技能聚合关系测试
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.skill.MajorSkillRepository;
import com.baigon.occupation.repository.skill.OccupationSkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillRelationServiceTest {

    private OccupationSkillRepository occupationSkillRepository;
    private MajorSkillRepository majorSkillRepository;
    private MajorRepository majorRepository;
    private Snowflake snowflake;
    private SkillRelationService service;

    @BeforeEach
    void setUp() {
        occupationSkillRepository = mock(OccupationSkillRepository.class);
        majorSkillRepository = mock(MajorSkillRepository.class);
        majorRepository = mock(MajorRepository.class);
        snowflake = mock(Snowflake.class);
        service = new SkillRelationService(
                occupationSkillRepository, majorSkillRepository, majorRepository, snowflake);
    }

    @Test
    void ordinaryMajorShouldWriteBothOccupationAndMajorRelations() {
        Job job = job();
        when(majorRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(major("080902")));
        when(snowflake.nextId()).thenReturn(1001L, 1002L);

        service.link(job, 300L);

        verify(occupationSkillRepository).insertIfAbsent(1001L, 200L, 300L);
        verify(majorSkillRepository).insertIfAbsent(1002L, 201L, 300L);
    }

    @Test
    void otherMajorShouldStillWriteOccupationButSkipMajorRelation() {
        Job job = job();
        when(majorRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(major("999999")));
        when(snowflake.nextId()).thenReturn(1001L);

        service.link(job, 300L);

        verify(occupationSkillRepository).insertIfAbsent(1001L, 200L, 300L);
        verify(majorSkillRepository, never()).insertIfAbsent(anyLong(), anyLong(), anyLong());
    }

    @Test
    void repeatedLinkShouldDelegateIdempotencyToAtomicInsertInterfaces() {
        Job job = job();
        when(majorRepository.findByIdAndDeletedAtIsNull(201L))
                .thenReturn(Optional.of(major("080902")));
        when(snowflake.nextId()).thenReturn(1001L, 1002L, 1003L, 1004L);

        service.link(job, 300L);
        service.link(job, 300L);

        verify(occupationSkillRepository, times(2))
                .insertIfAbsent(anyLong(), org.mockito.ArgumentMatchers.eq(200L),
                        org.mockito.ArgumentMatchers.eq(300L));
        verify(majorSkillRepository, times(2))
                .insertIfAbsent(anyLong(), org.mockito.ArgumentMatchers.eq(201L),
                        org.mockito.ArgumentMatchers.eq(300L));
    }

    private Job job() {
        Job job = new Job();
        job.setOccupationId(200L);
        job.setMajorId(201L);
        return job;
    }

    private Major major(String code) {
        Major major = new Major();
        major.setId(201L);
        major.setCode(code);
        return major;
    }
}
