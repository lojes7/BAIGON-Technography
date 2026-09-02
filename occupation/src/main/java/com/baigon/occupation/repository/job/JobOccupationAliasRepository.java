// 百工谱 — 岗位名称别名数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.JobOccupationAlias;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobOccupationAliasRepository extends JpaRepository<JobOccupationAlias, Long> {

    /** 活动岗位别名统一按去首尾空格、忽略大小写匹配。 */
    @Query("""
            SELECT alias FROM JobOccupationAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.jobName)) = LOWER(TRIM(:jobName))
            """)
    Optional<JobOccupationAlias> findActiveByNormalizedJobName(
            @Param("jobName") String jobName);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT alias FROM JobOccupationAlias alias
            WHERE alias.deletedAt IS NULL
              AND LOWER(TRIM(alias.jobName)) = LOWER(TRIM(:jobName))
            """)
    Optional<JobOccupationAlias> findActiveByNormalizedJobNameForUpdate(
            @Param("jobName") String jobName);
}
