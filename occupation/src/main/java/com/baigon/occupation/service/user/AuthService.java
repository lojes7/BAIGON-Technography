// 百工谱 — 用户认证服务
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    public record AuthResult(Long userId, String uid, String name, String role, String token) {
    }

    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository userRepository, JwtTokenService jwtTokenService) {
        this.userRepository = userRepository;
        this.jwtTokenService = jwtTokenService;
    }

    /** 校验账号密码并签发 JWT。 */
    public AuthResult login(String uid, String password) {
        // 账号不存在与密码错误使用同一结果，避免泄露账号是否存在。
        User user = userRepository.findByUidAndDeletedAtIsNull(uid)
                .orElseThrow(() -> new AuthException(401, "uid or password error"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new AuthException(401, "uid or password error");
        }
        if (user.getStatus() == User.UserStatus.LOCKED) {
            throw new AuthException(403, "your are locked!");
        }

        String token = jwtTokenService.generateToken(user);
        return new AuthResult(user.getId(), user.getUid(), user.getName(),
                user.getRole().name(), token);
    }

    /** 由 gRPC 层转换为稳定状态码的认证异常。 */
    public static class AuthException extends RuntimeException {
        private final int status;

        public AuthException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }
}
