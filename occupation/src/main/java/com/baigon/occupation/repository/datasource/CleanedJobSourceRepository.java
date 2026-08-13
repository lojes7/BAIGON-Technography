// 百工谱 — 清洗后岗位数据访问层

package com.baigon.occupation.repository.datasource;

import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.entity.ReviewStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface CleanedJobSourceRepository extends JpaRepository<CleanedJobSource, Long> {

    /** 按 trace_id 查询未删除的清洗数据（软删除过滤） */
    @Query("SELECT c FROM CleanedJobSource c WHERE c.traceId = :traceId AND c.deletedAt IS NULL")
    Optional<CleanedJobSource> findByTraceId(@Param("traceId") Long traceId);

    /** 按主键查询未删除的清洗数据（软删除过滤） */
    @Query("SELECT c FROM CleanedJobSource c WHERE c.id = :id AND c.deletedAt IS NULL")
    Optional<CleanedJobSource> findByIdNotDeleted(@Param("id") Long id);

    /** 审核专用查询：锁定目标行，直到审核事务提交或回滚。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CleanedJobSource c WHERE c.id = :id AND c.deletedAt IS NULL")
    Optional<CleanedJobSource> findByIdForReview(@Param("id") Long id);

    // ==================== 动态筛选（复核状态 + 发布时间范围，均可选） ====================

    Page<CleanedJobSource> findByReviewStatus(ReviewStatus reviewStatus, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateGreaterThanEqual(
            ReviewStatus reviewStatus, OffsetDateTime from, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateLessThanEqual(
            ReviewStatus reviewStatus, OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateBetween(
            ReviewStatus reviewStatus, OffsetDateTime from, OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateGreaterThanEqual(OffsetDateTime from, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateLessThanEqual(OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateBetween(OffsetDateTime from, OffsetDateTime to, Pageable pageable);
}
