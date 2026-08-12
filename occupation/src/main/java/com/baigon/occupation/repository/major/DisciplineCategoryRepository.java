// 百工谱 — 学科门类数据访问层
package com.baigon.occupation.repository.major;

import com.baigon.occupation.entity.major.DisciplineCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DisciplineCategoryRepository extends JpaRepository<DisciplineCategory, Long> {

    @Query("""
            SELECT item FROM DisciplineCategory item
            WHERE item.deletedAt IS NULL
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<DisciplineCategory> search(@Param("keyword") String keyword, Pageable pageable);
}
