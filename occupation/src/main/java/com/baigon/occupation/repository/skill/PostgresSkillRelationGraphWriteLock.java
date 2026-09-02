// 百工谱 — PostgreSQL 技能关系图事务级写锁
package com.baigon.occupation.repository.skill;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class PostgresSkillRelationGraphWriteLock implements SkillRelationGraphWriteLock {

    /** ASCII "SKILLGRP" 对应的固定正 bigint，仅在当前数据库内作为关系图锁命名空间。 */
    static final long GRAPH_WRITE_LOCK_KEY = 0x534B_494C_4C47_5250L;
    static final String ACQUIRE_SQL = "SELECT pg_advisory_xact_lock(:lockKey)";

    private final EntityManager entityManager;

    public PostgresSkillRelationGraphWriteLock(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** advisory_xact_lock 会在外层事务提交或回滚时由 PostgreSQL 自动释放。 */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void acquire() {
        entityManager.createNativeQuery(ACQUIRE_SQL)
                .setParameter("lockKey", GRAPH_WRITE_LOCK_KEY)
                .getResultList();
    }
}
