// 百工谱 — 正式岗位技能数据访问层
package com.baigon.occupation.repository.job;

import com.baigon.occupation.entity.job.JobSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {

    List<JobSkill> findByJobIdAndDeletedAtIsNullOrderByIdAsc(Long jobId);
}
