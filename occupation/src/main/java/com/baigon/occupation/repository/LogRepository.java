// 百工谱 — occupation 业务日志数据访问层
package com.baigon.occupation.repository;

import com.baigon.occupation.entity.Log;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LogRepository extends JpaRepository<Log, Long> {
}
