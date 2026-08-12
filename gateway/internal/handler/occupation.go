// 百工谱 — occupation-service REST → gRPC handler
package handler

import (
	"context"
	"net/http"
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
		query, err := parseCatalogPageQuery(c)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := positiveQueryID(c, "disciplineCategoryId")
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := positiveQueryID(c, "majorCategoryId")
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := positiveQueryID(c, "occupationMajorCategoryId")
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := positiveQueryID(c, "occupationSubCategoryId")
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
		query, err := parseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID, err := positiveQueryID(c, "occupationCategoryId")
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": embeddableCatalogItems(resp.GetItems()), "total": resp.GetTotal(),
			"page": resp.GetPage(), "pageSize": resp.GetPageSize()})
	}
}

// GetOccupationEmbeddingProgressHandler 返回专业与职业的已向量化数量。
// @Summary      查询专业与职业向量化进度
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"majors": gin.H{"embedded": resp.GetMajors().GetEmbedded(), "total": resp.GetMajors().GetTotal()},
			"occupations": gin.H{
				"embedded": resp.GetOccupations().GetEmbedded(), "total": resp.GetOccupations().GetTotal(),
			},
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
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
				TraceId: c.GetString("trace_id"), UserId: userIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := grpcErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, embeddingTaskData(resp))
	}
}
