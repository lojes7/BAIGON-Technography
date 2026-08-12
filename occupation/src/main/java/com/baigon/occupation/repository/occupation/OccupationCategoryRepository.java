// 百工谱 — 职业小类数据访问层
package com.baigon.occupation.repository.occupation;

import com.baigon.occupation.entity.occupation.OccupationCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OccupationCategoryRepository extends JpaRepository<OccupationCategory, Long> {

    @Query("""
            SELECT item FROM OccupationCategory item
            WHERE item.deletedAt IS NULL
              AND item.occupationSubCategoryId = :parentId
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<OccupationCategory> search(@Param("parentId") long parentId,
                                    @Param("keyword") String keyword,
                                    Pageable pageable);
}
