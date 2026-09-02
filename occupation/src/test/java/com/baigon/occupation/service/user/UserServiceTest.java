// 百工谱 — 通用用户查询业务测试
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private UserRepository userRepository;
    private UserService userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userService = new UserService(userRepository);
    }

    @Test
    void getUserShouldMapOnlyOrganizationIds() {
        User user = new User();
        user.setId(8L);
        user.setUid("student01");
        user.setName("张三");
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.NORMAL);
        user.setUniversityId(1L);
        user.setSchoolId(2L);
        user.setDepartmentId(3L);
        when(userRepository.findByIdAndDeletedAtIsNull(8L)).thenReturn(Optional.of(user));

        UserService.UserData result = userService.getUser(8L).orElseThrow();

        assertEquals(1L, result.universityId());
        assertEquals(2L, result.schoolId());
        assertEquals(3L, result.departmentId());
    }

    @Test
    void batchGetUsersShouldDeduplicateAndKeepRequestOrder() {
        User first = user(9L, "student09");
        User second = user(3L, "student03");
        when(userRepository.findByIdInAndDeletedAtIsNull(List.of(9L, 3L, 8L)))
                .thenReturn(List.of(second, first));

        List<UserService.UserData> result =
                userService.batchGetUsers(List.of(9L, 3L, 9L, 8L));

        assertEquals(List.of(9L, 3L), result.stream().map(UserService.UserData::id).toList());
        verify(userRepository).findByIdInAndDeletedAtIsNull(List.of(9L, 3L, 8L));
    }

    @Test
    void batchGetUsersShouldRequireOneToTwoHundredRawIds() {
        assertThrows(IllegalArgumentException.class, () -> userService.batchGetUsers(List.of()));
        assertThrows(IllegalArgumentException.class, () ->
                userService.batchGetUsers(java.util.Collections.nCopies(201, 1L)));
    }

    @Test
    void getUserShouldRejectInvalidId() {
        assertThrows(IllegalArgumentException.class, () -> userService.getUser(0L));
    }

    private User user(long id, String uid) {
        User user = new User();
        user.setId(id);
        user.setUid(uid);
        user.setName(uid);
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.NORMAL);
        return user;
    }
}
