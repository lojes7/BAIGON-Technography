// 百工谱 — 清洗后岗位数据访问层

package com.baigon.datasource.repository;

import com.baigon.datasource.entity.CleanedJobSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CleanedJobSourceRepository extends JpaRepository<CleanedJobSource, Long> {

    /** 按 trace_id 查询未删除的清洗数据（软删除过滤） */
    @Query("SELECT c FROM CleanedJobSource c WHERE c.traceId = :traceId AND c.deletedAt IS NULL")
    Optional<CleanedJobSource> findByTraceId(@Param("traceId") Long traceId);
}
