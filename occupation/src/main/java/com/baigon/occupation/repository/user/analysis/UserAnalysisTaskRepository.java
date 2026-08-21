// 百工谱 — 用户分析任务数据访问层
package com.baigon.occupation.repository.user.analysis;

import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.user.analysis.UserAnalysisTask;
import com.baigon.occupation.entity.user.analysis.UserAnalysisType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface UserAnalysisTaskRepository extends JpaRepository<UserAnalysisTask, Long> {

    Optional<UserAnalysisTask> findByIdAndDeletedAtIsNull(Long id);

    Optional<UserAnalysisTask> findByTraceIdAndDeletedAtIsNull(Long traceId);

    /** 锁定同一分析目标的执行中任务，供新请求判断并回收超时任务。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserAnalysisTask>
    findFirstByUserIdAndResumeIdAndJobIdAndTaskTypeAndTaskStatusAndDeletedAtIsNull(
            Long userId,
            Long resumeId,
            Long jobId,
            UserAnalysisType taskType,
            TaskStatus taskStatus);
}
