// 百工谱 — 用户域 JWT 签发服务
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtTokenService {

    private final SecretKey key;
    private final long expirationMillis;

    public JwtTokenService(@Value("${jwt.secret}") String secret,
                           @Value("${jwt.expiration-hours:1}") long expirationHours) {
        // HMAC 密钥必须至少为 32 字节，配置错误时让服务启动直接失败。
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationHours * 3600_000L;
    }

    /** 签发与 gateway 现有鉴权逻辑兼容的 token。 */
    public String generateToken(User user) {
        Date now = new Date();
        return Jwts.builder()
                .subject(user.getUid())
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMillis))
                .signWith(key)
                .compact();
    }
}
