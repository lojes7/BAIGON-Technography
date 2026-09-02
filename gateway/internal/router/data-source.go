// 百工谱 — data-source 服务路由注册
// 鉴权约定：清洗数据查询与复核需登录（Auth 验 JWT）且 ADMIN / DATA_REVIEWER 可访问

package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterDataSourceRoutes 注册数据治理相关路由
func RegisterDataSourceRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	// ========= 受保护端点（需登录 + ADMIN / DATA_REVIEWER 角色） ===========
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	// ==================== 数据源服务端点 ====================
	data := auth.Group("/data-source")
	data.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))

	// 展示所有 cleaned_job_source（分页查询，POST + body 携带筛选条件）
	// 列表仅返回 ID 与分页元数据，展示信息由 lookup 批量解析。
	// 支持按照是否复核，发布时间进行筛选查询
	data.POST("", handler.ListCleanedJobsHandler(pool))
	// 列表只返回 ID；当前页展示字段由批量详情接口补齐。
	data.POST("/lookup", handler.BatchGetCleanedJobsHandler(pool))

	// 查看某条 cleaned_job_source 的详细信息
	// 返回所有字段
	data.GET("/:id", handler.GetCleanedJobHandler(pool))

	// 查看某条 cleaned_job_source 的原始记录（job_sources 表，经 crawler-service 查询）
	data.GET("/:id/source", handler.GetSourceJobHandler(pool))

	// 复核通过
	data.POST("/:id/review", handler.ApproveReviewHandler(pool))

	// 复核被拒绝
	data.DELETE("/:id/review", handler.RejectReviewHandler(pool))

	// 修改某些数据之后通过复核
	data.PUT("/:id/review", handler.EditReviewHandler(pool))
}
