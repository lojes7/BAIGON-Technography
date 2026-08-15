// 百工谱 — 用户域数据访问层
package com.baigon.occupation.repository.user;

import com.baigon.occupation.entity.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** 按账号查询未软删除用户。 */
    @Query("SELECT u FROM User u WHERE u.uid = :uid AND u.deletedAt IS NULL")
    Optional<User> findByUid(@Param("uid") String uid);

    /** 用户列表直接按 users 表字段筛选，不再跨身份表或组织表。 */
    @Query("""
            SELECT u FROM User u
            WHERE u.deletedAt IS NULL
              AND (:name = '' OR LOWER(u.name) LIKE LOWER(CONCAT('%', :name, '%')))
              AND (:role IS NULL OR u.role = :role)
              AND (:universityId IS NULL OR u.universityId = :universityId)
              AND (:schoolId IS NULL OR u.schoolId = :schoolId)
              AND (:departmentId IS NULL OR u.departmentId = :departmentId)
            """)
    Page<User> search(@Param("name") String name,
                      @Param("role") User.Role role,
                      @Param("universityId") Long universityId,
                      @Param("schoolId") Long schoolId,
                      @Param("departmentId") Long departmentId,
                      Pageable pageable);

    /** ADMIN 按用户 ID 查询账号与对应校园身份资料。 */
    @EntityGraph(attributePaths = {
            "university",
            "school",
            "department"
    })
    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    Optional<User> findProfileById(@Param("id") long id);
}
