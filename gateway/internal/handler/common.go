// 百工谱 — handler 公共工具
// 所有 handler 共用的辅助函数集中在此，避免在单个 handler 文件里重复定义

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// userIDFromContext 从 gin context 提取用户 ID
// Auth 中间件已注入 userId/uid（见 middleware.go），此处兼容 JWT 数字的两种解析类型
func userIDFromContext(c *gin.Context) int64 {
	if v, ok := c.Get("userId"); ok {
		if id, ok := v.(int64); ok {
			return id
		}
		if id, ok := v.(float64); ok { // JWT 数字可能被解析为 float64
			return int64(id)
		}
	}
	return 0
}

// grpcErrorToHTTP gRPC 状态码 → HTTP 状态码（错误响应仅返回状态码，不带消息）
func grpcErrorToHTTP(err error) int {
	code := http.StatusInternalServerError
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument:
			code = http.StatusBadRequest
		case codes.Unauthenticated:
			code = http.StatusUnauthorized
		case codes.PermissionDenied, codes.FailedPrecondition:
			code = http.StatusForbidden
		case codes.Unavailable, codes.DeadlineExceeded:
			code = http.StatusServiceUnavailable
		}
	}
	return code
}
