// 百工谱 — 职业技能归属关系数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.OccupationSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface OccupationSkillRepository extends JpaRepository<OccupationSkill, Long> {

    /** 部分唯一索引下省略冲突目标，保证关系写入原子且可幂等重放。 */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO occupation_skills (id, occupation_id, skill_id)
            VALUES (:id, :occupationId, :skillId)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") long id,
                       @Param("occupationId") long occupationId,
                       @Param("skillId") long skillId);
}
