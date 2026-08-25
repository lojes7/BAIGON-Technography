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
	// 审计日志属于系统管理数据，三个来源统一只允许 ADMIN 访问。
	logs.Use(middleware.RoleAuth("ADMIN"))
	logs.POST("/occupation", audithandler.ListOccupationAuditLogsHandler(pool))
	logs.POST("/crawler", audithandler.ListCrawlerAuditLogsHandler(pool))
	logs.POST("/ai", audithandler.ListAIAuditLogsHandler(pool))
}
