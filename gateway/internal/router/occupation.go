// 百工谱 — occupation 服务路由注册
package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterOccupationRoutes 注册专业/职业目录、向量化管理和岗位分析审核接口。
func RegisterOccupationRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	occupation := auth.Group("/occupation")

	// DATA_REVIEWER 需要浏览 occupations 全目录，最终选择不受 AI 候选限制。
	catalog := occupation.Group("")
	catalog.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	catalog.GET("/discipline-categories", handler.ListDisciplineCategoriesHandler(pool))
	catalog.GET("/major-categories", handler.ListMajorCategoriesHandler(pool))
	catalog.GET("/majors", handler.ListMajorsHandler(pool))
	catalog.GET("/occupation-major-categories", handler.ListOccupationMajorCategoriesHandler(pool))
	catalog.GET("/occupation-sub-categories", handler.ListOccupationSubCategoriesHandler(pool))
	catalog.GET("/occupation-categories", handler.ListOccupationCategoriesHandler(pool))
	catalog.GET("/occupations", handler.ListOccupationsHandler(pool))
	catalog.GET("/skills", handler.ListSkillsHandler(pool))

	analysis := occupation.Group("/job-analysis")
	analysis.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	analysis.GET("", handler.ListJobAnalysisTasksHandler(pool))
	analysis.GET("/:id", handler.GetJobAnalysisTaskHandler(pool))
	analysis.PUT("/:id/review", handler.ReviewJobAnalysisTaskHandler(pool))

	skillResolution := occupation.Group("/job-skill-resolution")
	skillResolution.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	skillResolution.GET("", handler.ListJobSkillResolutionTasksHandler(pool))
	skillResolution.GET("/:id", handler.GetJobSkillResolutionTaskHandler(pool))
	skillResolution.PUT("/:id/review", handler.ReviewJobSkillResolutionTaskHandler(pool))

	admin := occupation.Group("")
	admin.Use(middleware.RoleAuth("ADMIN"))
	admin.GET("/embedding/progress", handler.GetOccupationEmbeddingProgressHandler(pool))
	admin.POST("/majors/embedding", handler.StartMajorEmbeddingHandler(pool))
	admin.GET("/majors/embedding", handler.GetMajorEmbeddingStatusHandler(pool))
	admin.DELETE("/majors/embedding", handler.StopMajorEmbeddingHandler(pool))

	admin.POST("/occupations/embedding", handler.StartOccupationEmbeddingHandler(pool))
	admin.GET("/occupations/embedding", handler.GetOccupationEmbeddingStatusHandler(pool))
	admin.DELETE("/occupations/embedding", handler.StopOccupationEmbeddingHandler(pool))
}
