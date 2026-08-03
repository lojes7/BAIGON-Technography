// 百工谱 — 认证相关 handler
// 登录通过 gRPC 调用 user-service（user 服务不暴露 HTTP 业务接口）

package proxy

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// loginRequest 登录请求体
type loginRequest struct {
	Uid      string `json:"uid"`
	Password string `json:"password"`
}

// LoginHandler 登录：gateway → user-service gRPC → JWT
func LoginHandler(pool *GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": "请求体格式错误"})
			return
		}
		if req.Uid == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": "uid 和 password 不能为空"})
			return
		}

		// 通过 Consul 发现 user-service，走 gRPC 调用
		conn, err := pool.GetConn("user-service")
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"code": 503, "error": "用户服务不可用"})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		resp, err := userpb.NewUserServiceClient(conn).Login(ctx, &userpb.LoginRequest{
			Uid:      req.Uid,
			Password: req.Password,
		})
		if err != nil {
			// gRPC 状态码 → HTTP 状态码
			code, msg := http.StatusInternalServerError, "登录失败"
			if st, ok := status.FromError(err); ok {
				switch st.Code() {
				case codes.Unauthenticated:
					code, msg = http.StatusUnauthorized, st.Message()
				case codes.PermissionDenied:
					code, msg = http.StatusForbidden, st.Message()
				case codes.Unavailable, codes.DeadlineExceeded:
					code, msg = http.StatusServiceUnavailable, "用户服务不可用"
				}
			}
			c.JSON(code, gin.H{"code": code, "error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": resp.GetToken(),
			"user": gin.H{
				"id":   resp.GetUserId(),
				"uid":  resp.GetUid(),
				"name": resp.GetName(),
				"role": resp.GetRole(),
			},
		})
	}
}
