// 百工谱 — occupation 审计日志分页查询数据访问层
package com.baigon.occupation.repository.audit;

import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface AuditLogQueryRepository extends Repository<Log, Long> {

    /** 日志与当前用户角色关联筛选；日志本身保持不可变，不补写 user_type 快照。 */
    @Query(
            value = """
                    SELECT log FROM Log log
                    WHERE log.deletedAt IS NULL
                      AND (:targetUserId IS NULL OR log.userId = :targetUserId)
                      AND (:userType IS NULL OR EXISTS (
                            SELECT account.id FROM User account
                            WHERE account.id = log.userId AND account.role = :userType
                          ))
                      AND (:level IS NULL OR log.level = :level)
                      AND (:createdAtFrom IS NULL OR log.createdAt >= :createdAtFrom)
                      AND (:createdAtTo IS NULL OR log.createdAt <= :createdAtTo)
                    """,
            countQuery = """
                    SELECT COUNT(log) FROM Log log
                    WHERE log.deletedAt IS NULL
                      AND (:targetUserId IS NULL OR log.userId = :targetUserId)
                      AND (:userType IS NULL OR EXISTS (
                            SELECT account.id FROM User account
                            WHERE account.id = log.userId AND account.role = :userType
                          ))
                      AND (:level IS NULL OR log.level = :level)
                      AND (:createdAtFrom IS NULL OR log.createdAt >= :createdAtFrom)
                      AND (:createdAtTo IS NULL OR log.createdAt <= :createdAtTo)
                    """)
    Page<Log> pagedSearch(@Param("targetUserId") Long targetUserId,
                          @Param("userType") User.Role userType,
                          @Param("level") Log.Level level,
                          @Param("createdAtFrom") OffsetDateTime createdAtFrom,
                          @Param("createdAtTo") OffsetDateTime createdAtTo,
                          Pageable pageable);
}
