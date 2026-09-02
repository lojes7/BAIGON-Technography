// 百工谱 — 职业大类数据访问层
package com.baigon.occupation.repository.occupation;

import com.baigon.occupation.entity.occupation.OccupationMajorCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OccupationMajorCategoryRepository extends JpaRepository<OccupationMajorCategory, Long> {

    Optional<OccupationMajorCategory> findByIdAndDeletedAtIsNull(Long id);

    List<OccupationMajorCategory> findByIdInAndDeletedAtIsNullOrderByIdAsc(
            Collection<Long> ids);

    @Query("""
            SELECT item FROM OccupationMajorCategory item
            WHERE item.deletedAt IS NULL
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(item.code) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<OccupationMajorCategory> search(@Param("keyword") String keyword, Pageable pageable);
}
