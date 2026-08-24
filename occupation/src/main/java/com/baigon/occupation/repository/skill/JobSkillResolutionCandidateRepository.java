// 百工谱 — 岗位技能解析候选数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobSkillResolutionCandidateRepository
        extends JpaRepository<JobSkillResolutionCandidate, Long> {

    List<JobSkillResolutionCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    boolean existsByTaskIdAndSkillIdAndDeletedAtIsNull(Long taskId, Long skillId);

    void deleteByTaskId(Long taskId);
}
