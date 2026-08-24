// 百工谱 — 岗位分析候选专业数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobAnalysisMajorCandidateRepository
        extends JpaRepository<JobAnalysisMajorCandidate, Long> {

    List<JobAnalysisMajorCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    void deleteByTaskId(Long taskId);
}
