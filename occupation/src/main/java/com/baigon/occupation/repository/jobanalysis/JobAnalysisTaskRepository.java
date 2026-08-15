// 百工谱 — 岗位分析任务数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
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

public interface JobAnalysisTaskRepository extends JpaRepository<JobAnalysisTask, Long> {

    Optional<JobAnalysisTask> findByJobIdAndDeletedAtIsNull(Long jobId);

    Optional<JobAnalysisTask> findByIdAndDeletedAtIsNull(Long id);

    Page<JobAnalysisTask> findByDeletedAtIsNull(Pageable pageable);

    Page<JobAnalysisTask> findByReviewStatusAndDeletedAtIsNull(
            ReviewStatus reviewStatus, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT task FROM JobAnalysisTask task WHERE task.id = :id AND task.deletedAt IS NULL")
    Optional<JobAnalysisTask> findByIdForReview(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET task_status = CAST('PENDING' AS task_status),
                attempts = attempts + 1,
                error_msg = NULL,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markAnalysisStarted(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET job_name_vector = CAST(:vector AS vector),
                model_name = :modelName,
                occupation_analysis_status = CAST('SUCCESS' AS task_status),
                error_msg = NULL,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markOccupationAnalysisSucceeded(@Param("id") Long id,
                                        @Param("vector") String vector,
                                        @Param("modelName") String modelName);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET jd_analysis_status = CAST('SUCCESS' AS task_status),
                task_status = CAST('SUCCESS' AS task_status),
                error_msg = NULL,
                updated_at = now()
            WHERE id = :id
              AND deleted_at IS NULL
              AND occupation_analysis_status = CAST('SUCCESS' AS task_status)
            """, nativeQuery = true)
    int markJdAnalysisSucceeded(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET occupation_analysis_status = CAST('FAILED' AS task_status),
                task_status = CAST('FAILED' AS task_status),
                error_msg = :error,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markOccupationAnalysisFailed(@Param("id") Long id, @Param("error") String error);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET jd_analysis_status = CAST('FAILED' AS task_status),
                task_status = CAST('FAILED' AS task_status),
                error_msg = :error,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markJdAnalysisFailed(@Param("id") Long id, @Param("error") String error);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE job_analysis_tasks
            SET task_status = CAST('FAILED' AS task_status),
                error_msg = :error,
                updated_at = now()
            WHERE id = :id AND deleted_at IS NULL
            """, nativeQuery = true)
    int markAnalysisFailed(@Param("id") Long id, @Param("error") String error);
}
