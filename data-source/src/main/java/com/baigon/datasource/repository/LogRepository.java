// 百工谱 — 日志数据访问层

package com.baigon.datasource.repository;

import com.baigon.datasource.entity.Log;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LogRepository extends JpaRepository<Log, Long> {
}
