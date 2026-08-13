// 百工谱 — 已审核岗位数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.Job;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long> {

    Optional<Job> findByTraceIdAndDeletedAtIsNull(Long traceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT job FROM Job job WHERE job.id = :id AND job.deletedAt IS NULL")
    Optional<Job> findByIdForUpdate(@Param("id") Long id);
}
