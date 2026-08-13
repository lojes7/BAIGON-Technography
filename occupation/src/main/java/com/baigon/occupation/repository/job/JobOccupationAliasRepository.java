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

    Optional<JobOccupationAlias> findByJobNameAndDeletedAtIsNull(String jobName);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT alias FROM JobOccupationAlias alias
            WHERE alias.jobName = :jobName AND alias.deletedAt IS NULL
            """)
    Optional<JobOccupationAlias> findByJobNameForUpdate(@Param("jobName") String jobName);
}
