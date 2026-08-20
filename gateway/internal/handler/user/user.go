// 百工谱 — 当前用户资料 REST handler

package user

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// loginRequest 登录请求体
type loginRequest struct {
	Uid      string `json:"uid" example:"admin"`       // 登录账号
	Password string `json:"password" example:"123456"` // 密码
}

// LoginHandler 处理用户登录，网关 REST → gRPC 调用 UserService
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

		// 用户域已物理并入 occupation-service，protobuf 契约保持不变。
		conn, err := pool.GetConn("occupation-service")
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
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
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


// GetCurrentUserHandler 根据 JWT 中的用户 ID 查询当前用户资料。
// @Summary      查询当前用户资料
// @Tags         认证
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody "data 为当前用户及扁平组织字段"
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/me [get]
func GetCurrentUserHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).GetUser(
			ctx,
			&userpb.GetUserRequest{
				Id: userID, TraceId: c.GetString("trace_id"),
				UserId: userID, UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		user := result.GetUser()
		if user == nil {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, userData(user))
	}
}
