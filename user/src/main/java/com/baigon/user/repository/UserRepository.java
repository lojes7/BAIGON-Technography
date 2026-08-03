// 百工谱 — 用户数据访问层

package com.baigon.user.repository;

import com.baigon.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** 按登录账号查询未删除的用户（过滤软删除） */
    @Query("SELECT u FROM User u WHERE u.uid = :uid AND u.deletedAt IS NULL")
    Optional<User> findByUid(@Param("uid") String uid);
}
