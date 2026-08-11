// 百工谱 — 统一响应格式
// 所有 API 响应必须遵循以下结构：
//   成功: {"code": 200, "data": {...}}
//   失败: {"code": <标准或业务错误码>}
// 无自定义业务码时 code 与 HTTP 状态码一致；错误响应不携带消息。

package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Success 成功响应: HTTP 200 + {"code": 200, "data": <业务数据>}
func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"code": http.StatusOK, "data": data})
}

// Error 错误响应：HTTP 状态与响应体业务码分别传入，不携带消息。
func Error(c *gin.Context, httpCode int, errorCode int) {
	c.JSON(httpCode, gin.H{"code": errorCode})
}

// 以下结构体仅用于 Swagger 文档标注，非实际构造响应的类型

// SuccessBody 成功响应体结构（Swagger 文档用）
type SuccessBody struct {
	Code int `json:"code" example:"200"` // 状态码，恒为 200
	Data any `json:"data"`               // 业务数据
}

// ErrorBody 错误响应体结构（Swagger 文档用，可能是 HTTP 状态码或业务错误码）
type ErrorBody struct {
	Code int `json:"code" example:"40301"` // 标准错误码或业务错误码，不含消息
}
