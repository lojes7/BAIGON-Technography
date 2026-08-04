// 百工谱 — 日志数据访问层

package com.baigon.user.repository;

import com.baigon.user.entity.Log;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LogRepository extends JpaRepository<Log, Long> {
}
