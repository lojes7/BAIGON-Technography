// 百工谱 — 用户域数据访问层
package com.baigon.occupation.repository.user;

import com.baigon.occupation.entity.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** 按账号查询未软删除用户。 */
    @Query("SELECT u FROM User u WHERE u.uid = :uid AND u.deletedAt IS NULL")
    Optional<User> findByUid(@Param("uid") String uid);
}
