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

    /** 按 uid 查询未软删除用户。 */
    Optional<User> findByUidAndDeletedAtIsNull(String uid);

    /** 用户列表按 users 表字段筛选，并一次加载扁平响应需要的组织名称。 */
    @EntityGraph(attributePaths = {
            "university",
            "school",
            "department"
    })
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

    /** 按用户 ID 查询账号资料。 */
    @EntityGraph(attributePaths = {
            "university",
            "school",
            "department"
    })
    Optional<User> findByIdAndDeletedAtIsNull(long id);

    boolean existsByIdAndDeletedAtIsNull(long id);
}
