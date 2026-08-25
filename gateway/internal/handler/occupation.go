// 百工谱 — occupation-service REST → gRPC handler
package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// ListDisciplineCategoriesHandler 分页搜索学科门类。
// @Summary      分页搜索学科门类
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/discipline-categories [get]
func ListDisciplineCategoriesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListDisciplineCategories(
			ctx,
			&occupationpb.CatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListMajorCategoriesHandler 查询指定学科门类下的专业类。
// @Summary      分页搜索专业类
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        disciplineCategoryId query int true "学科门类 ID"
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/major-categories [get]
func ListMajorCategoriesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := PositiveQueryID(c, "disciplineCategoryId")
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListMajorCategories(
			ctx,
			&occupationpb.ChildCatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword, ParentId: parentID,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListMajorsHandler 查询指定专业类下的专业，items 返回 is_embed。
// @Summary      分页搜索专业
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        majorCategoryId query int true "专业类 ID"
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors [get]
func ListMajorsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := PositiveQueryID(c, "majorCategoryId")
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListMajors(
			ctx,
			&occupationpb.ChildCatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword, ParentId: parentID,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": embeddableCatalogItems(resp.GetItems()), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListOccupationMajorCategoriesHandler 分页搜索职业大类。
// @Summary      分页搜索职业大类
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupation-major-categories [get]
func ListOccupationMajorCategoriesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListOccupationMajorCategories(
			ctx,
			&occupationpb.CatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListOccupationSubCategoriesHandler 查询指定职业大类下的职业中类。
// @Summary      分页搜索职业中类
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        occupationMajorCategoryId query int true "职业大类 ID"
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupation-sub-categories [get]
func ListOccupationSubCategoriesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := PositiveQueryID(c, "occupationMajorCategoryId")
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListOccupationSubCategories(
			ctx,
			&occupationpb.ChildCatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword, ParentId: parentID,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListOccupationCategoriesHandler 查询指定职业中类下的职业小类。
// @Summary      分页搜索职业小类
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        occupationSubCategoryId query int true "职业中类 ID"
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupation-categories [get]
func ListOccupationCategoriesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := PositiveQueryID(c, "occupationSubCategoryId")
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListOccupationCategories(
			ctx,
			&occupationpb.ChildCatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword, ParentId: parentID,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// ListOccupationsHandler 查询指定职业小类下的职业，items 返回 is_embed。
// @Summary      分页搜索职业
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Param        occupationCategoryId query int true "职业小类 ID"
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数"
// @Param        keyword query string false "名称或编码关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations [get]
func ListOccupationsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := PositiveQueryID(c, "occupationCategoryId")
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListOccupations(
			ctx,
			&occupationpb.ChildCatalogListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword, ParentId: parentID,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": embeddableCatalogItems(resp.GetItems()), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// GetOccupationEmbeddingProgressHandler 返回专业、职业与规范技能的已向量化数量。
// @Summary      查询专业、职业与技能向量化进度
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/embedding/progress [get]
func GetOccupationEmbeddingProgressHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetEmbeddingProgress(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"majors": gin.H{"embedded": resp.GetMajors().GetEmbedded(), "total": resp.GetMajors().GetTotal()},
			"occupations": gin.H{
				"embedded": resp.GetOccupations().GetEmbedded(), "total": resp.GetOccupations().GetTotal(),
			},
			"skills": gin.H{"embedded": resp.GetSkills().GetEmbedded(), "total": resp.GetSkills().GetTotal()},
		})
	}
}

// StartMajorEmbeddingHandler 启动专业名称后台向量化。
// @Summary      启动专业名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors/embedding [post]
func StartMajorEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StartMajorEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// GetMajorEmbeddingStatusHandler 查询专业名称向量化状态。
// @Summary      查询专业名称向量化状态
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors/embedding [get]
func GetMajorEmbeddingStatusHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetMajorEmbeddingStatus(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// StopMajorEmbeddingHandler 停止专业名称向量化。
// @Summary      停止专业名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors/embedding [delete]
func StopMajorEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StopMajorEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// StartOccupationEmbeddingHandler 启动职业名称后台向量化。
// @Summary      启动职业名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations/embedding [post]
func StartOccupationEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StartOccupationEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// GetOccupationEmbeddingStatusHandler 查询职业名称向量化状态。
// @Summary      查询职业名称向量化状态
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations/embedding [get]
func GetOccupationEmbeddingStatusHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetOccupationEmbeddingStatus(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// StopOccupationEmbeddingHandler 停止职业名称向量化。
// @Summary      停止职业名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations/embedding [delete]
func StopOccupationEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StopOccupationEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// StartSkillEmbeddingHandler 启动规范技能名称后台向量化。
// @Summary      启动规范技能名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/embedding [post]
func StartSkillEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StartSkillEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// GetSkillEmbeddingStatusHandler 查询规范技能名称向量化状态。
// @Summary      查询规范技能名称向量化状态
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/embedding [get]
func GetSkillEmbeddingStatusHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetSkillEmbeddingStatus(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// StopSkillEmbeddingHandler 停止规范技能名称向量化。
// @Summary      停止规范技能名称向量化
// @Tags         专业职业管理
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/embedding [delete]
func StopSkillEmbeddingHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).StopSkillEmbedding(
			ctx,
			&occupationpb.EmbeddingTaskRequest{
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}

// ListJobAnalysisTasksHandler 分页查询岗位分析审核任务。
// @Summary      分页查询岗位分析任务
// @Tags         岗位分析审核
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        reviewStatus query string false "PENDING / PASSED / REJECTED"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-analysis [get]
func ListJobAnalysisTasksHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListJobAnalysisTasks(
			ctx,
			&occupationpb.ListJobAnalysisTasksRequest{
				Page: query.Page, PageSize: query.PageSize, ReviewStatus: c.Query("reviewStatus"),
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize(),
		})
	}
}

// GetJobAnalysisTaskHandler 查询岗位分析任务、专业/职业候选及 JD 技能结果。
// @Summary      查询岗位分析任务详情
// @Tags         岗位分析审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_analysis_tasks.id"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-analysis/{id} [get]
func GetJobAnalysisTaskHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetJobAnalysisTask(
			ctx,
			&occupationpb.GetJobAnalysisTaskRequest{
				Id: id, TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"analysis": resp.GetAnalysis()})
	}
}

type reviewJobAnalysisRequest struct {
	MajorID      int64                    `json:"majorId" binding:"required"`
	OccupationID int64                    `json:"occupationId" binding:"required"`
	SkillReviews []jobAnalysisSkillReview `json:"skillReviews"`
}

type jobAnalysisSkillReview struct {
	ResultID         int64  `json:"resultId"`
	Action           string `json:"action"`
	SkillName        string `json:"skillName"`
	SkillProficiency string `json:"skillProficiency"`
	Evidence         string `json:"evidence"`
}

// ReviewJobAnalysisTaskHandler 同时确认专业、职业并逐条审核 JD 技能结果。
// @Summary      审核岗位专业、职业与技能分析
// @Description  majorId、occupationId 可选择任意有效目录记录；skillReviews 必须覆盖全部分析结果，支持 APPROVE、APPROVE_WITH_EDIT、REJECT
// @Tags         岗位分析审核
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_analysis_tasks.id"
// @Param        request body reviewJobAnalysisRequest true "最终职业"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-analysis/{id}/review [put]
func ReviewJobAnalysisTaskHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var request reviewJobAnalysisRequest
		if err := c.ShouldBindJSON(&request); err != nil || request.MajorID <= 0 || request.OccupationID <= 0 {
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
		skillReviews := make([]*occupationpb.JobAnalysisSkillReview, 0, len(request.SkillReviews))
		for _, item := range request.SkillReviews {
			skillReviews = append(skillReviews, &occupationpb.JobAnalysisSkillReview{
				ResultId: item.ResultID, Action: item.Action,
				SkillName: item.SkillName, SkillProficiency: item.SkillProficiency,
				Evidence: item.Evidence,
			})
		}
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ReviewJobAnalysisTask(
			ctx,
			&occupationpb.ReviewJobAnalysisTaskRequest{
				Id: id, MajorId: request.MajorID, OccupationId: request.OccupationID,
				SkillReviews: skillReviews,
				TraceId:      c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"analysis": resp.GetAnalysis()})
	}
}

// ListSkillsHandler 分页搜索全局规范技能，供候选外技能选择使用。
// @Summary      分页搜索规范技能
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        keyword query string false "规范技能名称关键词"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills [get]
func ListSkillsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListSkills(
			ctx,
			&occupationpb.ListSkillsRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"items": canonicalSkillItems(resp.GetItems()), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize(),
		})
	}
}

// ListJobSkillResolutionTasksHandler 分页查询岗位技能归一审核任务。
// @Summary      分页查询岗位技能归一任务
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        taskStatus query string false "PENDING / RUNNING / SUCCESS / FAILED"
// @Param        reviewStatus query string false "PENDING / PASSED"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-skill-resolution [get]
func ListJobSkillResolutionTasksHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := ParseCatalogPageQuery(c)
		if err != nil {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListJobSkillResolutionTasks(
			ctx,
			&occupationpb.ListJobSkillResolutionTasksRequest{
				Page: query.Page, PageSize: query.PageSize,
				TaskStatus: c.Query("taskStatus"), ReviewStatus: c.Query("reviewStatus"),
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"items": resp.GetItems(), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize(),
		})
	}
}

// GetJobSkillResolutionTaskHandler 查询技能归一任务、岗位技能和 Top N 候选。
// @Summary      查询岗位技能归一任务详情
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-skill-resolution/{id} [get]
func GetJobSkillResolutionTaskHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).GetJobSkillResolutionTask(
			ctx,
			&occupationpb.GetJobSkillResolutionTaskRequest{
				Id: id, TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"resolution": resp.GetResolution()})
	}
}

// ListJobSkillResolutionSimilarSkillsHandler 返回待审技能向量对应的 Top 5 规范技能。
// @Summary      查询技能归一 Top 5 相似技能
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-skill-resolution/{id}/similar-skills [get]
func ListJobSkillResolutionSimilarSkillsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ListJobSkillResolutionSimilarSkills(
			ctx,
			&occupationpb.GetJobSkillResolutionTaskRequest{
				Id:      id,
				TraceId: c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": skillResolutionCandidateItems(resp.GetItems())})
	}
}

type reviewJobSkillResolutionRequest struct {
	ResolutionAction string `json:"resolutionAction" binding:"required"`
	SkillID          int64  `json:"skillId"`
	NewSkillName     string `json:"newSkillName"`
}

// ReviewJobSkillResolutionTaskHandler 通过三种互斥动作确认岗位技能身份。
// @Summary      审核岗位技能归一任务
// @Description  SELECT_CANDIDATE 选择当前候选；SELECT_EXISTING 选择候选外规范技能；CREATE_NEW 创建新规范技能
// @Tags         技能归一审核
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Param        request body reviewJobSkillResolutionRequest true "技能归一动作"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      409 {object} response.ErrorBody
// @Router       /api/auth/occupation/job-skill-resolution/{id}/review [put]
func ReviewJobSkillResolutionTaskHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var request reviewJobSkillResolutionRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		action := strings.TrimSpace(request.ResolutionAction)
		newSkillName := strings.TrimSpace(request.NewSkillName)
		if !validJobSkillResolutionAction(action, request.SkillID, newSkillName) {
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
		var trailer metadata.MD
		resp, err := occupationpb.NewOccupationServiceClient(conn).ReviewJobSkillResolutionTask(
			ctx,
			&occupationpb.ReviewJobSkillResolutionTaskRequest{
				Id: id, ResolutionAction: action, SkillId: request.SkillID,
				NewSkillName: newSkillName,
				TraceId:      c.GetString("trace_id"), UserId: UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"resolution": resp.GetResolution()})
	}
}

func validJobSkillResolutionAction(action string, skillID int64, newSkillName string) bool {
	switch action {
	case "SELECT_CANDIDATE", "SELECT_EXISTING":
		return skillID > 0 && newSkillName == ""
	case "CREATE_NEW":
		return skillID == 0 && newSkillName != ""
	default:
		return false
	}
}
