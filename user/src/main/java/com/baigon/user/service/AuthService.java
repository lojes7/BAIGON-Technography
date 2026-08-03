// 百工谱 — 认证服务
// 校验账号密码（bcrypt），签发 JWT
// 注意：本服务只暴露 gRPC 接口，不暴露 HTTP（见 UserGrpcService）

package com.baigon.user.service;

import com.baigon.user.entity.User;
import com.baigon.user.repository.UserRepository;
import com.baigon.user.util.JwtUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    /** 登录结果（不含密码） */
    public record AuthResult(Long userId, String uid, String name, String role, String token) {
    }

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    /** 登录：校验账号密码，成功则返回 JWT 与用户信息 */
    public AuthResult login(String uid, String password) {
        // 账号不存在与密码错误统一返回同一提示，避免泄露账号是否存在
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new AuthException(401, "uid or password error"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new AuthException(401, "uid or password error");
        }

        // 账号锁定状态检查
        if (user.getStatus() == User.UserStatus.LOCKED) {
            throw new AuthException(403, "your are locked!");
        }

        String token = jwtUtil.generateToken(user);
        return new AuthResult(user.getId(), user.getUid(), user.getName(), user.getRole().name(), token);
    }

    /** 认证业务异常，携带 HTTP 状态码与提示信息 */
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
