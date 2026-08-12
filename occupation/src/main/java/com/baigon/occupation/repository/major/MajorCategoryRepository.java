// 百工谱 — 专业类数据访问层
package com.baigon.occupation.repository.major;

import com.baigon.occupation.entity.major.MajorCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MajorCategoryRepository extends JpaRepository<MajorCategory, Long> {

    @Query("""
            SELECT item FROM MajorCategory item
            WHERE item.deletedAt IS NULL
              AND item.disciplineCategoryId = :parentId
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<MajorCategory> search(@Param("parentId") long parentId,
                               @Param("keyword") String keyword,
                               Pageable pageable);
}
