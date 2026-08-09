// 百工谱 — crawler 服务路由注册
// 鉴权约定：爬虫端点需登录（Auth 验 JWT）且仅 ADMIN 可访问（RoleAuth 验角色）

package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterCrawlerRoutes 注册 crawler 相关路由
func RegisterCrawlerRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	// ==================== 受保护端点（需登录 + ADMIN 角色） ====================
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	// ==================== 爬虫服务端点 ====================
	crawl := auth.Group("/crawl")
	crawl.Use(middleware.RoleAuth("ADMIN"))

	// 启动爬虫
	crawl.POST("", handler.StartCrawlHandler(pool))
	// 获取爬虫服务状态
	crawl.GET("", handler.GetCrawlStatusHandler(pool))
	// 停止爬虫
	crawl.DELETE("", handler.StopCrawlHandler(pool))
	// 模拟采集：注入配置数据走完整链路（不真爬）
	crawl.POST("/ingest", handler.IngestDataHandler(pool))
}
