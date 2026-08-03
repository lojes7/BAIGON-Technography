// 百工谱 — user-service 相关 REST handler
// 网关 REST → gRPC 调用 user-service（user 服务不暴露 HTTP 业务接口）

package handler

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/response"
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
// @Description  校验账号密码，成功返回 JWT Token 和用户信息。
// @Description  统一响应格式：成功 {"code":200,"data":{...}}；失败仅 {"code":<HTTP状态码>}
// @Tags         认证
// @Accept       json
// @Produce      json
// @Param        request body loginRequest true "登录请求"
// @Success      200  {object}  response.SuccessBody  "登录成功，data 内含 token 与 user"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误"
// @Failure      401  {object}  response.ErrorBody    "账号或密码错误"
// @Failure      403  {object}  response.ErrorBody    "账号已被锁定"
// @Failure      503  {object}  response.ErrorBody    "用户服务不可用"
// @Failure      500  {object}  response.ErrorBody    "内部服务错误"
// @Router       /api/login [post]
func LoginHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		if req.Uid == "" || req.Password == "" {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		// 通过 Consul 发现 user-service，走 gRPC 调用
		conn, err := pool.GetConn("user-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		resp, err := userpb.NewUserServiceClient(conn).Login(ctx, &userpb.LoginRequest{
			Uid:      req.Uid,
			Password: req.Password,
		})
		if err != nil {
			// gRPC 状态码 → HTTP 状态码（错误响应仅返回状态码，不带消息）
			code := http.StatusInternalServerError
			if st, ok := status.FromError(err); ok {
				switch st.Code() {
				case codes.Unauthenticated:
					code = http.StatusUnauthorized
				case codes.PermissionDenied:
					code = http.StatusForbidden
				case codes.Unavailable, codes.DeadlineExceeded:
					code = http.StatusServiceUnavailable
				}
			}
			response.Error(c, code, code)
			return
		}

		// 统一响应格式: {"code": 200, "data": {...}}
		response.Success(c, gin.H{
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
