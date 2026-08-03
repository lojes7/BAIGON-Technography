// 百工谱 — 统一响应格式
// 所有 API 响应必须遵循以下结构：
//   成功: {"code": 200, "data": {...}}
//   失败: {"code": <HTTP状态码>}
// code 字段始终与 HTTP 状态码一致；错误响应不携带消息

package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Success 成功响应: HTTP 200 + {"code": 200, "data": <业务数据>}
func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "data": data})
}

// Error 错误响应: {"code": <HTTP状态码>}，不携带消息
// httpCode 同时作为 HTTP 状态码与响应体中的 code
func Error(c *gin.Context, httpCode int) {
	c.JSON(httpCode, gin.H{"code": httpCode})
}

// 以下结构体仅用于 Swagger 文档标注，非实际构造响应的类型

// SuccessBody 成功响应体结构（Swagger 文档用）
type SuccessBody struct {
	Code int `json:"code" example:"200"` // 状态码，恒为 200
	Data any `json:"data"`               // 业务数据
}

// ErrorBody 错误响应体结构（Swagger 文档用）
type ErrorBody struct {
	Code int `json:"code" example:"401"` // HTTP 状态码，不含消息
}
