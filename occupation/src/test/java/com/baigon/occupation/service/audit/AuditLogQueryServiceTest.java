// 百工谱 — occupation 审计日志分页权限测试
package com.baigon.occupation.service.audit;

import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.audit.AuditLogQueryRepository;
import com.baigon.occupation.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditLogQueryServiceTest {

    private AuditLogQueryRepository logRepository;
    private UserRepository userRepository;
    private AuditLogQueryService service;

    @BeforeEach
    void setUp() {
        logRepository = mock(AuditLogQueryRepository.class);
        userRepository = mock(UserRepository.class);
        service = new AuditLogQueryService(logRepository, userRepository);
    }

    @Test
    void normalUserMustAlwaysQueryOwnLogs() {
        Log log = log(42L, 100L);
        User user = user(100L, User.Role.STUDENT);
        when(logRepository.pagedSearch(
                eq(100L), isNull(), eq(Log.Level.ERROR), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));
        when(userRepository.findAllById(any())).thenReturn(List.of(user));

        var result = service.pagedSearch(
                100L,
                User.Role.STUDENT,
                0,
                20,
                new AuditLogQueryService.SearchCriteria(
                        Log.Level.ERROR, null, null, 999L, User.Role.ADMIN));

        assertEquals(1, result.getTotalElements());
        assertEquals("STUDENT", result.getContent().get(0).userType());
        verify(logRepository).pagedSearch(
                eq(100L), isNull(), eq(Log.Level.ERROR), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void adminCanFilterBySpecificUserAndType() {
        when(logRepository.pagedSearch(
                eq(200L), eq(User.Role.TEACHER), isNull(), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.pagedSearch(
                1L,
                User.Role.ADMIN,
                0,
                0,
                new AuditLogQueryService.SearchCriteria(
                        null, null, null, 200L, User.Role.TEACHER));

        verify(logRepository).pagedSearch(
                eq(200L), eq(User.Role.TEACHER), isNull(), isNull(), isNull(),
                org.mockito.ArgumentMatchers.argThat(pageable -> pageable.getPageSize() == 20));
    }

    @Test
    void invalidRequesterAndPageSizeAreRejected() {
        assertThrows(RuntimeException.class, () -> service.pagedSearch(
                0L, null, 0, 20, AuditLogQueryService.SearchCriteria.empty()));
        assertThrows(IllegalArgumentException.class, () -> service.pagedSearch(
                1L, User.Role.ADMIN, 0, 101, AuditLogQueryService.SearchCriteria.empty()));
    }

    private Log log(long id, long userId) {
        Log log = new Log();
        log.setId(id);
        log.setUserId(userId);
        return log;
    }

    private User user(long id, User.Role role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        return user;
    }
}
