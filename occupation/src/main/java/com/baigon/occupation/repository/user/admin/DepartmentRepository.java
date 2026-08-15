// 百工谱 — 系部目录数据访问层
package com.baigon.occupation.repository.user.admin;

import com.baigon.occupation.entity.user.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    @Query("""
            SELECT item FROM Department item
            WHERE item.deletedAt IS NULL
              AND (:schoolId IS NULL OR item.schoolId = :schoolId)
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<Department> search(@Param("schoolId") Long schoolId,
                            @Param("keyword") String keyword,
                            Pageable pageable);
}
