// 百工谱 — 规范技能父子关系数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.SkillRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

public interface SkillRelationRepository extends JpaRepository<SkillRelation, Long> {

    /** 一次读取所有目标技能的一跳父子边，避免岗位技能逐条查询。 */
    @Query("""
            SELECT relation
            FROM SkillRelation relation, Skill parentSkill, Skill childSkill
            WHERE relation.deletedAt IS NULL
              AND parentSkill.id = relation.parentSkillId
              AND parentSkill.deletedAt IS NULL
              AND childSkill.id = relation.childSkillId
              AND childSkill.deletedAt IS NULL
              AND (relation.parentSkillId IN :skillIds OR relation.childSkillId IN :skillIds)
            ORDER BY relation.parentSkillId ASC, relation.childSkillId ASC
            """)
    List<SkillRelation> findDirectRelations(@Param("skillIds") Collection<Long> skillIds);

    boolean existsByParentSkillIdAndChildSkillIdAndDeletedAtIsNull(
            Long parentSkillId, Long childSkillId);

    /**
     * 判断 startSkillId 是否能沿活动父子边到达 targetSkillId。
     * 使用 UNION 去重，即使历史脏数据存在环也不会无限递归。
     */
    @Query(value = """
            WITH RECURSIVE reachable(skill_id) AS (
                SELECT relation.child_skill_id
                FROM skill_relations relation
                JOIN skills child_skill ON child_skill.id = relation.child_skill_id
                WHERE relation.parent_skill_id = :startSkillId
                  AND relation.deleted_at IS NULL
                  AND child_skill.deleted_at IS NULL
                UNION
                SELECT relation.child_skill_id
                FROM skill_relations relation
                JOIN reachable current
                  ON relation.parent_skill_id = current.skill_id
                JOIN skills child_skill ON child_skill.id = relation.child_skill_id
                WHERE relation.deleted_at IS NULL
                  AND child_skill.deleted_at IS NULL
            )
            SELECT EXISTS (
                SELECT 1 FROM reachable WHERE skill_id = :targetSkillId
            )
            """, nativeQuery = true)
    boolean hasActivePath(@Param("startSkillId") long startSkillId,
                          @Param("targetSkillId") long targetSkillId);

    /** 活动 pair 的部分唯一索引负责并发幂等裁决。 */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO skill_relations (id, parent_skill_id, child_skill_id)
            VALUES (:id, :parentSkillId, :childSkillId)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") long id,
                       @Param("parentSkillId") long parentSkillId,
                       @Param("childSkillId") long childSkillId);

    /** 删除采用软删除；重复删除保持幂等。 */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE skill_relations
            SET deleted_at = now(),
                updated_at = now()
            WHERE parent_skill_id = :parentSkillId
              AND child_skill_id = :childSkillId
              AND deleted_at IS NULL
            """, nativeQuery = true)
    int softDelete(@Param("parentSkillId") long parentSkillId,
                   @Param("childSkillId") long childSkillId);
}
