// 百工谱 — 用户域路由注册
// 鉴权约定：公开端点直接挂 api group；受保护端点必须挂 auth group（Auth 中间件）
// 注意：Auth 中间件不再使用路径白名单，新增端点请显式声明是否需要鉴权

package router

import (
	"baigon-technography/gateway/internal/grpcpool"
	userhandler "baigon-technography/gateway/internal/handler/user"
	"baigon-technography/gateway/internal/middleware"
	"baigon-technography/gateway/internal/response"

	"github.com/gin-gonic/gin"
)

// RegisterUserRoutes 注册用户域相关路由。
func RegisterUserRoutes(api *gin.RouterGroup, pool *grpcpool.GrpcClientPool, jwtSecret string) {
	// ==================== 公开端点（免鉴权） ====================
	// 登录：gateway 调用 occupation 合并服务中的 UserService。
	api.POST("/login", userhandler.LoginHandler(pool))
	// Ping 心跳探测。
	api.GET("/ping", PingHandler())

	// ==================== 受保护端点（需 Bearer Token） ====================
	auth := api.Group("/auth")
	auth.Use(middleware.Auth(jwtSecret))

	auth.GET("/me", userhandler.GetCurrentUserHandler(pool))

	// 用户功能。
	auth.POST("/resumes/upload-url", userhandler.CreateResumeUploadHandler(pool))
	auth.POST("/resumes/upload-complete", userhandler.CompleteResumeUploadHandler(pool))
	auth.GET("/resumes", userhandler.GetMyResumeHandler(pool))
	auth.PUT("/resumes", userhandler.EditMyResumeHandler(pool))
	auth.POST("/resumes/analyze-skills", userhandler.AnalyzeMyResumeSkillsHandler(pool))
	auth.GET("/me/skills", userhandler.ListMySkillsHandler(pool))
	auth.POST("/me/skills/lookup", userhandler.BatchGetMySkillsHandler(pool))
	auth.GET("/me/skills/:id", userhandler.GetMySkillHandler(pool))

	// 管理员接口。
	admin := auth.Group("/users")
	admin.Use(middleware.RoleAuth("ADMIN"))
	admin.POST("", userhandler.ListUsersHandler(pool))
	admin.GET("/universities", userhandler.ListUniversitiesHandler(pool))
	admin.POST("/universities/lookup", userhandler.BatchGetUniversitiesHandler(pool))
	admin.GET("/schools", userhandler.ListSchoolsHandler(pool))
	admin.POST("/schools/lookup", userhandler.BatchGetSchoolsHandler(pool))
	admin.GET("/departments", userhandler.ListDepartmentsHandler(pool))
	admin.POST("/departments/lookup", userhandler.BatchGetDepartmentsHandler(pool))
	admin.POST("/lookup", userhandler.BatchGetUsersHandler(pool))
	admin.GET("/:id", userhandler.GetUserHandler(pool))
	admin.POST("/:id/block", userhandler.BlockUserHandler(pool))
	admin.POST("/:id/unlock", userhandler.UnlockUserHandler(pool))
}

// PingHandler 网关心跳探测。
// @Summary      网关 Ping
// @Description  返回网关运行状态和 traceId（免鉴权）。
// @Description  统一响应格式：成功 {"code":200,"data":{...}}
// @Tags         系统
// @Produce      json
// @Success      200  {object}  response.SuccessBody{data=response.PingData}  "网关运行正常，data 内含 message 与 traceId"
// @Router       /api/ping [get]
func PingHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 统一响应格式: {"code": 200, "data": {...}}
		response.Success(c, gin.H{
			"message": "baigon gateway is running",
			"traceId": c.GetString("trace_id"),
		})
	}
}
