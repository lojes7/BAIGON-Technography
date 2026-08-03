// 百工谱 — 路由注册
// 所有 API 端点定义集中在此文件

package proxy

import (
	"github.com/gin-gonic/gin"
	consulapi "github.com/hashicorp/consul/api"
)

// RegisterRoutes 注册所有 API 路由
func RegisterRoutes(api *gin.RouterGroup, pool *GrpcClientPool, consulClient *consulapi.Client) {
	// ==================== 认证 ====================
	// 登录：gateway 通过 gRPC 调用 user-service（user 服务不暴露 HTTP 业务接口）
	// 注意：Auth 中间件已放行 /auth/* 路径
	api.POST("/auth/login", LoginHandler(pool))

	// ==================== 占位端点 ====================
	// 各模块的接口将在数据库表设计确定后逐一定义
	// 此处只为每个服务预留一个健康探测端点，验证网关能正确转发

	api.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message":  "baigon gateway is running",
			"trace_id": c.GetString("trace_id"),
		})
	})
}
