// 百工谱 — 岗位分析候选职业数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobAnalysisCandidateRepository extends JpaRepository<JobAnalysisCandidate, Long> {

    List<JobAnalysisCandidate> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    void deleteByTaskId(Long taskId);
}
