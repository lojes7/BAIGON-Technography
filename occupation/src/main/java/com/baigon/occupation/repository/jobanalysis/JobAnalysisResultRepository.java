// 百工谱 — JD 技能分析结果数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface JobAnalysisResultRepository extends JpaRepository<JobAnalysisResult, Long> {

    List<JobAnalysisResult> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    Optional<JobAnalysisResult> findByIdAndDeletedAtIsNull(Long id);

    List<JobAnalysisResult> findByIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> ids);

    void deleteByTaskId(Long taskId);
}
