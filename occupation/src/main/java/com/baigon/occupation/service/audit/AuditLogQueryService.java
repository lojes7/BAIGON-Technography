// 百工谱 — occupation 审计日志分页查询业务层
package com.baigon.occupation.service.audit;

import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.repository.audit.AuditLogQueryRepository;
import com.baigon.occupation.repository.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AuditLogQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_BATCH_SIZE = 200;

    private final AuditLogQueryRepository logRepository;
    private final UserRepository userRepository;

    public AuditLogQueryService(AuditLogQueryRepository logRepository,
                                UserRepository userRepository) {
        this.logRepository = logRepository;
        this.userRepository = userRepository;
    }

    /** 审计日志属于系统管理数据，仅 ADMIN 可以查询。 */
    public Page<AuditLogEntry> pagedSearch(long requesterUserId,
                                            User.Role requesterRole,
                                            int page,
                                            int pageSize,
                                            SearchCriteria criteria) {
        if (requesterUserId <= 0 || requesterRole == null) {
            throw new ApiException(ApiException.ErrorCode.UNAUTHORIZED, "invalid requester");
        }
        if (requesterRole != User.Role.ADMIN) {
            throw new ApiException(ApiException.ErrorCode.FORBIDDEN, "ADMIN role required");
        }
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }

        SearchCriteria filter = criteria == null ? SearchCriteria.empty() : criteria;
        Long targetUserId = positiveOrNull(filter.targetUserId());
        if (filter.createdAtFrom() != null && filter.createdAtTo() != null
                && filter.createdAtFrom().isAfter(filter.createdAtTo())) {
            throw new IllegalArgumentException("created_at_from must not be after created_at_to");
        }

        PageRequest pageable = PageRequest.of(
                page,
                normalizedPageSize(pageSize),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<Log> logs = logRepository.pagedSearch(
                targetUserId,
                filter.userType(),
                filter.level(),
                filter.createdAtFrom(),
                filter.createdAtTo(),
                pageable);

        Map<Long, User> users = userRepository.findAllById(
                        logs.getContent().stream().map(Log::getUserId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return logs.map(log -> {
            User user = users.get(log.getUserId());
            return new AuditLogEntry(log, user == null || user.getRole() == null
                    ? ""
                    : user.getRole().name());
        });
    }

    /** ADMIN 按 ID 批量读取 occupation 来源日志详情，顺序与请求一致。 */
    public List<AuditLogEntry> batchGet(long requesterUserId,
                                        User.Role requesterRole,
                                        Collection<Long> values) {
        assertAdmin(requesterUserId, requesterRole);
        List<Long> ids = validatedIds(values);
        Map<Long, Log> logsById = new LinkedHashMap<>();
        logRepository.findByIdInAndDeletedAtIsNull(ids)
                .forEach(log -> logsById.put(log.getId(), log));
        List<Log> logs = ids.stream()
                .distinct()
                .map(logsById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<Long, User> users = usersById(logs);
        return logs.stream()
                .map(log -> new AuditLogEntry(log, userType(users.get(log.getUserId()))))
                .toList();
    }

    private int normalizedPageSize(int pageSize) {
        if (pageSize < 0 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
    }

    private void assertAdmin(long requesterUserId, User.Role requesterRole) {
        if (requesterUserId <= 0 || requesterRole == null) {
            throw new ApiException(ApiException.ErrorCode.UNAUTHORIZED, "invalid requester");
        }
        if (requesterRole != User.Role.ADMIN) {
            throw new ApiException(ApiException.ErrorCode.FORBIDDEN, "ADMIN role required");
        }
    }

    private List<Long> validatedIds(Collection<Long> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("target_log_ids must not be empty");
        }
        if (values.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("target_log_ids must contain at most 200 values");
        }
        List<Long> ids = List.copyOf(values);
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("target_log_ids must contain positive values");
        }
        return ids;
    }

    private Map<Long, User> usersById(List<Log> logs) {
        return userRepository.findAllById(
                        logs.stream().map(Log::getUserId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private String userType(User user) {
        return user == null || user.getRole() == null ? "" : user.getRole().name();
    }

    private Long positiveOrNull(Long value) {
        if (value == null || value == 0) {
            return null;
        }
        if (value < 0) {
            throw new IllegalArgumentException("target_user_id must be > 0");
        }
        return value;
    }

    public record SearchCriteria(
            Log.Level level,
            OffsetDateTime createdAtFrom,
            OffsetDateTime createdAtTo,
            Long targetUserId,
            User.Role userType) {

        public static SearchCriteria empty() {
            return new SearchCriteria(null, null, null, null, null);
        }
    }

    public record AuditLogEntry(Log log, String userType) {
    }
}
