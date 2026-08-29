// 百工谱 — 职业/专业直接技能图谱 REST handler
package skillgraph

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type lookupSkillGraphMetricsRequest struct {
	SkillIDs  []int64 `json:"skillIds"`
	FromMonth string  `json:"fromMonth"`
	ToMonth   string  `json:"toMonth"`
}

// OccupationSkillGraphHandler 查询指定职业在时间窗内直接贡献的技能 ID。
// @Summary      查询职业直接技能 ID
// @Tags         岗位能力图谱
// @Produce      json
// @Security     Bearer
// @Param        id path int true "occupations.id"
// @Param        fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param        toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Success      200 {object} response.SuccessBody{data=skillgraph.GraphData} "data 仅含 scopeId/directSkillIds"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations/{id}/skill-graph [get]
func OccupationSkillGraphHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphHandler(pool, "OCCUPATION")
}

// MajorSkillGraphHandler 查询指定专业在时间窗内直接贡献的技能 ID。
// @Summary      查询专业直接技能 ID
// @Tags         岗位能力图谱
// @Produce      json
// @Security     Bearer
// @Param        id path int true "majors.id"
// @Param        fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param        toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Success      200 {object} response.SuccessBody{data=skillgraph.GraphData} "data 仅含 scopeId/directSkillIds"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors/{id}/skill-graph [get]
func MajorSkillGraphHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphHandler(pool, "MAJOR")
}

func skillGraphHandler(pool grpcpool.ConnectionProvider, scopeType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeID, err := commonhandler.PositivePathID(c, "id")
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		query, err := commonhandler.ParseSkillGraphQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).GetSkillGraph(
			ctx,
			&occupationpb.GetSkillGraphRequest{
				ScopeType: scopeType, ScopeId: scopeID,
				FromMonth: query.FromMonth, ToMonth: query.ToMonth,
				TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, skillGraphData(result))
	}
}

// OccupationSkillGraphMetricsHandler 批量读取职业与直接技能关系的指标。
// @Summary 批量查询职业直接技能图谱指标
// @Tags 岗位能力图谱
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "occupations.id"
// @Param request body lookupSkillGraphMetricsRequest true "1 到 200 个技能 ID 与自然月时间窗"
// @Success 200 {object} response.SuccessBody{data=skillgraph.MetricLookupData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupations/{id}/skill-graph/skills/lookup [post]
func OccupationSkillGraphMetricsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphMetricsHandler(pool, "OCCUPATION")
}

// MajorSkillGraphMetricsHandler 批量读取专业与直接技能关系的指标。
// @Summary 批量查询专业直接技能图谱指标
// @Tags 岗位能力图谱
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "majors.id"
// @Param request body lookupSkillGraphMetricsRequest true "1 到 200 个技能 ID 与自然月时间窗"
// @Success 200 {object} response.SuccessBody{data=skillgraph.MetricLookupData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/majors/{id}/skill-graph/skills/lookup [post]
func MajorSkillGraphMetricsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphMetricsHandler(pool, "MAJOR")
}

func skillGraphMetricsHandler(
	pool grpcpool.ConnectionProvider,
	scopeType string,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeID, err := commonhandler.PositivePathID(c, "id")
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var request lookupSkillGraphMetricsRequest
		if err := c.ShouldBindJSON(&request); err != nil ||
			!validMonthWindow(request.FromMonth, request.ToMonth) {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		skillIDs, ok := normalizeSkillIDs(request.SkillIDs)
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupSkillGraphMetrics(
			ctx,
			&occupationpb.LookupSkillGraphMetricsRequest{
				ScopeType: scopeType, ScopeId: scopeID, SkillIds: skillIDs,
				FromMonth: request.FromMonth, ToMonth: request.ToMonth,
				TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"items":      skillGraphMetricItems(result.GetItems()),
			"missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

// OccupationSkillGraphEvidenceHandler 分页读取职业技能的岗位证据 ID。
// @Summary 分页查询职业直接技能的岗位证据 ID
// @Tags 岗位能力图谱
// @Produce json
// @Security Bearer
// @Param id path int true "occupations.id"
// @Param skillId path int true "skills.id"
// @Param fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Param page query int false "页码，从 0 开始"
// @Param pageSize query int false "每页条数，默认 20，最大 100"
// @Success 200 {object} response.SuccessBody{data=skillgraph.EvidencePageData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupations/{id}/skill-graph/skills/{skillId}/evidence [get]
func OccupationSkillGraphEvidenceHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphEvidenceHandler(pool, "OCCUPATION")
}

// MajorSkillGraphEvidenceHandler 分页读取专业技能的岗位证据 ID。
// @Summary 分页查询专业直接技能的岗位证据 ID
// @Tags 岗位能力图谱
// @Produce json
// @Security Bearer
// @Param id path int true "majors.id"
// @Param skillId path int true "skills.id"
// @Param fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Param page query int false "页码，从 0 开始"
// @Param pageSize query int false "每页条数，默认 20，最大 100"
// @Success 200 {object} response.SuccessBody{data=skillgraph.EvidencePageData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/majors/{id}/skill-graph/skills/{skillId}/evidence [get]
func MajorSkillGraphEvidenceHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return skillGraphEvidenceHandler(pool, "MAJOR")
}

func skillGraphEvidenceHandler(
	pool grpcpool.ConnectionProvider,
	scopeType string,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeID, scopeErr := commonhandler.PositivePathID(c, "id")
		skillID, skillErr := commonhandler.PositivePathID(c, "skillId")
		query, queryErr := commonhandler.ParseSkillGraphQuery(c)
		page, pageErr := commonhandler.ParseCatalogPageQuery(c)
		if scopeErr != nil || skillErr != nil || queryErr != nil || pageErr != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).ListSkillGraphEvidenceJobs(
			ctx,
			&occupationpb.ListSkillGraphEvidenceJobsRequest{
				ScopeType: scopeType, ScopeId: scopeID, SkillId: skillID,
				FromMonth: query.FromMonth, ToMonth: query.ToMonth,
				Page: page.Page, PageSize: page.PageSize,
				TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, skillGraphEvidenceData(result))
	}
}

func skillGraphData(result *occupationpb.GetSkillGraphResponse) gin.H {
	if result == nil {
		return nil
	}
	return gin.H{
		"scopeId":        result.GetScopeId(),
		"directSkillIds": nonNilIDs(result.GetDirectSkillIds()),
	}
}

func skillGraphMetricItems(items []*occupationpb.SkillGraphMetric) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		result = append(result, gin.H{
			"skillId": item.GetSkillId(), "jobCount": item.GetJobCount(),
			"coverage": item.GetCoverage(),
		})
	}
	return result
}

func skillGraphEvidenceData(result *occupationpb.ListSkillGraphEvidenceJobsResponse) gin.H {
	return gin.H{
		"jobIds": nonNilIDs(result.GetJobIds()), "total": result.GetTotal(),
		"page": result.GetPage(), "pageSize": result.GetPageSize(),
	}
}

func normalizeSkillIDs(ids []int64) ([]int64, bool) {
	// 先限制原始请求数量，再去重并按 ID 升序请求后端。
	if len(ids) == 0 || len(ids) > 200 {
		return nil, false
	}
	seen := make(map[int64]struct{}, len(ids))
	result := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, false
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result, true
}

func validMonthWindow(fromMonth, toMonth string) bool {
	parse := func(value string) (time.Time, bool) {
		if value == "" {
			return time.Time{}, true
		}
		month, err := time.Parse("2006-01", value)
		return month, err == nil
	}
	from, fromOK := parse(fromMonth)
	to, toOK := parse(toMonth)
	if !fromOK || !toOK {
		return false
	}
	return from.IsZero() || to.IsZero() || from.Before(to)
}

// nonNilIDs 保证 repeated ID 为空时仍编码为 JSON []。
func nonNilIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}
