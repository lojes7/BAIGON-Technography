// 百工谱 — 职业中类数据访问层
package com.baigon.occupation.repository.occupation;

import com.baigon.occupation.entity.occupation.OccupationSubCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OccupationSubCategoryRepository extends JpaRepository<OccupationSubCategory, Long> {

    @Query("""
            SELECT item FROM OccupationSubCategory item
            WHERE item.deletedAt IS NULL
              AND item.occupationMajorCategoryId = :parentId
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<OccupationSubCategory> search(@Param("parentId") long parentId,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);
}
