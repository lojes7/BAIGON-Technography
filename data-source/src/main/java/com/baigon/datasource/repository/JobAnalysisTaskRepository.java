// 百工谱 — 岗位分析任务数据访问层

package com.baigon.datasource.repository;

import com.baigon.datasource.entity.JobAnalysisTask;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobAnalysisTaskRepository extends JpaRepository<JobAnalysisTask, Long> {
}
