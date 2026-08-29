// 百工谱 — 高校目录数据访问层
package com.baigon.occupation.repository.user.admin;

import com.baigon.occupation.entity.user.University;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface UniversityRepository extends JpaRepository<University, Long> {
    @Query("""
            SELECT item FROM University item
            WHERE item.deletedAt IS NULL
              AND (:keyword = '' OR LOWER(item.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<University> search(@Param("keyword") String keyword, Pageable pageable);

    List<University> findByIdInAndDeletedAtIsNull(Collection<Long> ids);
}
