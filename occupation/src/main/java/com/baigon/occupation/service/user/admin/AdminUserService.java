// 百工谱 — ADMIN 用户分页与组织目录查询业务层
package com.baigon.occupation.service.user.admin;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.entity.user.Department;
import com.baigon.occupation.entity.user.School;
import com.baigon.occupation.entity.user.University;
import com.baigon.occupation.repository.user.UserRepository;
import com.baigon.occupation.repository.user.admin.DepartmentRepository;
import com.baigon.occupation.repository.user.admin.SchoolRepository;
import com.baigon.occupation.repository.user.admin.UniversityRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

@Service
@Transactional(readOnly = true)
public class AdminUserService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_BATCH_SIZE = 200;

    private final UserRepository userRepository;
    private final UniversityRepository universityRepository;
    private final SchoolRepository schoolRepository;
    private final DepartmentRepository departmentRepository;

    public AdminUserService(UserRepository userRepository,
                            UniversityRepository universityRepository,
                            SchoolRepository schoolRepository,
                            DepartmentRepository departmentRepository) {
        this.userRepository = userRepository;
        this.universityRepository = universityRepository;
        this.schoolRepository = schoolRepository;
        this.departmentRepository = departmentRepository;
    }

    /** 列表筛选使用 users 表字段，用户结果只携带组织外键 ID。 */
    public Page<UserData> listUsers(int page, int pageSize, UserSearchCriteria criteria) {
        UserSearchCriteria filter = criteria == null ? UserSearchCriteria.empty() : criteria;
        User.Role role = role(filter.role());
        return userRepository.search(
                        text(filter.name()), role, organizationId(filter.universityId()),
                        organizationId(filter.schoolId()), organizationId(filter.departmentId()),
                        PageRequest.of(page(page), pageSize(pageSize)))
                .map(this::build);
    }

    /** ADMIN 封禁用户；已封禁账号重复调用时保持 LOCKED。 */
    @Transactional
    public Optional<UserData> blockUser(long id) {
        if (id <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return userRepository.findByIdAndDeletedAtIsNull(id).map(user -> {
            user.setStatus(User.UserStatus.LOCKED);
            return build(userRepository.save(user));
        });
    }

    /** ADMIN 解封用户；正常账号重复调用时保持 NORMAL。 */
    @Transactional
    public Optional<UserData> unlockUser(long id) {
        if (id <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return userRepository.findByIdAndDeletedAtIsNull(id).map(user -> {
            user.setStatus(User.UserStatus.NORMAL);
            return build(userRepository.save(user));
        });
    }

    /** 分页查询高校目录。 */
    public Page<OrganizationSummary> listUniversities(int page, int pageSize, String keyword) {
        return universityRepository.search(text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(item.getId(), item.getName(), 0L));
    }

    /** 分页查询学院目录，universityId 为 0 时不限高校。 */
    public Page<OrganizationSummary> listSchools(long universityId,
                                                  int page,
                                                  int pageSize,
                                                  String keyword) {
        return schoolRepository.search(parent(universityId), text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(
                        item.getId(), item.getName(), item.getUniversityId()));
    }

    /** 分页查询系部目录，schoolId 为 0 时不限学院。 */
    public Page<OrganizationSummary> listDepartments(long schoolId,
                                                      int page,
                                                      int pageSize,
                                                      String keyword) {
        return departmentRepository.search(parent(schoolId), text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(
                        item.getId(), item.getName(), item.getSchoolId()));
    }

    /** 按请求 ID 顺序批量查询高校详情。 */
    public List<OrganizationSummary> batchGetUniversities(Collection<Long> ids) {
        List<Long> validated = validatedIds(ids);
        return orderedOrganizations(
                validated,
                universityRepository.findByIdInAndDeletedAtIsNull(validated),
                University::getId,
                item -> new OrganizationSummary(item.getId(), item.getName(), 0L));
    }

    /** 按请求 ID 顺序批量查询学院详情。 */
    public List<OrganizationSummary> batchGetSchools(Collection<Long> ids) {
        List<Long> validated = validatedIds(ids);
        return orderedOrganizations(
                validated,
                schoolRepository.findByIdInAndDeletedAtIsNull(validated),
                School::getId,
                item -> new OrganizationSummary(
                        item.getId(), item.getName(), item.getUniversityId()));
    }

    /** 按请求 ID 顺序批量查询系部详情。 */
    public List<OrganizationSummary> batchGetDepartments(Collection<Long> ids) {
        List<Long> validated = validatedIds(ids);
        return orderedOrganizations(
                validated,
                departmentRepository.findByIdInAndDeletedAtIsNull(validated),
                Department::getId,
                item -> new OrganizationSummary(item.getId(), item.getName(), item.getSchoolId()));
    }

    public int normalizedPageSize(int value) {
        if (value < 0 || value > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return value == 0 ? DEFAULT_PAGE_SIZE : value;
    }

    private Pageable catalogPageable(int page, int pageSize) {
        return PageRequest.of(page(page), pageSize(pageSize), Sort.by(Sort.Direction.ASC, "id"));
    }

    private int page(int value) {
        if (value < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        return value;
    }

    private int pageSize(int value) {
        return normalizedPageSize(value);
    }

    private Long parent(long value) {
        if (value < 0) {
            throw new IllegalArgumentException("parent_id must be > 0");
        }
        return value == 0 ? null : value;
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }

    private User.Role role(String value) {
        String normalized = text(value).toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return User.Role.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("invalid role");
        }
    }

    private UserData build(User user) {
        return new UserData(
                user.getId(), user.getUid(), user.getName(), user.getRole().name(), user.getStatus().name(),
                user.getUniversityId(), user.getSchoolId(), user.getDepartmentId());
    }

    private List<Long> validatedIds(Collection<Long> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("ids must not be empty");
        }
        if (values.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("ids must contain at most 200 values");
        }
        List<Long> ids = List.copyOf(values);
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("ids must contain positive values");
        }
        // 在仓库查询前去重，并保持首次出现顺序。
        return ids.stream().distinct().toList();
    }

    private <T> List<OrganizationSummary> orderedOrganizations(
            List<Long> ids,
            List<T> entities,
            Function<T, Long> id,
            Function<T, OrganizationSummary> mapper) {
        Map<Long, T> byId = new LinkedHashMap<>();
        entities.forEach(item -> byId.put(id.apply(item), item));
        return ids.stream()
                .distinct()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(mapper)
                .toList();
    }

    private Long organizationId(long value) {
        if (value < 0) {
            throw new IllegalArgumentException("organization_id must be >= 0");
        }
        return value == 0 ? null : value;
    }

    public record UserSearchCriteria(
            String name,
            String role,
            long universityId,
            long schoolId,
            long departmentId) {

        public static UserSearchCriteria empty() {
            return new UserSearchCriteria("", "", 0, 0, 0);
        }
    }

    public record OrganizationSummary(Long id, String name, Long parentId) {
    }

    public record UserData(
            Long id,
            String uid,
            String name,
            String role,
            String status,
            Long universityId,
            Long schoolId,
            Long departmentId) {
    }
}
