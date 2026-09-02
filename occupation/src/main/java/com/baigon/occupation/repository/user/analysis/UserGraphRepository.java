// 百工谱 — 用户技能图谱数据访问层
package com.baigon.occupation.repository.user.analysis;

import com.baigon.occupation.entity.user.analysis.UserGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserGraphRepository extends JpaRepository<UserGraph, Long> {

    /** 服务端分页查询当前用户技能，排序由业务层明确指定。 */
    Page<UserGraph> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);

    /** 单条详情必须同时校验记录所有权。 */
    Optional<UserGraph> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    /** 批量详情必须同时校验记录所有权。 */
    List<UserGraph> findByUserIdAndIdInAndDeletedAtIsNull(Long userId, Collection<Long> ids);
}
