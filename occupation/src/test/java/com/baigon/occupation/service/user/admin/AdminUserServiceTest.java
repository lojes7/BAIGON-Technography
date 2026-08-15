// 百工谱 — ADMIN 用户分页与组织目录服务测试
package com.baigon.occupation.service.user.admin;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminUserServiceTest {

    private UserRepository userRepository;
    private SchoolRepository schoolRepository;
    private AdminUserService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        schoolRepository = mock(SchoolRepository.class);
        service = new AdminUserService(
                userRepository,
                mock(UniversityRepository.class),
                schoolRepository,
                mock(DepartmentRepository.class));
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
