// 百工谱 — 全局规范技能数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.skill.Skill;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    @Query("""
            SELECT skill FROM Skill skill
            WHERE skill.deletedAt IS NULL
              AND (:keyword = '' OR LOWER(skill.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Skill> search(@Param("keyword") String keyword, Pageable pageable);

    Optional<Skill> findByIdAndDeletedAtIsNull(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT skill FROM Skill skill WHERE skill.id = :id AND skill.deletedAt IS NULL")
    Optional<Skill> findByIdForUpdate(@Param("id") Long id);

    /** 按数据库唯一索引使用的同一规则查询规范技能名。 */
    @Query("""
            SELECT skill FROM Skill skill
            WHERE skill.deletedAt IS NULL
              AND LOWER(TRIM(skill.name)) = LOWER(TRIM(:name))
            """)
    Optional<Skill> findActiveByNormalizedName(@Param("name") String name);

    List<Skill> findByDeletedAtIsNullAndEmbeddingStatusNotOrderByIdAsc(TaskStatus status);

    long countByDeletedAtIsNull();

    long countByDeletedAtIsNullAndEmbeddingStatus(TaskStatus status);

    /** 使用 pgvector 余弦距离返回已向量化的 Top N 规范技能。 */
    @Query(value = """
            SELECT id AS id,
                   name AS name,
                   1 - (name_vector <=> CAST(:vector AS vector)) AS similarity
            FROM skills
            WHERE deleted_at IS NULL
              AND name_vector IS NOT NULL
              AND embedding_status = CAST('SUCCESS' AS task_status)
            ORDER BY name_vector <=> CAST(:vector AS vector), id
            LIMIT :limit
            """, nativeQuery = true)
    List<SkillCandidateProjection> findNearestByNameVector(
            @Param("vector") String vector,
            @Param("limit") int limit);

    /** 并发创建时由规范化唯一索引裁决；返回 0 表示名称或主键已经存在。 */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO skills (id, name)
            VALUES (:id, :name)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertPendingIfAbsent(@Param("id") long id, @Param("name") String name);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE skills
            SET embedding_status = CAST('PENDING' AS task_status),
                embedding_attempts = embedding_attempts + 1,
                embedding_next_retry_at = now() + interval '10 minutes',
                embedding_error = NULL,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND embedding_status IN (
                  CAST('PENDING' AS task_status), CAST('FAILED' AS task_status)
              )
              AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())
            """, nativeQuery = true)
    int markEmbeddingStarted(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE skills
            SET name_vector = CAST(:vector AS vector),
                embedding_status = CAST('SUCCESS' AS task_status),
                embedding_next_retry_at = NULL,
                embedding_error = NULL,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND embedding_status = CAST('PENDING' AS task_status)
            """, nativeQuery = true)
    int markEmbeddingSucceeded(@Param("id") Long id, @Param("vector") String vector);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE skills
            SET name_vector = NULL,
                embedding_status = CAST('FAILED' AS task_status),
                embedding_next_retry_at = :nextRetryAt,
                embedding_error = :error,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND embedding_status = CAST('PENDING' AS task_status)
            """, nativeQuery = true)
    int markEmbeddingFailed(@Param("id") Long id,
                            @Param("error") String error,
                            @Param("nextRetryAt") OffsetDateTime nextRetryAt);
}
