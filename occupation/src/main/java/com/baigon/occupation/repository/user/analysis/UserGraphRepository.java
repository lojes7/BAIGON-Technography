// 百工谱 — 用户技能图谱数据访问层
package com.baigon.occupation.repository.user.analysis;

import com.baigon.occupation.entity.user.analysis.UserGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserGraphRepository extends JpaRepository<UserGraph, Long> {

    /** 按时间线与批内顺序稳定返回当前用户的全部历史技能。 */
    List<UserGraph> findByUserIdAndDeletedAtIsNullOrderByCreatedAtAscRankAscIdAsc(Long userId);
}
