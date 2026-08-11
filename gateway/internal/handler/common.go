// 百工谱 — handler 公共工具
// 所有 handler 共用的辅助函数集中在此，避免在单个 handler 文件里重复定义

package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const grpcErrorCodeTrailer = "baigon-error-code"

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

// grpcErrorCodes 将 gRPC 状态映射为 HTTP 状态，并动态透传可选业务错误码。
// 没有业务码时 errorCode 与 httpCode 相同，不维护业务错误码注册表。
func grpcErrorCodes(err error, trailers ...metadata.MD) (httpCode int, errorCode int) {
	httpCode = http.StatusInternalServerError
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument:
			httpCode = http.StatusBadRequest
		case codes.Unauthenticated:
			httpCode = http.StatusUnauthorized
		case codes.PermissionDenied, codes.FailedPrecondition:
			httpCode = http.StatusForbidden
		case codes.NotFound:
			httpCode = http.StatusNotFound
		case codes.ResourceExhausted:
			httpCode = http.StatusTooManyRequests
		case codes.Unavailable, codes.DeadlineExceeded:
			httpCode = http.StatusServiceUnavailable
		}
	}

	errorCode = httpCode
	if len(trailers) > 0 {
		if values := trailers[0].Get(grpcErrorCodeTrailer); len(values) > 0 {
			if businessCode, parseErr := strconv.Atoi(values[0]); parseErr == nil {
				errorCode = businessCode
			}
		}
	}
	return httpCode, errorCode
}
