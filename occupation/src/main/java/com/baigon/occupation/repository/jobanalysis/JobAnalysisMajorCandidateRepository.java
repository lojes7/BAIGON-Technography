// 百工谱 — 岗位分析候选专业数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface JobAnalysisMajorCandidateRepository
        extends JpaRepository<JobAnalysisMajorCandidate, Long> {

    List<JobAnalysisMajorCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    Optional<JobAnalysisMajorCandidate> findByIdAndDeletedAtIsNull(Long id);

    List<JobAnalysisMajorCandidate> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    void deleteByTaskId(Long taskId);
}
