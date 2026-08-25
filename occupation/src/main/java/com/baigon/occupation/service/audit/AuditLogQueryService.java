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
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AuditLogQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final AuditLogQueryRepository logRepository;
    private final UserRepository userRepository;

    public AuditLogQueryService(AuditLogQueryRepository logRepository,
                                UserRepository userRepository) {
        this.logRepository = logRepository;
        this.userRepository = userRepository;
    }

    /** 普通用户的目标用户条件永远覆盖为本人，客户端无法越权扩大查询范围。 */
    public Page<AuditLogEntry> pagedSearch(long requesterUserId,
                                            User.Role requesterRole,
                                            int page,
                                            int pageSize,
                                            SearchCriteria criteria) {
        if (requesterUserId <= 0 || requesterRole == null) {
            throw new ApiException(ApiException.ErrorCode.UNAUTHORIZED, "invalid requester");
        }
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }

        SearchCriteria filter = criteria == null ? SearchCriteria.empty() : criteria;
        // 两个分支都显式保持 Long，避免 ADMIN 未指定用户时把 null 自动拆箱为 long。
        Long targetUserId = requesterRole == User.Role.ADMIN
                ? positiveOrNull(filter.targetUserId())
                : Long.valueOf(requesterUserId);
        User.Role userType = requesterRole == User.Role.ADMIN ? filter.userType() : null;
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
                userType,
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

    private int normalizedPageSize(int pageSize) {
        if (pageSize < 0 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
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
