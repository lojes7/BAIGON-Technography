// 百工谱 — 用户认证业务测试
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private static final String PASSWORD = "123456";

    private UserRepository userRepository;
    private JwtTokenService jwtTokenService;
    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        jwtTokenService = mock(JwtTokenService.class);
        authService = new AuthService(userRepository, jwtTokenService);

        user = new User();
        user.setId(7L);
        user.setUid("admin");
        user.setName("管理员");
        user.setPassword(new BCryptPasswordEncoder().encode(PASSWORD));
        user.setRole(User.Role.ADMIN);
        user.setStatus(User.UserStatus.NORMAL);
    }

    @Test
    void loginShouldReturnExistingContractFields() {
        when(userRepository.findByUid("admin")).thenReturn(Optional.of(user));
        when(jwtTokenService.generateToken(user)).thenReturn("jwt-token");

        AuthService.AuthResult result = authService.login("admin", PASSWORD);

        assertEquals(7L, result.userId());
        assertEquals("admin", result.uid());
        assertEquals("管理员", result.name());
        assertEquals("ADMIN", result.role());
        assertEquals("jwt-token", result.token());
        verify(jwtTokenService).generateToken(user);
    }

    @Test
    void loginShouldHideWhetherUidExists() {
        when(userRepository.findByUid("missing")).thenReturn(Optional.empty());

        AuthService.AuthException exception = assertThrows(
                AuthService.AuthException.class,
                () -> authService.login("missing", PASSWORD));

        assertEquals(401, exception.getStatus());
        assertEquals("uid or password error", exception.getMessage());
    }

    @Test
    void loginShouldRejectWrongPasswordWithSameMessage() {
        when(userRepository.findByUid("admin")).thenReturn(Optional.of(user));

        AuthService.AuthException exception = assertThrows(
                AuthService.AuthException.class,
                () -> authService.login("admin", "wrong"));

        assertEquals(401, exception.getStatus());
        assertEquals("uid or password error", exception.getMessage());
    }

    @Test
    void loginShouldRejectLockedUser() {
        user.setStatus(User.UserStatus.LOCKED);
        when(userRepository.findByUid("admin")).thenReturn(Optional.of(user));

        AuthService.AuthException exception = assertThrows(
                AuthService.AuthException.class,
                () -> authService.login("admin", PASSWORD));

        assertEquals(403, exception.getStatus());
    }
}
