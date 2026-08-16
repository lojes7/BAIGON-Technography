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
