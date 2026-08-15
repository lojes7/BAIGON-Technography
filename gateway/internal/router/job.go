// 百工谱 — 已审核岗位查询路由注册
package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	jobhandler "baigon-technography/gateway/internal/handler/job"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterJobRoutes 注册所有已登录用户可访问的岗位列表与详情接口。
func RegisterJobRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	jobs := api.Group("/jobs")
	jobs.Use(middleware.Auth(jwtSecret))
	jobs.POST("", jobhandler.ListJobsHandler(pool))
	jobs.GET("/:id", jobhandler.GetJobHandler(pool))
}
