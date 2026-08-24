// 百工谱 — 技能别名数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.SkillAlias;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface SkillAliasRepository extends JpaRepository<SkillAlias, Long> {

    /** 与活动别名唯一索引保持相同的去首尾空格、忽略大小写语义。 */
    @Query("""
            SELECT alias FROM SkillAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.aliasName)) = LOWER(TRIM(:aliasName))
            """)
    Optional<SkillAlias> findActiveByNormalizedAliasName(@Param("aliasName") String aliasName);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT alias FROM SkillAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.aliasName)) = LOWER(TRIM(:aliasName))
            """)
    Optional<SkillAlias> findActiveByNormalizedAliasNameForUpdate(
            @Param("aliasName") String aliasName);

    /** 空行无法加锁，因此最终仍由数据库唯一索引原子裁决并发别名创建。 */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO skill_aliases (
                id, trace_id, skill_id, alias_name, reviewed_at, reviewed_by
            ) VALUES (
                :id, :traceId, :skillId, :aliasName, :reviewedAt, :reviewedBy
            )
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") long id,
                       @Param("traceId") long traceId,
                       @Param("skillId") long skillId,
                       @Param("aliasName") String aliasName,
                       @Param("reviewedAt") OffsetDateTime reviewedAt,
                       @Param("reviewedBy") long reviewedBy);
}
