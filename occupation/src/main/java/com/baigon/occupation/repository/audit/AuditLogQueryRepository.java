// 百工谱 — occupation 审计日志分页查询数据访问层
package com.baigon.occupation.repository.audit;

import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.user.User;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.Repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public interface AuditLogQueryRepository extends Repository<Log, Long>, JpaSpecificationExecutor<Log> {

    List<Log> findByIdInAndDeletedAtIsNull(Collection<Long> ids);

    /**
     * 只为实际传入的筛选项生成谓词，避免 PostgreSQL 无法推断“空参数 IS NULL”的类型。
     * user_type 通过当前用户表关联筛选；日志本身保持不可变，不补写角色快照。
     */
    default Page<Log> pagedSearch(Long targetUserId,
                                  User.Role userType,
                                  Log.Level level,
                                  OffsetDateTime createdAtFrom,
                                  OffsetDateTime createdAtTo,
                                  Pageable pageable) {
        return findAll(filters(
                targetUserId, userType, level, createdAtFrom, createdAtTo), pageable);
    }

    static Specification<Log> filters(Long targetUserId,
                                      User.Role userType,
                                      Log.Level level,
                                      OffsetDateTime createdAtFrom,
                                      OffsetDateTime createdAtTo) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.isNull(root.get("deletedAt")));

            if (targetUserId != null) {
                predicates.add(criteriaBuilder.equal(root.get("userId"), targetUserId));
            }
            if (userType != null) {
                // logs 没有 user_type 快照，通过 users.role 获取用户当前角色。
                var userRoleQuery = query.subquery(Long.class);
                var account = userRoleQuery.from(User.class);
                userRoleQuery.select(account.get("id"));
                userRoleQuery.where(
                        criteriaBuilder.equal(account.get("id"), root.get("userId")),
                        criteriaBuilder.equal(account.get("role"), userType));
                predicates.add(criteriaBuilder.exists(userRoleQuery));
            }
            if (level != null) {
                predicates.add(criteriaBuilder.equal(root.get("level"), level));
            }
            if (createdAtFrom != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(
                        root.<OffsetDateTime>get("createdAt"), createdAtFrom));
            }
            if (createdAtTo != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(
                        root.<OffsetDateTime>get("createdAt"), createdAtTo));
            }
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
