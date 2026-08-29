// 百工谱 — 正式岗位技能数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.JobSkill;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {

    List<JobSkill> findByJobIdAndDeletedAtIsNullOrderByIdAsc(Long jobId);

    List<JobSkill> findByJobIdInAndDeletedAtIsNullOrderByJobIdAscIdAsc(
            Collection<Long> jobIds);

    Optional<JobSkill> findByIdAndDeletedAtIsNull(Long id);

    List<JobSkill> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT skill FROM JobSkill skill WHERE skill.id = :id AND skill.deletedAt IS NULL")
    Optional<JobSkill> findByIdForUpdate(@Param("id") Long id);
}
