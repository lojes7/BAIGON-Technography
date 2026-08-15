// 百工谱 — JWT 兼容性测试
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenServiceTest {

    private static final String SECRET =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    void generatedTokenShouldKeepGatewayClaims() {
        User user = new User();
        user.setId(7L);
        user.setUid("admin");
        user.setRole(User.Role.ADMIN);
        JwtTokenService service = new JwtTokenService(SECRET, 2L);

        String token = service.generateToken(user);

        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        assertEquals("admin", claims.getSubject());
        assertEquals(7L, ((Number) claims.get("userId")).longValue());
        assertEquals("ADMIN", claims.get("role"));
        long lifetime = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
        assertTrue(Math.abs(lifetime - 2 * 3600_000L) < 1000L);
    }
}
