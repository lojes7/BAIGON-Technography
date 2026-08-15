// 百工谱 — ADMIN 用户分页与组织目录查询业务层
package com.baigon.occupation.service.user.admin;

import com.baigon.occupation.entity.user.Department;
import com.baigon.occupation.entity.user.School;
import com.baigon.occupation.entity.user.University;
import com.baigon.occupation.entity.user.User;
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

import java.util.Locale;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class AdminUserService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

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
    
    /** 列表筛选全部使用 users 表字段，不加载组织资料。 */
    public Page<UserSummary> listUsers(int page, int pageSize, UserSearchCriteria criteria) {
        UserSearchCriteria filter = criteria == null ? UserSearchCriteria.empty() : criteria;
        User.Role role = role(filter.role());
        return userRepository.search(
                        text(filter.name()), role, organizationId(filter.universityId()),
                        organizationId(filter.schoolId()), organizationId(filter.departmentId()),
                        PageRequest.of(page(page), pageSize(pageSize)))
                .map(this::summary);
    }

    /** ADMIN 按用户 ID 查看账号与对应校园归属。 */
    public Optional<UserProfile> findProfile(long id) {
        if (id <= 0) {
            throw new IllegalArgumentException("id must be > 0");
        }
        return userRepository.findProfileById(id).map(this::profile);
    }

    //
    public Page<OrganizationSummary> listUniversities(int page, int pageSize, String keyword) {
        return universityRepository.search(text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(item.getId(), item.getName()));
    }

    //
    public Page<OrganizationSummary> listSchools(long universityId,
                                                  int page,
                                                  int pageSize,
                                                  String keyword) {
        return schoolRepository.search(parent(universityId), text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(item.getId(), item.getName()));
    }

    //
    public Page<OrganizationSummary> listDepartments(long schoolId,
                                                      int page,
                                                      int pageSize,
                                                      String keyword) {
        return departmentRepository.search(parent(schoolId), text(keyword), catalogPageable(page, pageSize))
                .map(item -> new OrganizationSummary(item.getId(), item.getName()));
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

    private UserSummary summary(User user) {
        return new UserSummary(
                user.getId(), user.getUid(), user.getName(), user.getRole().name(), user.getStatus().name());
    }

    private UserProfile profile(User user) {
        return new UserProfile(
                summary(user),
                organization(user.getUniversity()),
                organization(user.getSchool()),
                organization(user.getDepartment()));
    }

    private OrganizationSummary organization(University university) {
        return university == null ? null : new OrganizationSummary(university.getId(), university.getName());
    }

    private OrganizationSummary organization(School school) {
        return school == null ? null : new OrganizationSummary(school.getId(), school.getName());
    }

    private OrganizationSummary organization(Department department) {
        return department == null ? null : new OrganizationSummary(department.getId(), department.getName());
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

    public record OrganizationSummary(Long id, String name) {
    }

    public record UserSummary(
            Long id,
            String uid,
            String name,
            String role,
            String status) {
    }

    public record UserProfile(
            UserSummary user,
            OrganizationSummary university,
            OrganizationSummary school,
            OrganizationSummary department) {
    }
}
