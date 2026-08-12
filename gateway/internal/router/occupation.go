// 百工谱 — occupation 服务路由注册
package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterOccupationRoutes 注册专业/职业目录与向量化管理接口，全部仅限 ADMIN。
func RegisterOccupationRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	occupation := auth.Group("/occupation")
	occupation.Use(middleware.RoleAuth("ADMIN"))

	occupation.GET("/discipline-categories", handler.ListDisciplineCategoriesHandler(pool))
	occupation.GET("/major-categories", handler.ListMajorCategoriesHandler(pool))
	occupation.GET("/majors", handler.ListMajorsHandler(pool))
	occupation.GET("/occupation-major-categories", handler.ListOccupationMajorCategoriesHandler(pool))
	occupation.GET("/occupation-sub-categories", handler.ListOccupationSubCategoriesHandler(pool))
	occupation.GET("/occupation-categories", handler.ListOccupationCategoriesHandler(pool))
	occupation.GET("/occupations", handler.ListOccupationsHandler(pool))

	occupation.GET("/embedding/progress", handler.GetOccupationEmbeddingProgressHandler(pool))

	occupation.POST("/majors/embedding", handler.StartMajorEmbeddingHandler(pool))
	occupation.GET("/majors/embedding", handler.GetMajorEmbeddingStatusHandler(pool))
	occupation.DELETE("/majors/embedding", handler.StopMajorEmbeddingHandler(pool))

	occupation.POST("/occupations/embedding", handler.StartOccupationEmbeddingHandler(pool))
	occupation.GET("/occupations/embedding", handler.GetOccupationEmbeddingStatusHandler(pool))
	occupation.DELETE("/occupations/embedding", handler.StopOccupationEmbeddingHandler(pool))
}
