// 百工谱 — 学院目录数据访问层
package com.baigon.occupation.repository.user.admin;

import com.baigon.occupation.entity.user.School;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SchoolRepository extends JpaRepository<School, Long> {
    @Query("""
            SELECT item FROM School item
            WHERE item.deletedAt IS NULL
              AND (:universityId IS NULL OR item.universityId = :universityId)
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<School> search(@Param("universityId") Long universityId,
                        @Param("keyword") String keyword,
                        Pageable pageable);
}
