// 百工谱 — 岗位技能全局身份解析任务数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.SkillResolutionTaskStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface JobSkillResolutionTaskRepository
        extends JpaRepository<JobSkillResolutionTask, Long> {

    Optional<JobSkillResolutionTask> findByIdAndDeletedAtIsNull(Long id);

    Optional<JobSkillResolutionTask> findByJobSkillIdAndDeletedAtIsNull(Long jobSkillId);

    /** 仅在计算人工审核的 Top 5 相似技能时读取待审技能向量。 */
    @Query(value = """
            SELECT CAST(skill_name_vector AS text)
            FROM job_skill_resolution_tasks
            WHERE id = :id
              AND deleted_at IS NULL
            """, nativeQuery = true)
    Optional<String> findSkillNameVectorLiteralById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT task FROM JobSkillResolutionTask task
            WHERE task.id = :id AND task.deletedAt IS NULL
            """)
    Optional<JobSkillResolutionTask> findByIdForUpdate(@Param("id") Long id);

    Page<JobSkillResolutionTask> findByDeletedAtIsNull(Pageable pageable);

    Page<JobSkillResolutionTask> findByReviewStatusAndDeletedAtIsNull(
            ReviewStatus reviewStatus, Pageable pageable);

    Page<JobSkillResolutionTask> findByTaskStatusAndDeletedAtIsNull(
            SkillResolutionTaskStatus taskStatus, Pageable pageable);

    Page<JobSkillResolutionTask> findByTaskStatusAndReviewStatusAndDeletedAtIsNull(
            SkillResolutionTaskStatus taskStatus, ReviewStatus reviewStatus, Pageable pageable);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_skill_resolution_tasks
            SET task_status = CAST('RUNNING' AS skill_resolution_task_status),
                attempts = attempts + 1,
                error_msg = NULL,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND review_status = CAST('PENDING' AS review_status)
              AND task_status IN (
                  CAST('PENDING' AS skill_resolution_task_status),
                  CAST('FAILED' AS skill_resolution_task_status)
              )
            """, nativeQuery = true)
    int markGenerationStarted(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_skill_resolution_tasks
            SET skill_name_vector = CAST(:vector AS vector),
                model_name = :modelName,
                task_status = CAST('SUCCESS' AS skill_resolution_task_status),
                error_msg = NULL,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND review_status = CAST('PENDING' AS review_status)
              AND task_status = CAST('RUNNING' AS skill_resolution_task_status)
            """, nativeQuery = true)
    int markGenerationSucceeded(@Param("id") Long id,
                                @Param("vector") String vector,
                                @Param("modelName") String modelName);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_skill_resolution_tasks
            SET skill_name_vector = NULL,
                task_status = CAST('FAILED' AS skill_resolution_task_status),
                error_msg = :error,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND review_status = CAST('PENDING' AS review_status)
              AND task_status = CAST('RUNNING' AS skill_resolution_task_status)
            """, nativeQuery = true)
    int markGenerationFailed(@Param("id") Long id, @Param("error") String error);
}
