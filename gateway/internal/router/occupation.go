// 百工谱 — occupation 服务路由注册
package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/handler"
	cataloghandler "baigon-technography/gateway/internal/handler/catalog"
	jobanalysishandler "baigon-technography/gateway/internal/handler/jobanalysis"
	skillhandler "baigon-technography/gateway/internal/handler/skill"
	skillgraphhandler "baigon-technography/gateway/internal/handler/skillgraph"
	skillresolutionhandler "baigon-technography/gateway/internal/handler/skillresolution"
	"baigon-technography/gateway/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterOccupationRoutes 注册专业/职业/技能目录、向量化管理和岗位分析审核接口。
func RegisterOccupationRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	occupation := auth.Group("/occupation")
	// 岗位能力图谱面向所有登录角色，允许按已知 ID 批量解析规范技能名称。
	occupation.POST("/skills/lookup", skillhandler.LookupSkillsHandler(pool))
	// 图谱浏览面向全部登录角色；职业、专业选择也允许跨目录搜索。
	occupation.GET("/majors", handler.ListMajorsHandler(pool))
	occupation.POST("/majors/lookup", cataloghandler.LookupMajorsHandler(pool))
	occupation.GET("/majors/:id", cataloghandler.GetMajorHandler(pool))
	occupation.GET("/occupations", handler.ListOccupationsHandler(pool))
	occupation.POST("/occupations/lookup", cataloghandler.LookupOccupationsHandler(pool))
	occupation.GET("/occupations/:id", cataloghandler.GetOccupationHandler(pool))
	occupation.GET("/majors/:id/skill-graph", skillgraphhandler.MajorSkillGraphHandler(pool))
	occupation.GET("/occupations/:id/skill-graph", skillgraphhandler.OccupationSkillGraphHandler(pool))
	occupation.POST("/majors/:id/skill-graph/skills/lookup", skillgraphhandler.MajorSkillGraphMetricsHandler(pool))
	occupation.POST("/occupations/:id/skill-graph/skills/lookup", skillgraphhandler.OccupationSkillGraphMetricsHandler(pool))
	occupation.GET("/majors/:id/skill-graph/skills/:skillId/evidence", skillgraphhandler.MajorSkillGraphEvidenceHandler(pool))
	occupation.GET("/occupations/:id/skill-graph/skills/:skillId/evidence", skillgraphhandler.OccupationSkillGraphEvidenceHandler(pool))

	// DATA_REVIEWER 需要浏览 occupations 全目录，最终选择不受 AI 候选限制。
	catalog := occupation.Group("")
	catalog.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	catalog.GET("/discipline-categories", handler.ListDisciplineCategoriesHandler(pool))
	catalog.POST("/discipline-categories/lookup", cataloghandler.LookupDisciplineCategoriesHandler(pool))
	catalog.GET("/discipline-categories/:id", cataloghandler.GetDisciplineCategoryHandler(pool))
	catalog.GET("/major-categories", handler.ListMajorCategoriesHandler(pool))
	catalog.POST("/major-categories/lookup", cataloghandler.LookupMajorCategoriesHandler(pool))
	catalog.GET("/major-categories/:id", cataloghandler.GetMajorCategoryHandler(pool))
	catalog.GET("/occupation-major-categories", handler.ListOccupationMajorCategoriesHandler(pool))
	catalog.POST("/occupation-major-categories/lookup", cataloghandler.LookupOccupationMajorCategoriesHandler(pool))
	catalog.GET("/occupation-major-categories/:id", cataloghandler.GetOccupationMajorCategoryHandler(pool))
	catalog.GET("/occupation-sub-categories", handler.ListOccupationSubCategoriesHandler(pool))
	catalog.POST("/occupation-sub-categories/lookup", cataloghandler.LookupOccupationSubCategoriesHandler(pool))
	catalog.GET("/occupation-sub-categories/:id", cataloghandler.GetOccupationSubCategoryHandler(pool))
	catalog.GET("/occupation-categories", handler.ListOccupationCategoriesHandler(pool))
	catalog.POST("/occupation-categories/lookup", cataloghandler.LookupOccupationCategoriesHandler(pool))
	catalog.GET("/occupation-categories/:id", cataloghandler.GetOccupationCategoryHandler(pool))
	catalog.GET("/skills", handler.ListSkillsHandler(pool))
	catalog.GET("/skills/:id", skillhandler.GetSkillHandler(pool))
	catalog.GET("/skills/:id/relations", skillhandler.GetSkillRelationsHandler(pool))

	analysis := occupation.Group("/job-analysis")
	analysis.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	analysis.GET("", jobanalysishandler.ListTasksHandler(pool))
	analysis.POST("/lookup", jobanalysishandler.LookupTasksHandler(pool))
	analysis.POST("/occupation-candidates/lookup", jobanalysishandler.LookupOccupationCandidatesHandler(pool))
	analysis.GET("/occupation-candidates/:id", jobanalysishandler.GetOccupationCandidateHandler(pool))
	analysis.POST("/major-candidates/lookup", jobanalysishandler.LookupMajorCandidatesHandler(pool))
	analysis.GET("/major-candidates/:id", jobanalysishandler.GetMajorCandidateHandler(pool))
	analysis.POST("/results/lookup", jobanalysishandler.LookupResultsHandler(pool))
	analysis.GET("/results/:id", jobanalysishandler.GetResultHandler(pool))
	analysis.GET("/:id", jobanalysishandler.GetTaskHandler(pool))
	analysis.PUT("/:id/review", jobanalysishandler.ReviewTaskHandler(pool))

	skillResolution := occupation.Group("/job-skill-resolution")
	skillResolution.Use(middleware.RoleAuth("ADMIN", "DATA_REVIEWER"))
	skillResolution.GET("", skillresolutionhandler.ListTasksHandler(pool))
	skillResolution.POST("/lookup", skillresolutionhandler.LookupTasksHandler(pool))
	skillResolution.POST("/candidates/lookup", skillresolutionhandler.LookupCandidatesHandler(pool))
	skillResolution.GET("/candidates/:id", skillresolutionhandler.GetCandidateHandler(pool))
	skillResolution.GET("/:id/similar-skills", skillresolutionhandler.ListSimilarSkillsHandler(pool))
	skillResolution.GET("/:id", skillresolutionhandler.GetTaskHandler(pool))
	skillResolution.PUT("/:id/review", skillresolutionhandler.ReviewTaskHandler(pool))

	admin := occupation.Group("")
	admin.Use(middleware.RoleAuth("ADMIN"))
	admin.GET("/embedding/progress", handler.GetOccupationEmbeddingProgressHandler(pool))
	admin.POST("/majors/embedding", handler.StartMajorEmbeddingHandler(pool))
	admin.GET("/majors/embedding", handler.GetMajorEmbeddingStatusHandler(pool))
	admin.DELETE("/majors/embedding", handler.StopMajorEmbeddingHandler(pool))

	admin.POST("/occupations/embedding", handler.StartOccupationEmbeddingHandler(pool))
	admin.GET("/occupations/embedding", handler.GetOccupationEmbeddingStatusHandler(pool))
	admin.DELETE("/occupations/embedding", handler.StopOccupationEmbeddingHandler(pool))

	admin.POST("/skills/embedding", handler.StartSkillEmbeddingHandler(pool))
	admin.GET("/skills/embedding", handler.GetSkillEmbeddingStatusHandler(pool))
	admin.DELETE("/skills/embedding", handler.StopSkillEmbeddingHandler(pool))
	admin.POST("/skills/:id/relations/:direction", skillhandler.AddSkillRelationHandler(pool))
	admin.DELETE("/skills/:id/relations/:direction/:relatedId", skillhandler.DeleteSkillRelationHandler(pool))
}
