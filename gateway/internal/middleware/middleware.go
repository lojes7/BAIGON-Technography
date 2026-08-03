// 百工谱 — GIN 中间件集合

package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"baigon-technography/gateway/internal/response"
)

// 进程内单例雪花节点：trace_id 用 snowflake 数字，
// workerId 从环境变量 SNOWFLAKE_WORKER_ID 注入（每服务实例唯一）
var traceIDNode = newSnowflakeNode()

func newSnowflakeNode() *snowflake.Node {
	workerID, err := strconv.ParseInt(os.Getenv("SNOWFLAKE_WORKER_ID"), 10, 64)
	if err != nil || workerID < 0 {
		workerID = 0
	}
	// 自定义纪元 2024-01-01 00:00:00 UTC（与 Java/Python 端一致）
	// bwmarrin 默认 10bit workerId（0-1023）
	snowflake.Epoch = 1704067200000
	node, err := snowflake.NewNode(workerID)
	if err != nil {
		node, _ = snowflake.NewNode(0)
	}
	return node
}

// RequestID 为每个请求注入唯一 trace_id（雪花 ID）
// 上游已带 X-Trace-ID 时透传（保证全链路同一 trace_id）
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = traceIDNode.Generate().String()
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

// Auth JWT Token 验证中间件
// 与 user 服务共用同一把 JWT_SECRET 验签；验证通过后
// 把 uid / userId / role 注入请求上下文，供下游 handler 使用
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized)
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader { // 没有 Bearer 前缀
			response.Error(c, http.StatusUnauthorized)
			c.Abort()
			return
		}

		// 解析并验证签名与过期时间
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			// 防算法混淆：只接受 HMAC 系列（user 服务用 HS512 签发）
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			response.Error(c, http.StatusUnauthorized)
			c.Abort()
			return
		}

		// 提取 claims 注入上下文
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("uid", claims["sub"])
			c.Set("userId", claims["userId"])
			c.Set("role", claims["role"])
		}

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
			response.Error(c, http.StatusTooManyRequests)
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
