// 百工谱 — 专业技能归属关系数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.MajorSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface MajorSkillRepository extends JpaRepository<MajorSkill, Long> {

    /** “其他”专业是否跳过由业务层决定；这里仅提供通用幂等关系写入。 */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO major_skills (id, major_id, skill_id)
            VALUES (:id, :majorId, :skillId)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") long id,
                       @Param("majorId") long majorId,
                       @Param("skillId") long skillId);
}
