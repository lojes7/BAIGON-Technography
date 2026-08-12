// 百工谱 — handler 公共工具
// 所有 handler 共用的辅助函数集中在此，避免在单个 handler 文件里重复定义

package handler

import (
	"fmt"
	"net/http"
	"strconv"

	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// embeddableCatalogItems 显式保留 is_embed=false，避免 protobuf 的 omitempty 丢字段。
func embeddableCatalogItems(items []*occupationpb.EmbeddableCatalogItem) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		result = append(result, gin.H{
			"id": item.GetId(), "code": item.GetCode(), "name": item.GetName(),
			"is_embed": item.GetIsEmbed(),
		})
	}
	return result
}

// embeddingTaskData 将两类任务的统一状态映射成稳定的前端字段。
func embeddingTaskData(status *occupationpb.EmbeddingTaskStatus) gin.H {
	return gin.H{
		"status": status.GetStatus(), "traceId": status.GetTraceId(), "total": status.GetTotal(),
		"processed": status.GetProcessed(), "succeeded": status.GetSucceeded(), "failed": status.GetFailed(),
		"message": status.GetMessage(), "startedAt": status.GetStartedAt(), "finishedAt": status.GetFinishedAt(),
	}
}

// catalogPageQuery 目录列表统一分页搜索参数。
type catalogPageQuery struct {
	Page     int32
	PageSize int32
	Keyword  string
}

// parseCatalogPageQuery 解析 page/pageSize/keyword，并限制单页最多 100 条。
func parseCatalogPageQuery(c *gin.Context) (catalogPageQuery, error) {
	page := 0
	pageSize := 20
	var err error
	if value := c.Query("page"); value != "" {
		page, err = strconv.Atoi(value)
		if err != nil || page < 0 {
			return catalogPageQuery{}, fmt.Errorf("invalid page")
		}
	}
	if value := c.Query("pageSize"); value != "" {
		pageSize, err = strconv.Atoi(value)
		if err != nil || pageSize < 1 || pageSize > 100 {
			return catalogPageQuery{}, fmt.Errorf("invalid pageSize")
		}
	}
	return catalogPageQuery{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Keyword:  c.Query("keyword"),
	}, nil
}

// positiveQueryID 解析目录父级 ID，所有级联查询都要求正整数。
func positiveQueryID(c *gin.Context, name string) (int64, error) {
	value, err := strconv.ParseInt(c.Query(name), 10, 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return value, nil
}

const grpcErrorCodeTrailer = "baigon-error-code"

// userIDFromContext 从 gin context 提取用户 ID
// Auth 中间件已注入 userId/uid（见 middleware.go），此处兼容 JWT 数字的两种解析类型
func userIDFromContext(c *gin.Context) int64 {
	if v, ok := c.Get("userId"); ok {
		if id, ok := v.(int64); ok {
			return id
		}
		if id, ok := v.(float64); ok { // JWT 数字可能被解析为 float64
			return int64(id)
		}
	}
	return 0
}

// grpcErrorCodes 将 gRPC 状态映射为 HTTP 状态，并动态透传可选业务错误码。
// 没有业务码时 errorCode 与 httpCode 相同，不维护业务错误码注册表。
func grpcErrorCodes(err error, trailers ...metadata.MD) (httpCode int, errorCode int) {
	httpCode = http.StatusInternalServerError
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument:
			httpCode = http.StatusBadRequest
		case codes.Unauthenticated:
			httpCode = http.StatusUnauthorized
		case codes.PermissionDenied, codes.FailedPrecondition:
			httpCode = http.StatusForbidden
		case codes.NotFound:
			httpCode = http.StatusNotFound
		case codes.ResourceExhausted:
			httpCode = http.StatusTooManyRequests
		case codes.Unavailable, codes.DeadlineExceeded:
			httpCode = http.StatusServiceUnavailable
		}
	}

	errorCode = httpCode
	if len(trailers) > 0 {
		if values := trailers[0].Get(grpcErrorCodeTrailer); len(values) > 0 {
			if businessCode, parseErr := strconv.Atoi(values[0]); parseErr == nil {
				errorCode = businessCode
			}
		}
	}
	return httpCode, errorCode
}
