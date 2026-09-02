// 百工谱 — PostgreSQL 技能关系图事务锁测试
package com.baigon.occupation.repository.skill;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PostgresSkillRelationGraphWriteLockTest {

    @Test
    void acquireShouldExecuteFixedTransactionAdvisoryLock() {
        EntityManager entityManager = mock(EntityManager.class);
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(PostgresSkillRelationGraphWriteLock.ACQUIRE_SQL))
                .thenReturn(query);
        when(query.setParameter(
                "lockKey", PostgresSkillRelationGraphWriteLock.GRAPH_WRITE_LOCK_KEY))
                .thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());
        PostgresSkillRelationGraphWriteLock lock =
                new PostgresSkillRelationGraphWriteLock(entityManager);

        lock.acquire();

        var order = inOrder(entityManager, query);
        order.verify(entityManager).createNativeQuery(
                PostgresSkillRelationGraphWriteLock.ACQUIRE_SQL);
        order.verify(query).setParameter(
                "lockKey", PostgresSkillRelationGraphWriteLock.GRAPH_WRITE_LOCK_KEY);
        order.verify(query).getResultList();
    }
}
