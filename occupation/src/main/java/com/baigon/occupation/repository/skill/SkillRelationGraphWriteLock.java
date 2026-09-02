// 百工谱 — 技能关系图写入串行化契约
package com.baigon.occupation.repository.skill;

/**
 * 为整个技能关系图获取当前事务持有的写锁。
 * 抽象此契约便于业务单测使用 Mockito，避免测试数据库必须实现 PostgreSQL advisory lock。
 */
public interface SkillRelationGraphWriteLock {

    void acquire();
}
