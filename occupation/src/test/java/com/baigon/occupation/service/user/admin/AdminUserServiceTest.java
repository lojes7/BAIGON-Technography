// 百工谱 — ADMIN 用户分页与组织目录服务测试
package com.baigon.occupation.service.user.admin;

import com.baigon.occupation.entity.user.Department;
import com.baigon.occupation.entity.user.School;
import com.baigon.occupation.entity.user.University;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import com.baigon.occupation.repository.user.admin.DepartmentRepository;
import com.baigon.occupation.repository.user.admin.SchoolRepository;
import com.baigon.occupation.repository.user.admin.UniversityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminUserServiceTest {

    private UserRepository userRepository;
    private UniversityRepository universityRepository;
    private SchoolRepository schoolRepository;
    private DepartmentRepository departmentRepository;
    private AdminUserService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        universityRepository = mock(UniversityRepository.class);
        schoolRepository = mock(SchoolRepository.class);
        departmentRepository = mock(DepartmentRepository.class);
        service = new AdminUserService(
                userRepository,
                universityRepository,
                schoolRepository,
                departmentRepository);
    }

    @Test
    void listUsersFiltersByOrganizationIdsWithoutLoadingOrganization() {
        User user = new User();
        user.setId(1L);
        user.setUid("admin");
        user.setName("管理员");
        user.setRole(User.Role.ADMIN);
        user.setStatus(User.UserStatus.NORMAL);
        when(userRepository.search(
                eq("管理"), eq(User.Role.ADMIN), eq(1L), eq(2L), eq(3L),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user)));

        var result = service.listUsers(0, 0,
                new AdminUserService.UserSearchCriteria(" 管理 ", "admin", 1, 2, 3));

        assertEquals(1, result.getTotalElements());
        assertEquals("admin", result.getContent().getFirst().uid());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).search(
                eq("管理"), eq(User.Role.ADMIN), eq(1L), eq(2L), eq(3L),
                pageable.capture());
        assertEquals(20, pageable.getValue().getPageSize());
    }

    @Test
    void invalidRoleIsRejectedBeforeRepositoryQuery() {
        assertThrows(IllegalArgumentException.class, () -> service.listUsers(
                0, 20,
                new AdminUserService.UserSearchCriteria("", "ROOT", 0, 0, 0)));
    }

    @Test
    void listUsersReturnsOnlyOrganizationIds() {
        User user = new User();
        user.setId(8L);
        user.setUid("student01");
        user.setName("张三");
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.NORMAL);
        user.setUniversityId(1L);
        user.setSchoolId(2L);
        user.setDepartmentId(3L);
        when(userRepository.search(
                eq(""), eq(null), eq(null), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user)));

        var result = service.listUsers(0, 20, AdminUserService.UserSearchCriteria.empty())
                .getContent().getFirst();

        assertEquals(1L, result.universityId());
        assertEquals(2L, result.schoolId());
        assertEquals(3L, result.departmentId());
    }

    @Test
    void batchGetSchoolsShouldDeduplicateAndKeepRequestOrder() {
        School first = new School();
        first.setId(9L);
        first.setName("九号学院");
        first.setUniversityId(1L);
        School second = new School();
        second.setId(3L);
        second.setName("三号学院");
        second.setUniversityId(2L);
        when(schoolRepository.findByIdInAndDeletedAtIsNull(List.of(9L, 3L, 8L)))
                .thenReturn(List.of(second, first));

        List<AdminUserService.OrganizationSummary> result =
                service.batchGetSchools(List.of(9L, 3L, 9L, 8L));

        assertEquals(List.of(9L, 3L), result.stream()
                .map(AdminUserService.OrganizationSummary::id).toList());
        assertEquals(List.of("九号学院", "三号学院"), result.stream()
                .map(AdminUserService.OrganizationSummary::name).toList());
        assertEquals(List.of(1L, 2L), result.stream()
                .map(AdminUserService.OrganizationSummary::parentId).toList());
        verify(schoolRepository).findByIdInAndDeletedAtIsNull(List.of(9L, 3L, 8L));
    }

    @Test
    void organizationBatchShouldRequireOneToTwoHundredRawIds() {
        assertThrows(IllegalArgumentException.class, () -> service.batchGetSchools(List.of()));
        assertThrows(IllegalArgumentException.class, () ->
                service.batchGetSchools(java.util.Collections.nCopies(201, 1L)));
    }

    @Test
    void blockUserSetsLockedAndReturnsUpdatedUser() {
        User user = new User();
        user.setId(7L);
        user.setUid("student01");
        user.setName("张三");
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.NORMAL);
        when(userRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        var result = service.blockUser(7L);

        assertEquals(User.UserStatus.LOCKED, user.getStatus());
        assertEquals("LOCKED", result.orElseThrow().status());
        verify(userRepository).save(user);
    }

    @Test
    void blockUserReturnsEmptyWhenUserDoesNotExist() {
        when(userRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.empty());

        assertEquals(Optional.empty(), service.blockUser(99L));
    }

    @Test
    void unlockUserSetsNormalAndReturnsUpdatedUser() {
        User user = new User();
        user.setId(7L);
        user.setUid("student01");
        user.setName("张三");
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.LOCKED);
        when(userRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        var result = service.unlockUser(7L);

        assertEquals(User.UserStatus.NORMAL, user.getStatus());
        assertEquals("NORMAL", result.orElseThrow().status());
        verify(userRepository).save(user);
    }

    @Test
    void unlockUserReturnsEmptyWhenUserDoesNotExist() {
        when(userRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.empty());

        assertEquals(Optional.empty(), service.unlockUser(99L));
    }

    @Test
    void schoolListAcceptsMissingParentAndRejectsNegativeParent() {
        when(schoolRepository.search(eq(null), eq(""), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchools(0, 0, 20, "");

        verify(schoolRepository).search(eq(null), eq(""), any(Pageable.class));
        assertThrows(IllegalArgumentException.class,
                () -> service.listSchools(-1, 0, 20, ""));
    }

    @Test
    void pageSizeOverOneHundredIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.normalizedPageSize(101));
    }
}
