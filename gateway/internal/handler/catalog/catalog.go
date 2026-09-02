// 百工谱 — 七级专业/职业目录详情与批量解析 REST handler
package catalog

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type collection int

const (
	disciplineCategories collection = iota
	majorCategories
	majors
	occupationMajorCategories
	occupationSubCategories
	occupationCategories
	occupations
)

type lookupRequest struct {
	IDs []int64 `json:"ids"`
}

// GetDisciplineCategoryHandler 查询学科门类本体。
// @Summary 查询学科门类详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "学科门类 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.DisciplineCategoryData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/discipline-categories/{id} [get]
func GetDisciplineCategoryHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, disciplineCategories)
}

// LookupDisciplineCategoriesHandler 批量解析学科门类。
// @Summary 批量查询学科门类详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.DisciplineCategoryLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/discipline-categories/lookup [post]
func LookupDisciplineCategoriesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, disciplineCategories)
}

// GetMajorCategoryHandler 查询专业类本体。
// @Summary 查询专业类详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "专业类 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.MajorCategoryData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/major-categories/{id} [get]
func GetMajorCategoryHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, majorCategories)
}

// LookupMajorCategoriesHandler 批量解析专业类。
// @Summary 批量查询专业类详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.MajorCategoryLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/major-categories/lookup [post]
func LookupMajorCategoriesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, majorCategories)
}

// GetMajorHandler 查询专业本体。
// @Summary 查询专业详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "专业 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.MajorData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/majors/{id} [get]
func GetMajorHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, majors)
}

// LookupMajorsHandler 批量解析专业。
// @Summary 批量查询专业详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.MajorLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/majors/lookup [post]
func LookupMajorsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, majors)
}

// GetOccupationMajorCategoryHandler 查询职业大类本体。
// @Summary 查询职业大类详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "职业大类 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationMajorCategoryData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-major-categories/{id} [get]
func GetOccupationMajorCategoryHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, occupationMajorCategories)
}

// LookupOccupationMajorCategoriesHandler 批量解析职业大类。
// @Summary 批量查询职业大类详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationMajorCategoryLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-major-categories/lookup [post]
func LookupOccupationMajorCategoriesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, occupationMajorCategories)
}

// GetOccupationSubCategoryHandler 查询职业中类本体。
// @Summary 查询职业中类详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "职业中类 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationSubCategoryData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-sub-categories/{id} [get]
func GetOccupationSubCategoryHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, occupationSubCategories)
}

// LookupOccupationSubCategoriesHandler 批量解析职业中类。
// @Summary 批量查询职业中类详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationSubCategoryLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-sub-categories/lookup [post]
func LookupOccupationSubCategoriesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, occupationSubCategories)
}

// GetOccupationCategoryHandler 查询职业小类本体。
// @Summary 查询职业小类详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "职业小类 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationCategoryData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-categories/{id} [get]
func GetOccupationCategoryHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, occupationCategories)
}

// LookupOccupationCategoriesHandler 批量解析职业小类。
// @Summary 批量查询职业小类详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationCategoryLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/occupation-categories/lookup [post]
func LookupOccupationCategoriesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, occupationCategories)
}

// GetOccupationHandler 查询职业本体。
// @Summary 查询职业详情
// @Tags 专业职业目录
// @Produce json
// @Security Bearer
// @Param id path int true "职业 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/occupations/{id} [get]
func GetOccupationHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, occupations)
}

// LookupOccupationsHandler 批量解析职业。
// @Summary 批量查询职业详情
// @Tags 专业职业目录
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个资源 ID"
// @Success 200 {object} response.SuccessBody{data=catalog.OccupationLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/occupations/lookup [post]
func LookupOccupationsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, occupations)
}

func getHandler(pool grpcpool.ConnectionProvider, target collection) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := positiveID(c.Param("id"))
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		request := &occupationpb.CatalogDetailRequest{
			Id: id, TraceId: c.GetString("trace_id"),
			UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
			UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
			RequestUrl: c.Request.URL.Path,
		}
		var trailer metadata.MD
		result, err := getDetail(
			ctx, occupationpb.NewOccupationServiceClient(conn), target, request,
			grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, detailData(result.GetItem(), target))
	}
}

func lookupHandler(pool grpcpool.ConnectionProvider, target collection) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body lookupRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeIDs(body.IDs)
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		request := &occupationpb.CatalogLookupRequest{
			Ids: ids, TraceId: c.GetString("trace_id"),
			UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
			UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
			RequestUrl: c.Request.URL.Path,
		}
		var trailer metadata.MD
		result, err := lookupDetails(
			ctx, occupationpb.NewOccupationServiceClient(conn), target, request,
			grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, detailData(item, target))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

func getDetail(
	ctx context.Context,
	client occupationpb.OccupationServiceClient,
	target collection,
	request *occupationpb.CatalogDetailRequest,
	options ...grpc.CallOption,
) (*occupationpb.CatalogDetailResponse, error) {
	switch target {
	case disciplineCategories:
		return client.GetDisciplineCategory(ctx, request, options...)
	case majorCategories:
		return client.GetMajorCategory(ctx, request, options...)
	case majors:
		return client.GetMajor(ctx, request, options...)
	case occupationMajorCategories:
		return client.GetOccupationMajorCategory(ctx, request, options...)
	case occupationSubCategories:
		return client.GetOccupationSubCategory(ctx, request, options...)
	case occupationCategories:
		return client.GetOccupationCategory(ctx, request, options...)
	case occupations:
		return client.GetOccupation(ctx, request, options...)
	default:
		panic("unsupported catalog collection")
	}
}

func lookupDetails(
	ctx context.Context,
	client occupationpb.OccupationServiceClient,
	target collection,
	request *occupationpb.CatalogLookupRequest,
	options ...grpc.CallOption,
) (*occupationpb.CatalogLookupResponse, error) {
	switch target {
	case disciplineCategories:
		return client.LookupDisciplineCategories(ctx, request, options...)
	case majorCategories:
		return client.LookupMajorCategories(ctx, request, options...)
	case majors:
		return client.LookupMajors(ctx, request, options...)
	case occupationMajorCategories:
		return client.LookupOccupationMajorCategories(ctx, request, options...)
	case occupationSubCategories:
		return client.LookupOccupationSubCategories(ctx, request, options...)
	case occupationCategories:
		return client.LookupOccupationCategories(ctx, request, options...)
	case occupations:
		return client.LookupOccupations(ctx, request, options...)
	default:
		panic("unsupported catalog collection")
	}
}

func detailData(item *occupationpb.CatalogDetailData, target collection) gin.H {
	if item == nil {
		return nil
	}
	result := gin.H{"id": item.GetId(), "code": item.GetCode(), "name": item.GetName()}
	switch target {
	case majorCategories:
		result["disciplineCategoryId"] = item.GetDisciplineCategoryId()
	case majors:
		result["majorCategoryId"] = item.GetMajorCategoryId()
		result["isEmbed"] = item.GetIsEmbed()
	case occupationSubCategories:
		result["occupationMajorCategoryId"] = item.GetOccupationMajorCategoryId()
	case occupationCategories:
		result["occupationSubCategoryId"] = item.GetOccupationSubCategoryId()
	case occupations:
		result["occupationCategoryId"] = item.GetOccupationCategoryId()
		result["isEmbed"] = item.GetIsEmbed()
		result["description"] = item.GetDescription()
	}
	return result
}

func normalizeIDs(values []int64) ([]int64, bool) {
	// 原始请求必须是 1..200，然后才去重并保留首次出现顺序。
	if len(values) == 0 || len(values) > 200 {
		return nil, false
	}
	seen := make(map[int64]struct{}, len(values))
	result := make([]int64, 0, len(values))
	for _, id := range values {
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

func positiveID(value string) (int64, bool) {
	id, err := strconv.ParseInt(value, 10, 64)
	return id, err == nil && id > 0
}

func nonNilIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}
