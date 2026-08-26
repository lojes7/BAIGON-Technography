// 百工谱 — 规范技能父子层次查询与维护测试
package com.baigon.occupation.service.skill;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillRelation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.skill.SkillRelationGraphWriteLock;
import com.baigon.occupation.repository.skill.SkillRelationRepository;
import com.baigon.occupation.repository.skill.SkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SkillHierarchyServiceTest {

    private SkillRepository skillRepository;
    private SkillRelationRepository relationRepository;
    private SkillRelationGraphWriteLock graphWriteLock;
    private Snowflake snowflake;
    private SkillHierarchyService service;

    @BeforeEach
    void setUp() {
        skillRepository = mock(SkillRepository.class);
        relationRepository = mock(SkillRelationRepository.class);
        graphWriteLock = mock(SkillRelationGraphWriteLock.class);
        snowflake = mock(Snowflake.class);
        service = new SkillHierarchyService(
                skillRepository, relationRepository, graphWriteLock, snowflake);
    }

    @Test
    void getDetailShouldReturnDirectParentAndChildIdsInStableOrder() {
        Skill current = skill(10L, "RAG");
        when(skillRepository.findByIdAndDeletedAtIsNull(10L))
                .thenReturn(Optional.of(current));
        when(relationRepository.findDirectRelations(new TreeSet<>(List.of(10L))))
                .thenReturn(List.of(
                        relation(10L, 50L),
                        relation(30L, 10L),
                        relation(10L, 40L),
                        relation(20L, 10L)));

        SkillHierarchyService.SkillDetail detail = service.getDetail(10L).orElseThrow();

        assertEquals(current, detail.skill());
        assertEquals(List.of(20L, 30L), detail.relations().parentSkillIds());
        assertEquals(List.of(40L, 50L), detail.relations().childSkillIds());
    }

    @Test
    void lookupSkillsShouldDeduplicateIdsAndOnlyReturnRepositoryActiveRows() {
        when(skillRepository.findByIdInAndDeletedAtIsNullOrderByIdAsc(
                new TreeSet<>(List.of(10L, 20L))))
                .thenReturn(List.of(skill(10L, "Java")));

        List<Skill> result = service.lookupSkills(List.of(20L, 10L, 20L));

        assertEquals(List.of(10L), result.stream().map(Skill::getId).toList());
    }

    @Test
    void lookupSkillsShouldRejectMoreThanTwoHundredUniqueIds() {
        List<Long> ids = LongStream.rangeClosed(1, 201).boxed().toList();

        assertThrows(IllegalArgumentException.class, () -> service.lookupSkills(ids));

        verify(skillRepository, never()).findByIdInAndDeletedAtIsNullOrderByIdAsc(any());
    }

    @Test
    void directRelationsShouldUseOneQueryForAllRequestedSkills() {
        Collection<Long> ids = new TreeSet<>(List.of(10L, 20L));
        when(relationRepository.findDirectRelations(ids)).thenReturn(List.of(
                relation(1L, 10L),
                relation(10L, 20L),
                relation(20L, 30L)));

        Map<Long, SkillHierarchyService.DirectRelations> result =
                service.directRelations(List.of(20L, 10L));

        assertEquals(List.of(1L), result.get(10L).parentSkillIds());
        assertEquals(List.of(20L), result.get(10L).childSkillIds());
        assertEquals(List.of(10L), result.get(20L).parentSkillIds());
        assertEquals(List.of(30L), result.get(20L).childSkillIds());
        verify(relationRepository).findDirectRelations(ids);
    }

    @Test
    void addRelationShouldLockBothSkillsInStableOrderAndInsertEdge() {
        when(skillRepository.findActiveByIdsForUpdate(new TreeSet<>(List.of(10L, 20L))))
                .thenReturn(List.of(skill(10L, "子技能"), skill(20L, "父技能")));
        when(relationRepository.hasActivePath(10L, 20L)).thenReturn(false);
        when(snowflake.nextId()).thenReturn(1000L);
        when(relationRepository.insertIfAbsent(1000L, 20L, 10L)).thenReturn(1);

        service.addRelation(20L, 10L);

        verify(relationRepository).insertIfAbsent(1000L, 20L, 10L);
    }

    @Test
    void addRelationShouldAcquireGlobalGraphLockBeforeCycleCheckAndInsert() {
        TreeSet<Long> endpointIds = new TreeSet<>(List.of(10L, 20L));
        when(skillRepository.findActiveByIdsForUpdate(endpointIds))
                .thenReturn(List.of(skill(10L, "子技能"), skill(20L, "父技能")));
        when(relationRepository.hasActivePath(10L, 20L)).thenReturn(false);
        when(snowflake.nextId()).thenReturn(1000L);
        when(relationRepository.insertIfAbsent(1000L, 20L, 10L)).thenReturn(1);

        service.addRelation(20L, 10L);

        InOrder order = inOrder(graphWriteLock, skillRepository, relationRepository);
        order.verify(graphWriteLock).acquire();
        order.verify(skillRepository).findActiveByIdsForUpdate(endpointIds);
        order.verify(relationRepository)
                .existsByParentSkillIdAndChildSkillIdAndDeletedAtIsNull(20L, 10L);
        order.verify(relationRepository).hasActivePath(10L, 20L);
        order.verify(relationRepository).insertIfAbsent(1000L, 20L, 10L);
    }

    @Test
    void addRelationShouldRejectAnIndirectCycle() {
        when(skillRepository.findActiveByIdsForUpdate(new TreeSet<>(List.of(10L, 20L))))
                .thenReturn(List.of(skill(10L, "A"), skill(20L, "B")));
        when(relationRepository.hasActivePath(10L, 20L)).thenReturn(true);

        ApiException exception = assertThrows(ApiException.class,
                () -> service.addRelation(20L, 10L));

        assertEquals(ApiException.ErrorCode.CONFLICT, exception.getErrorCode());
        verify(relationRepository, never()).insertIfAbsent(anyLong(), anyLong(), anyLong());
    }

    @Test
    void addRelationShouldRejectSelfReferenceBeforeLocking() {
        assertThrows(IllegalArgumentException.class,
                () -> service.addRelation(10L, 10L));

        verify(graphWriteLock, never()).acquire();
        verify(skillRepository, never()).findActiveByIdsForUpdate(any());
    }

    @Test
    void addParentsShouldDeduplicateAndInsertEachParentOnce() {
        when(skillRepository.findActiveByIdsForUpdate(new TreeSet<>(List.of(10L, 20L, 30L))))
                .thenReturn(List.of(
                        skill(10L, "子技能"), skill(20L, "父技能一"), skill(30L, "父技能二")));
        when(relationRepository.hasActivePath(10L, 20L)).thenReturn(false);
        when(relationRepository.hasActivePath(10L, 30L)).thenReturn(false);
        when(snowflake.nextId()).thenReturn(1000L, 1001L);
        when(relationRepository.insertIfAbsent(1000L, 20L, 10L)).thenReturn(1);
        when(relationRepository.insertIfAbsent(1001L, 30L, 10L)).thenReturn(1);

        service.addParents(10L, List.of(30L, 20L, 30L));

        verify(relationRepository).insertIfAbsent(1000L, 20L, 10L);
        verify(relationRepository).insertIfAbsent(1001L, 30L, 10L);
    }

    @Test
    void relationMutationShouldRejectMissingActiveEndpoint() {
        when(skillRepository.findActiveByIdsForUpdate(new TreeSet<>(List.of(10L, 20L))))
                .thenReturn(List.of(skill(10L, "仅存在一个端点")));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.addRelation(20L, 10L));

        assertEquals(ApiException.ErrorCode.NOT_FOUND, exception.getErrorCode());
        verify(relationRepository, never()).hasActivePath(anyLong(), anyLong());
    }

    @Test
    void deleteRelationShouldSoftDeleteAfterStableLockAndRemainIdempotent() {
        when(skillRepository.findActiveByIdsForUpdate(new TreeSet<>(List.of(10L, 20L))))
                .thenReturn(List.of(skill(10L, "子技能"), skill(20L, "父技能")));

        service.deleteRelation(20L, 10L);

        verify(relationRepository).softDelete(20L, 10L);
    }

    private Skill skill(long id, String name) {
        Skill skill = new Skill();
        skill.setId(id);
        skill.setName(name);
        return skill;
    }

    private SkillRelation relation(long parentId, long childId) {
        SkillRelation relation = new SkillRelation();
        relation.setParentSkillId(parentId);
        relation.setChildSkillId(childId);
        return relation;
    }
}
