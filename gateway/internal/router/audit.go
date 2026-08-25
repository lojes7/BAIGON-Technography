// 百工谱 — 审计日志路由注册
package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	audithandler "baigon-technography/gateway/internal/handler/audit"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterAuditLogRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	logs := auth.Group("/audit-logs")
	// 所有登录用户可调用；handler 与 occupation-service 都会把普通用户限定为本人。
	logs.POST("/occupation", audithandler.ListOccupationAuditLogsHandler(pool))

	admin := logs.Group("")
	admin.Use(middleware.RoleAuth("ADMIN"))
	admin.POST("/crawler", audithandler.ListCrawlerAuditLogsHandler(pool))
	admin.POST("/ai", audithandler.ListAIAuditLogsHandler(pool))
}
