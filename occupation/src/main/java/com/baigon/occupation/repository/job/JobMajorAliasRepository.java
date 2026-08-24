// 百工谱 — 招聘岗位专业文本别名数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.JobMajorAlias;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobMajorAliasRepository extends JpaRepository<JobMajorAlias, Long> {

    Optional<JobMajorAlias> findByJobMajorAndDeletedAtIsNull(String jobMajor);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT alias FROM JobMajorAlias alias
            WHERE alias.jobMajor = :jobMajor AND alias.deletedAt IS NULL
            """)
    Optional<JobMajorAlias> findByJobMajorForUpdate(@Param("jobMajor") String jobMajor);
}
