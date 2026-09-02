// 百工谱 — 审计日志 REST → gRPC handler
package audit

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	aipb "baigon-technography/gateway/pb/aipb"
	commonpb "baigon-technography/gateway/pb/commonpb"
	crawlerpb "baigon-technography/gateway/pb/crawlerpb"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type source string

const (
	sourceOccupation source = "occupation"
	sourceCrawler    source = "crawler"
	sourceAI         source = "ai"
)

type pagedSearchRequest struct {
	Page          int32  `json:"page" example:"0"`
	PageSize      int32  `json:"pageSize" example:"20"`
	Level         string `json:"level" example:"INFO"`
	CreatedAtFrom string `json:"createdAtFrom" example:"2026-08-01T00:00:00+08:00"`
	CreatedAtTo   string `json:"createdAtTo" example:"2026-08-31T23:59:59+08:00"`
	TargetUserID  int64  `json:"targetUserId" example:"123"`
	UserType      string `json:"userType" example:"STUDENT"`
}

type batchDetailRequest struct {
	IDs []int64 `json:"ids" binding:"required"`
}

// ListOccupationAuditLogsHandler 分页查询 occupation 日志。
// @Summary      分页查询 occupation 审计日志
// @Description  仅 ADMIN 可按用户类型、具体用户、时间和级别查询。
// @Tags         审计日志
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body pagedSearchRequest true "分页与筛选条件"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/audit-logs/occupation [post]
func ListOccupationAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return pagedSearchHandler(pool, sourceOccupation)
}

// ListCrawlerAuditLogsHandler 分页查询 crawler 日志。
// @Summary      ADMIN 分页查询 crawler 审计日志
// @Tags         审计日志
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body pagedSearchRequest true "分页、时间与级别条件"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/audit-logs/crawler [post]
func ListCrawlerAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return pagedSearchHandler(pool, sourceCrawler)
}

// ListAIAuditLogsHandler 分页查询 AI 日志。
// @Summary      ADMIN 分页查询 AI 脱敏审计日志
// @Tags         审计日志
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body pagedSearchRequest true "分页、时间与级别条件"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/audit-logs/ai [post]
func ListAIAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return pagedSearchHandler(pool, sourceAI)
}

// BatchGetOccupationAuditLogsHandler 批量查询 occupation 日志详情。
// @Summary 批量查询 occupation 审计日志
// @Tags 审计日志
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchDetailRequest true "1 至 200 个日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogLookupData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Router /api/auth/audit-logs/occupation/lookup [post]
func BatchGetOccupationAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return batchDetailHandler(pool, sourceOccupation)
}

// BatchGetCrawlerAuditLogsHandler 批量查询 crawler 日志详情。
// @Summary 批量查询 crawler 审计日志
// @Tags 审计日志
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchDetailRequest true "1 至 200 个日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogLookupData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Router /api/auth/audit-logs/crawler/lookup [post]
func BatchGetCrawlerAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return batchDetailHandler(pool, sourceCrawler)
}

// BatchGetAIAuditLogsHandler 批量查询 AI 日志详情。
// @Summary 批量查询 AI 审计日志
// @Tags 审计日志
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchDetailRequest true "1 至 200 个日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogLookupData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Router /api/auth/audit-logs/ai/lookup [post]
func BatchGetAIAuditLogsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return batchDetailHandler(pool, sourceAI)
}

// GetOccupationAuditLogHandler 查询 occupation 日志详情。
// @Summary 查询 occupation 审计日志详情
// @Tags 审计日志
// @Produce json
// @Security Bearer
// @Param id path int true "日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/audit-logs/occupation/{id} [get]
func GetOccupationAuditLogHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return detailHandler(pool, sourceOccupation)
}

// GetCrawlerAuditLogHandler 查询 crawler 日志详情。
// @Summary 查询 crawler 审计日志详情
// @Tags 审计日志
// @Produce json
// @Security Bearer
// @Param id path int true "日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/audit-logs/crawler/{id} [get]
func GetCrawlerAuditLogHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return detailHandler(pool, sourceCrawler)
}

// GetAIAuditLogHandler 查询 AI 日志详情。
// @Summary 查询 AI 审计日志详情
// @Tags 审计日志
// @Produce json
// @Security Bearer
// @Param id path int true "日志 ID"
// @Success 200 {object} response.SuccessBody{data=audit.LogData}
// @Failure 400 {object} response.ErrorBody
// @Failure 403 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/audit-logs/ai/{id} [get]
func GetAIAuditLogHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return detailHandler(pool, sourceAI)
}

func pagedSearchHandler(pool grpcpool.ConnectionProvider, logSource source) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 || role == "" {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}
		if role != "ADMIN" {
			// 即使路由被误注册或 handler 被直接调用，也不允许普通用户读取日志。
			response.Error(c, http.StatusForbidden, http.StatusForbidden)
			return
		}

		var request pagedSearchRequest
		if err := c.ShouldBindJSON(&request); err != nil || !validRequest(&request) {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		if logSource != sourceOccupation {
			request.TargetUserID = 0
			request.UserType = ""
		}

		conn, err := pool.GetConn(serviceName(logSource))
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		grpcRequest := &commonpb.PagedSearchAuditLogsRequest{
			Page: request.Page, PageSize: request.PageSize,
			Level: request.Level, CreatedAtFrom: request.CreatedAtFrom, CreatedAtTo: request.CreatedAtTo,
			TargetUserId: request.TargetUserID, UserType: request.UserType,
			TraceId: c.GetString("trace_id"), UserId: userID, UserName: c.GetString("uid"),
			UserRole: role, UserIp: c.ClientIP(), RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
		}
		var trailer metadata.MD
		result, err := callService(ctx, conn, logSource, grpcRequest, &trailer)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{
			"ids": nonNilAuditIDs(result.GetAuditLogIds()), "total": result.GetTotal(),
			"page": result.GetPage(), "pageSize": result.GetPageSize(),
		})
	}
}

func batchDetailHandler(pool grpcpool.ConnectionProvider, logSource source) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, role, ok := adminRequester(c)
		if !ok {
			return
		}
		var body batchDetailRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, valid := normalizeAuditBatchIDs(body.IDs)
		if !valid {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		result, ok := fetchDetails(c, pool, logSource, userID, role, ids)
		if !ok {
			return
		}
		items := make([]gin.H, 0, len(result.GetDetailItems()))
		for _, item := range result.GetDetailItems() {
			items = append(items, auditLogData(item, logSource, role == "ADMIN"))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilAuditIDs(result.GetMissingAuditLogIds()),
		})
	}
}

func detailHandler(pool grpcpool.ConnectionProvider, logSource source) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, role, ok := adminRequester(c)
		if !ok {
			return
		}
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		result, ok := fetchDetails(c, pool, logSource, userID, role, []int64{id})
		if !ok {
			return
		}
		if len(result.GetDetailItems()) == 0 {
			response.Error(c, http.StatusNotFound, http.StatusNotFound)
			return
		}
		response.Success(c, auditLogData(
			result.GetDetailItems()[0], logSource, role == "ADMIN"))
	}
}

func fetchDetails(
	c *gin.Context,
	pool grpcpool.ConnectionProvider,
	logSource source,
	userID int64,
	role string,
	ids []int64,
) (*commonpb.PagedSearchAuditLogsResponse, bool) {
	conn, err := pool.GetConn(serviceName(logSource))
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
		return nil, false
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	request := &commonpb.PagedSearchAuditLogsRequest{
		TargetLogIds: ids, TraceId: c.GetString("trace_id"), UserId: userID,
		UserName: c.GetString("uid"), UserRole: role, UserIp: c.ClientIP(),
		RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
	}
	var trailer metadata.MD
	result, err := callService(ctx, conn, logSource, request, &trailer)
	if err != nil {
		httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
		response.Error(c, httpCode, errorCode)
		return nil, false
	}
	return result, true
}

func adminRequester(c *gin.Context) (int64, string, bool) {
	role := c.GetString("role")
	userID := commonhandler.UserIDFromContext(c)
	if userID <= 0 || role == "" {
		response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
		return 0, "", false
	}
	if role != "ADMIN" {
		response.Error(c, http.StatusForbidden, http.StatusForbidden)
		return 0, "", false
	}
	return userID, role, true
}

func normalizeAuditBatchIDs(ids []int64) ([]int64, bool) {
	if len(ids) == 0 || len(ids) > 200 {
		return nil, false
	}
	seen := make(map[int64]struct{}, len(ids))
	normalized := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, false
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized, true
}

func nonNilAuditIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}

func callService(ctx context.Context,
	conn grpc.ClientConnInterface,
	logSource source,
	request *commonpb.PagedSearchAuditLogsRequest,
	trailer *metadata.MD) (*commonpb.PagedSearchAuditLogsResponse, error) {
	switch logSource {
	case sourceOccupation:
		return occupationpb.NewOccupationServiceClient(conn).PagedSearchAuditLogs(ctx, request, grpc.Trailer(trailer))
	case sourceCrawler:
		return crawlerpb.NewCrawlerServiceClient(conn).PagedSearchAuditLogs(ctx, request, grpc.Trailer(trailer))
	default:
		return aipb.NewAIServiceClient(conn).PagedSearchAuditLogs(ctx, request, grpc.Trailer(trailer))
	}
}

func validRequest(request *pagedSearchRequest) bool {
	if request.Page < 0 || request.PageSize < 0 || request.PageSize > 100 || request.TargetUserID < 0 {
		return false
	}
	// 校验时同步归一化，确保传给各后端的枚举值与数据库枚举一致。
	request.Level = strings.ToUpper(strings.TrimSpace(request.Level))
	if request.Level != "" && request.Level != "INFO" && request.Level != "WARNING" && request.Level != "ERROR" {
		return false
	}
	request.UserType = strings.ToUpper(strings.TrimSpace(request.UserType))
	if request.UserType != "" && !validUserType(request.UserType) {
		return false
	}
	from, fromOK := optionalTime(request.CreatedAtFrom)
	to, toOK := optionalTime(request.CreatedAtTo)
	return fromOK && toOK && (from.IsZero() || to.IsZero() || !from.After(to))
}

func validUserType(value string) bool {
	switch value {
	case "ADMIN", "DATA_REVIEWER", "DATA_ANALYST", "TEACHER", "STUDENT", "STUDENT_AFFAIR", "CIVILIAN":
		return true
	default:
		return false
	}
}

func optionalTime(value string) (time.Time, bool) {
	if strings.TrimSpace(value) == "" {
		return time.Time{}, true
	}
	parsed, err := time.Parse(time.RFC3339, value)
	return parsed, err == nil
}

func serviceName(logSource source) string {
	switch logSource {
	case sourceOccupation:
		return "occupation-service"
	case sourceCrawler:
		return "crawler-service"
	default:
		return "ai-service"
	}
}

func auditLogData(item *commonpb.AuditLogItem, logSource source, includeInternalError bool) gin.H {
	errorMessage := ""
	if includeInternalError {
		errorMessage = item.GetErrorMsg()
	}
	return gin.H{
		"id": item.GetId(), "traceId": item.GetTraceId(),
		"userId": item.GetUserId(), "userName": item.GetUserName(), "userType": item.GetUserType(),
		"userIp": item.GetUserIp(), "level": item.GetLevel(),
		"requestMethod": item.GetRequestMethod(), "requestUrl": item.GetRequestUrl(),
		"errorMsg": errorMessage, "detail": item.GetDetail(),
		"createdAt": item.GetCreatedAt(), "sourceService": string(logSource),
	}
}
