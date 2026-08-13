// 百工谱 — 已复核岗位数据访问层

package com.baigon.occupation.repository.datasource;

import com.baigon.occupation.entity.datasource.ReviewedCleanedJobSource;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewedCleanedJobSourceRepository extends JpaRepository<ReviewedCleanedJobSource, Long> {
}
