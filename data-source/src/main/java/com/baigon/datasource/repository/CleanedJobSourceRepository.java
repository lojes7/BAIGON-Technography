// 百工谱 — 清洗后岗位数据访问层

package com.baigon.datasource.repository;

import com.baigon.datasource.entity.CleanedJobSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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

    // ==================== 动态筛选（复核状态 + 发布时间范围，均可选） ====================

    Page<CleanedJobSource> findByReviewStatus(CleanedJobSource.ReviewStatus reviewStatus, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateGreaterThanEqual(
            CleanedJobSource.ReviewStatus reviewStatus, OffsetDateTime from, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateLessThanEqual(
            CleanedJobSource.ReviewStatus reviewStatus, OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByReviewStatusAndPublishDateBetween(
            CleanedJobSource.ReviewStatus reviewStatus, OffsetDateTime from, OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateGreaterThanEqual(OffsetDateTime from, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateLessThanEqual(OffsetDateTime to, Pageable pageable);

    Page<CleanedJobSource> findByPublishDateBetween(OffsetDateTime from, OffsetDateTime to, Pageable pageable);
}
