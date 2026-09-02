// 百工谱 — 专业数据访问层
package com.baigon.occupation.repository.major;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.major.Major;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MajorRepository extends JpaRepository<Major, Long> {

    @Query("""
            SELECT item FROM Major item
            WHERE item.deletedAt IS NULL
              AND item.majorCategoryId = :parentId
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Major> search(@Param("parentId") long parentId,
                       @Param("keyword") String keyword,
                       Pageable pageable);

    /** 图谱范围选择允许跨专业类搜索全部专业。 */
    @Query("""
            SELECT item FROM Major item
            WHERE item.deletedAt IS NULL
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Major> searchAll(@Param("keyword") String keyword, Pageable pageable);

    List<Major> findByDeletedAtIsNullAndEmbeddingStatusNotOrderByIdAsc(TaskStatus status);

    long countByDeletedAtIsNull();

    long countByDeletedAtIsNullAndEmbeddingStatus(TaskStatus status);

    Optional<Major> findByIdAndDeletedAtIsNull(Long id);

    List<Major> findByIdInAndDeletedAtIsNull(Collection<Long> ids);

    List<Major> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    Optional<Major> findByCodeAndDeletedAtIsNull(String code);

    /** 使用 pgvector 余弦距离返回相似度最高的 Top N 专业。 */
    @Query(value = """
            SELECT id AS id,
                   name AS name,
                   1 - (name_vector <=> CAST(:vector AS vector)) AS similarity
            FROM majors
            WHERE deleted_at IS NULL
              AND name_vector IS NOT NULL
              AND embedding_status = CAST('SUCCESS' AS task_status)
            ORDER BY name_vector <=> CAST(:vector AS vector), id
            LIMIT :limit
            """, nativeQuery = true)
    List<MajorCandidateProjection> findNearestByNameVector(
            @Param("vector") String vector,
            @Param("limit") int limit);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE majors
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
            UPDATE majors
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
            UPDATE majors
            SET name_vector = NULL,
                embedding_status = CAST('FAILED' AS task_status),
                embedding_next_retry_at = NULL,
                embedding_error = :error,
                updated_at = now()
            WHERE id IN (:ids) AND deleted_at IS NULL
            """, nativeQuery = true)
    int markFailed(@Param("ids") Collection<Long> ids, @Param("error") String error);
}
