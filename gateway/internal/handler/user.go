// 百工谱 — user-service 相关 REST handler
// 网关 REST → gRPC 调用 user-service（user 服务不暴露 HTTP 业务接口）

package handler

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// loginRequest 登录请求体
type loginRequest struct {
	Uid      string `json:"uid" example:"admin"`       // 登录账号
	Password string `json:"password" example:"123456"`  // 密码
}

// LoginHandler 处理用户登录，网关 REST → gRPC 调用 user-service
// @Summary      用户登录
// @Description  校验账号密码，成功返回 JWT Token 和用户信息
// @Tags         认证
// @Accept       json
// @Produce      json
// @Param        request body loginRequest true "登录请求"
// @Success      200  {object}  map[string]interface{}  "登录成功，返回 token 和 user 信息"
// @Failure      400  {object}  map[string]interface{}  "请求体格式错误，uid 和 password 不能为空"
// @Failure      401  {object}  map[string]interface{}  "账号或密码错误"
// @Failure      403  {object}  map[string]interface{}  "账号已被锁定"
// @Failure      503  {object}  map[string]interface{}  "用户服务不可用"
// @Failure      500  {object}  map[string]interface{}  "内部服务错误"
// @Router       /api/login [post]
func LoginHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
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
