// 百工谱 — handler 公共工具
// 所有 handler 共用的辅助函数集中在此，避免在单个 handler 文件里重复定义

package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// CanonicalSkillData 将单个规范技能映射为技能列表与详情共用的稳定字段。
func CanonicalSkillData(item *occupationpb.SkillData) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{
		"id": item.GetId(), "name": item.GetName(), "isEmbed": item.GetIsEmbed(),
	}
}

// embeddingTaskData 将三类任务的统一状态映射成稳定的前端字段。
func embeddingTaskData(status *occupationpb.EmbeddingTaskStatus) gin.H {
	return gin.H{
		"id": status.GetTraceId(), "status": status.GetStatus(), "total": status.GetTotal(),
		"processed": status.GetProcessed(), "succeeded": status.GetSucceeded(), "failed": status.GetFailed(),
		"message": status.GetMessage(), "startedAt": status.GetStartedAt(), "finishedAt": status.GetFinishedAt(),
	}
}

// embeddingCommandData 仅返回本次启动或停止命令关联的追踪 ID。
func embeddingCommandData(status *occupationpb.EmbeddingTaskStatus) gin.H {
	return gin.H{"id": status.GetTraceId()}
}

// CatalogPageQuery 目录列表统一分页搜索参数。
type CatalogPageQuery struct {
	Page     int32
	PageSize int32
	Keyword  string
}

// ParseCatalogPageQuery 解析 page/pageSize/keyword，并限制单页最多 100 条。
func ParseCatalogPageQuery(c *gin.Context) (CatalogPageQuery, error) {
	page := 0
	pageSize := 20
	var err error
	if value := c.Query("page"); value != "" {
		page, err = strconv.Atoi(value)
		if err != nil || page < 0 {
			return CatalogPageQuery{}, fmt.Errorf("invalid page")
		}
	}
	if value := c.Query("pageSize"); value != "" {
		pageSize, err = strconv.Atoi(value)
		if err != nil || pageSize < 1 || pageSize > 100 {
			return CatalogPageQuery{}, fmt.Errorf("invalid pageSize")
		}
	}
	return CatalogPageQuery{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Keyword:  c.Query("keyword"),
	}, nil
}

// PositiveQueryID 解析目录父级 ID，所有级联查询都要求正整数。
func PositiveQueryID(c *gin.Context, name string) (int64, error) {
	value, err := strconv.ParseInt(c.Query(name), 10, 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return value, nil
}

// OptionalPositiveQueryID 解析 ID；未传返回 0，传入时必须为正整数。
func OptionalPositiveQueryID(c *gin.Context, name string) (int64, error) {
	value := c.Query(name)
	if value == "" {
		return 0, nil
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return id, nil
}

// PositivePathID 解析路径中的雪花 ID，要求为正整数。
func PositivePathID(c *gin.Context, name string) (int64, error) {
	value, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return value, nil
}

// SkillGraphQuery 技能图谱按自然月过滤；toMonth 是不包含的上界。
type SkillGraphQuery struct {
	FromMonth string
	ToMonth   string
}

// ParseSkillGraphQuery 校验技能图谱的 YYYY-MM 半开时间窗。
func ParseSkillGraphQuery(c *gin.Context) (SkillGraphQuery, error) {
	fromMonth := c.Query("fromMonth")
	toMonth := c.Query("toMonth")
	from, err := parseOptionalMonth(fromMonth, "fromMonth")
	if err != nil {
		return SkillGraphQuery{}, err
	}
	to, err := parseOptionalMonth(toMonth, "toMonth")
	if err != nil {
		return SkillGraphQuery{}, err
	}
	if !from.IsZero() && !to.IsZero() && !from.Before(to) {
		return SkillGraphQuery{}, fmt.Errorf("fromMonth must be before toMonth")
	}

	return SkillGraphQuery{
		FromMonth: fromMonth, ToMonth: toMonth,
	}, nil
}

func parseOptionalMonth(value string, field string) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	parsed, err := time.Parse("2006-01", value)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid %s", field)
	}
	return parsed, nil
}

const grpcErrorCodeTrailer = "baigon-error-code"

// UserIDFromContext 从 gin context 提取用户 ID
// Auth 中间件已注入 userId/uid（见 middleware.go），此处兼容 JWT 数字的两种解析类型
func UserIDFromContext(c *gin.Context) int64 {
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

// GRPCErrorCodes 将 gRPC 状态映射为 HTTP 状态，并动态透传可选业务错误码。
// 没有业务码时 errorCode 与 httpCode 相同，不维护业务错误码注册表。
func GRPCErrorCodes(err error, trailers ...metadata.MD) (httpCode int, errorCode int) {
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
		case codes.AlreadyExists, codes.Aborted:
			httpCode = http.StatusConflict
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
