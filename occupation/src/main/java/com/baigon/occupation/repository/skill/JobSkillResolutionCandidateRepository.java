// 百工谱 — 岗位技能解析候选数据访问层
package com.baigon.occupation.repository.skill;

import com.baigon.occupation.entity.skill.JobSkillResolutionCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface JobSkillResolutionCandidateRepository
        extends JpaRepository<JobSkillResolutionCandidate, Long> {

    List<JobSkillResolutionCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    Optional<JobSkillResolutionCandidate> findByIdAndDeletedAtIsNull(Long id);

    List<JobSkillResolutionCandidate> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    boolean existsByTaskIdAndSkillIdAndDeletedAtIsNull(Long taskId, Long skillId);

    void deleteByTaskId(Long taskId);
}
