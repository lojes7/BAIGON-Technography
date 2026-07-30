// 百工谱 — GIN 中间件集合

package middleware

import (
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestID 为每个请求注入唯一 trace_id
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}
		c.Set("trace_id", traceID)
		c.Header("X-Trace-ID", traceID)
		c.Next()
	}
}

// Logger 请求日志中间件
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		log.Printf("[%s] %s %s %d %v",
			c.GetString("trace_id"),
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			duration,
		)
	}
}

// CORS 跨域配置
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Trace-ID")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// Auth JWT Token 验证中间件（桩实现）
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过登录和注册接口
		path := c.Request.URL.Path
		if strings.Contains(path, "/auth/login") || strings.Contains(path, "/auth/register") {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌", "code": 401})
			c.Abort()
			return
		}

		// TODO: 实现 JWT 验证逻辑
		// token := strings.TrimPrefix(authHeader, "Bearer ")
		// claims, err := jwt.Parse(token, jwtSecret)

		// 桩：暂时放行所有请求
		c.Next()
	}
}

// ==================== 限流器 ====================

// RateLimit token bucket 限流中间件
func RateLimit(rate int, per time.Duration) gin.HandlerFunc {
	limiter := newTokenBucketLimiter(rate, per)
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "请求过于频繁，请稍后再试",
				"code":  429,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// tokenBucketLimiter 简单的基于IP的令牌桶限流器
type tokenBucketLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	rate    int
	per     time.Duration
}

type tokenBucket struct {
	tokens   float64
	lastTime time.Time
}

func newTokenBucketLimiter(rate int, per time.Duration) *tokenBucketLimiter {
	return &tokenBucketLimiter{
		buckets: make(map[string]*tokenBucket),
		rate:    rate,
		per:     per,
	}
}

func (l *tokenBucketLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		l.buckets[key] = &tokenBucket{tokens: float64(l.rate) - 1, lastTime: time.Now()}
		// 清理过期的桶
		if len(l.buckets) > 10000 {
			l.buckets = make(map[string]*tokenBucket)
		}
		return true
	}

	// 补充令牌
	elapsed := time.Since(b.lastTime).Seconds()
	b.tokens += elapsed * (float64(l.rate) / l.per.Seconds())
	if b.tokens > float64(l.rate) {
		b.tokens = float64(l.rate)
	}
	b.lastTime = time.Now()

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}
