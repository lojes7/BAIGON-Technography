// 百工谱 — 职业数据访问层
package com.baigon.occupation.repository.occupation;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.occupation.Occupation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OccupationRepository extends JpaRepository<Occupation, Long> {

    @Query("""
            SELECT item FROM Occupation item
            WHERE item.deletedAt IS NULL
              AND item.occupationCategoryId = :parentId
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Occupation> search(@Param("parentId") long parentId,
                            @Param("keyword") String keyword,
                            Pageable pageable);

    List<Occupation> findByDeletedAtIsNullAndEmbeddingStatusNotOrderByIdAsc(TaskStatus status);

    long countByDeletedAtIsNull();

    long countByDeletedAtIsNullAndEmbeddingStatus(TaskStatus status);

    Optional<Occupation> findByIdAndDeletedAtIsNull(Long id);

    /** 使用 pgvector 余弦距离返回相似度最高的 Top N 职业。 */
    @Query(value = """
            SELECT id AS id,
                   name AS name,
                   1 - (name_vector <=> CAST(:vector AS vector)) AS similarity
            FROM occupations
            WHERE deleted_at IS NULL
              AND name_vector IS NOT NULL
              AND embedding_status = CAST('SUCCESS' AS task_status)
            ORDER BY name_vector <=> CAST(:vector AS vector), id
            LIMIT :limit
            """, nativeQuery = true)
    List<OccupationCandidateProjection> findNearestByNameVector(
            @Param("vector") String vector,
            @Param("limit") int limit);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE occupations
            SET embedding_status = CAST('PENDING' AS task_status),
                embedding_attempts = embedding_attempts + 1,
                embedding_next_retry_at = NULL,
                embedding_error = NULL,
                updated_at = now()
            WHERE id IN (:ids) AND deleted_at IS NULL
            """, nativeQuery = true)
    int markAttemptStarted(@Param("ids") Collection<Long> ids);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE occupations
            SET name_vector = CAST(:vector AS vector),
                embedding_status = CAST('SUCCESS' AS task_status),
                embedding_next_retry_at = NULL,
                embedding_error = NULL,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markSuccess(@Param("id") long id, @Param("vector") String vector);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE occupations
            SET name_vector = NULL,
                embedding_status = CAST('FAILED' AS task_status),
                embedding_next_retry_at = NULL,
                embedding_error = :error,
                updated_at = now()
            WHERE id IN (:ids) AND deleted_at IS NULL
            """, nativeQuery = true)
    int markFailed(@Param("ids") Collection<Long> ids, @Param("error") String error);
}
