// 百工谱 — JD 技能分析结果数据访问层
package com.baigon.occupation.repository.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobAnalysisResultRepository extends JpaRepository<JobAnalysisResult, Long> {

    List<JobAnalysisResult> findByTaskIdAndDeletedAtIsNullOrderByRankAsc(Long taskId);

    void deleteByTaskId(Long taskId);
}
