// 百工谱 — 用户人岗匹配结果数据访问层
package com.baigon.occupation.repository.user.analysis;

import com.baigon.occupation.entity.user.analysis.UserJobMatchResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserJobMatchResultRepository extends JpaRepository<UserJobMatchResult, Long> {

    /** 按当前用户与岗位稳定读取最新结果；ID 用于 created_at 相同时的顺序兜底。 */
    Optional<UserJobMatchResult>
            findFirstByUserIdAndJobIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                    Long userId, Long jobId);
}
