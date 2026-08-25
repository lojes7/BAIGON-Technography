// 百工谱 — occupation 审计日志分页权限测试
package com.baigon.occupation.service.audit;

import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.error.ApiException;
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
import static org.mockito.Mockito.verifyNoInteractions;
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
    void normalUserCannotQueryAnyLogs() {
        ApiException exception = assertThrows(ApiException.class, () -> service.pagedSearch(
                100L,
                User.Role.STUDENT,
                0,
                20,
                new AuditLogQueryService.SearchCriteria(
                        Log.Level.ERROR, null, null, 999L, User.Role.ADMIN)));

        assertEquals(ApiException.ErrorCode.FORBIDDEN, exception.getErrorCode());
        verifyNoInteractions(logRepository, userRepository);
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

}
