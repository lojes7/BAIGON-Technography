// 百工谱 — 岗位分析候选职业数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface JobAnalysisCandidateRepository extends JpaRepository<JobAnalysisCandidate, Long> {

    List<JobAnalysisCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    Optional<JobAnalysisCandidate> findByIdAndDeletedAtIsNull(Long id);

    List<JobAnalysisCandidate> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    void deleteByTaskId(Long taskId);
}
