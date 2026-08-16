// 百工谱 — 通用用户查询业务测试
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.Department;
import com.baigon.occupation.entity.user.School;
import com.baigon.occupation.entity.user.University;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
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
    void getUserShouldMapOrganizationIdsAndNames() {
        University university = new University();
        university.setId(1L);
        university.setName("百工大学");
        School school = new School();
        school.setId(2L);
        school.setName("计算机学院");
        Department department = new Department();
        department.setId(3L);
        department.setName("软件工程系");

        User user = new User();
        user.setId(8L);
        user.setUid("student01");
        user.setName("张三");
        user.setRole(User.Role.STUDENT);
        user.setStatus(User.UserStatus.NORMAL);
        user.setUniversityId(1L);
        user.setSchoolId(2L);
        user.setDepartmentId(3L);
        user.setUniversity(university);
        user.setSchool(school);
        user.setDepartment(department);
        when(userRepository.findByIdAndDeletedAtIsNull(8L)).thenReturn(Optional.of(user));

        UserService.UserData result = userService.getUser(8L).orElseThrow();

        assertEquals(1L, result.universityId());
        assertEquals(2L, result.schoolId());
        assertEquals(3L, result.departmentId());
        assertEquals("百工大学", result.universityName());
        assertEquals("计算机学院", result.schoolName());
        assertEquals("软件工程系", result.departmentName());
    }

    @Test
    void getUserShouldRejectInvalidId() {
        assertThrows(IllegalArgumentException.class, () -> userService.getUser(0L));
    }
}
