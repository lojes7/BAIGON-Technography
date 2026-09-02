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

    /** 活动专业别名统一按去首尾空格、忽略大小写匹配。 */
    @Query("""
            SELECT alias FROM JobMajorAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.jobMajor)) = LOWER(TRIM(:jobMajor))
            """)
    Optional<JobMajorAlias> findActiveByNormalizedJobMajor(
            @Param("jobMajor") String jobMajor);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT alias FROM JobMajorAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.jobMajor)) = LOWER(TRIM(:jobMajor))
            """)
    Optional<JobMajorAlias> findActiveByNormalizedJobMajorForUpdate(
            @Param("jobMajor") String jobMajor);
}
