// 百工谱 — ADMIN 用户管理 REST handler
package user

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type listUsersRequest struct {
	Page         int    `json:"page" example:"0"`
	PageSize     int    `json:"pageSize" example:"20"`
	Name         string `json:"name" example:"张三"`
	Role         string `json:"role" example:"STUDENT"`
	UniversityID int64  `json:"universityId" example:"1"`
	SchoolID     int64  `json:"schoolId" example:"1"`
	DepartmentID int64  `json:"departmentId" example:"1"`
}

type batchIDsRequest struct {
	IDs []int64 `json:"ids" binding:"required"`
}

// ListUsersHandler 分页查询用户基础信息。
// @Summary      ADMIN 分页查询用户
// @Description  name 为包含匹配，role 和三个组织 ID 为精确匹配；分页结果仅返回 ids，详情通过 lookup 获取
// @Tags         用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body listUsersRequest true "分页与用户筛选条件"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData} "data 内含 ids/total/page/pageSize"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/users [post]
func ListUsersHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request listUsersRequest
		if err := c.ShouldBindJSON(&request); err != nil || !validListUsersRequest(request) {
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
		result, err := userpb.NewUserServiceClient(conn).ListUsers(
			ctx,
			&userpb.ListUsersRequest{
				Page:          int32(request.Page),
				PageSize:      int32(request.PageSize),
				Name:          request.Name,
				Role:          request.Role,
				UniversityId:  request.UniversityID,
				SchoolId:      request.SchoolID,
				DepartmentId:  request.DepartmentID,
				TraceId:       c.GetString("trace_id"),
				UserId:        commonhandler.UserIDFromContext(c),
				UserName:      c.GetString("uid"),
				UserIp:        c.ClientIP(),
				RequestMethod: c.Request.Method,
				RequestUrl:    c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{
			"ids": nonNilBatchIDs(result.GetUserIds()), "total": result.GetTotal(),
			"page": result.GetPage(), "pageSize": result.GetPageSize(),
		})
	}
}

// BatchGetUsersHandler 按 ID 批量查询用户详情。
// @Summary ADMIN 批量查询用户详情
// @Tags 用户管理
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchIDsRequest true "1 至 200 个用户 ID"
// @Success 200 {object} response.SuccessBody{data=user.UserLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/users/lookup [post]
func BatchGetUsersHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body batchIDsRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeBatchIDs(body.IDs)
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
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).BatchGetUsers(
			ctx,
			&userpb.BatchGetUsersRequest{
				Ids: ids, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, userData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilBatchIDs(result.GetMissingIds()),
		})
	}
}

// GetUserHandler 按用户 ID 查询用户账号与校园资料。
// @Summary      ADMIN 查询用户详情
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        id path int true "用户 ID"
// @Success      200 {object} response.SuccessBody{data=user.UserData} "data 为用户自身字段及三个组织 ID，不嵌入组织对象或名称"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/users/{id} [get]
func GetUserHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
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
		result, err := userpb.NewUserServiceClient(conn).GetUser(
			ctx,
			&userpb.GetUserRequest{
				Id: id, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		user := result.GetUser()
		if user == nil {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, userData(user))
	}
}

// BlockUserHandler 将指定用户设为 LOCKED，重复封禁保持成功。
// @Summary      ADMIN 封禁用户
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        id path int true "用户 ID"
// @Success      200 {object} response.SuccessBody{data=response.IDData} "data 仅含用户 id"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/users/{id}/block [post]
func BlockUserHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
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
		result, err := userpb.NewUserServiceClient(conn).BlockUser(
			ctx,
			&userpb.BlockUserRequest{
				Id: id, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		if result.GetUserId() <= 0 {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, gin.H{"id": result.GetUserId()})
	}
}

// UnlockUserHandler 将指定用户设为 NORMAL，重复解封保持成功。
// @Summary      ADMIN 解封用户
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        id path int true "用户 ID"
// @Success      200 {object} response.SuccessBody{data=response.IDData} "data 仅含用户 id"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/users/{id}/unlock [post]
func UnlockUserHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
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
		result, err := userpb.NewUserServiceClient(conn).UnlockUser(
			ctx,
			&userpb.UnlockUserRequest{
				Id: id, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		if result.GetUserId() <= 0 {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, gin.H{"id": result.GetUserId()})
	}
}

// ListUniversitiesHandler 分页查询系统高校目录。
// @Summary      ADMIN 查询高校列表
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        keyword query string false "高校名称关键词"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/users/universities [get]
func ListUniversitiesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationListHandler(pool, "", func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationListRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationListResponse, error) {
		return client.ListUniversities(ctx, request, options...)
	})
}

// ListSchoolsHandler 分页查询系统学院目录，universityId 可选。
// @Summary      ADMIN 查询学院列表
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        keyword query string false "学院名称关键词"
// @Param        universityId query int false "高校 ID；不传返回全部学院"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/users/schools [get]
func ListSchoolsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationListHandler(pool, "universityId", func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationListRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationListResponse, error) {
		return client.ListSchools(ctx, request, options...)
	})
}

// ListDepartmentsHandler 分页查询系统系部目录，schoolId 可选。
// @Summary      ADMIN 查询系部列表
// @Tags         用户管理
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        keyword query string false "系部名称关键词"
// @Param        schoolId query int false "学院 ID；不传返回全部系部"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData}
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/users/departments [get]
func ListDepartmentsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationListHandler(pool, "schoolId", func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationListRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationListResponse, error) {
		return client.ListDepartments(ctx, request, options...)
	})
}

// BatchGetUniversitiesHandler 按 ID 批量查询高校详情。
// @Summary ADMIN 批量查询高校详情
// @Tags 用户管理
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchIDsRequest true "1 至 200 个高校 ID"
// @Success 200 {object} response.SuccessBody{data=user.OrganizationLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/users/universities/lookup [post]
func BatchGetUniversitiesHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationBatchHandler(pool, func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationBatchRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationBatchResponse, error) {
		return client.BatchGetUniversities(ctx, request, options...)
	})
}

// BatchGetSchoolsHandler 按 ID 批量查询学院详情。
// @Summary ADMIN 批量查询学院详情
// @Tags 用户管理
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchIDsRequest true "1 至 200 个学院 ID"
// @Success 200 {object} response.SuccessBody{data=user.OrganizationLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/users/schools/lookup [post]
func BatchGetSchoolsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationBatchHandler(pool, func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationBatchRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationBatchResponse, error) {
		return client.BatchGetSchools(ctx, request, options...)
	})
}

// BatchGetDepartmentsHandler 按 ID 批量查询系部详情。
// @Summary ADMIN 批量查询系部详情
// @Tags 用户管理
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body batchIDsRequest true "1 至 200 个系部 ID"
// @Success 200 {object} response.SuccessBody{data=user.OrganizationLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/users/departments/lookup [post]
func BatchGetDepartmentsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return organizationBatchHandler(pool, func(
		client userpb.UserServiceClient,
		ctx context.Context,
		request *userpb.OrganizationBatchRequest,
		options ...grpc.CallOption,
	) (*userpb.OrganizationBatchResponse, error) {
		return client.BatchGetDepartments(ctx, request, options...)
	})
}

type organizationListRPC func(
	client userpb.UserServiceClient,
	ctx context.Context,
	request *userpb.OrganizationListRequest,
	options ...grpc.CallOption,
) (*userpb.OrganizationListResponse, error)

func organizationListHandler(pool *grpcpool.GrpcClientPool,
	parentParameter string,
	call organizationListRPC) gin.HandlerFunc {
	return func(c *gin.Context) {
		query, err := commonhandler.ParseCatalogPageQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		parentID := int64(0)
		if parentParameter != "" {
			parentID, err = commonhandler.OptionalPositiveQueryID(c, parentParameter)
			if err != nil {
				response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
				return
			}
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := call(
			userpb.NewUserServiceClient(conn),
			ctx,
			&userpb.OrganizationListRequest{
				Page: query.Page, PageSize: query.PageSize, Keyword: query.Keyword,
				ParentId: parentID, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{
			"ids": nonNilBatchIDs(result.GetOrganizationIds()), "total": result.GetTotal(),
			"page": result.GetPage(), "pageSize": result.GetPageSize(),
		})
	}
}

type organizationBatchRPC func(
	client userpb.UserServiceClient,
	ctx context.Context,
	request *userpb.OrganizationBatchRequest,
	options ...grpc.CallOption,
) (*userpb.OrganizationBatchResponse, error)

func organizationBatchHandler(
	pool *grpcpool.GrpcClientPool,
	call organizationBatchRPC,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body batchIDsRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeBatchIDs(body.IDs)
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
		var trailer metadata.MD
		result, err := call(
			userpb.NewUserServiceClient(conn),
			ctx,
			&userpb.OrganizationBatchRequest{
				Ids: ids, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, organizationData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilBatchIDs(result.GetMissingIds()),
		})
	}
}

func validListUsersRequest(request listUsersRequest) bool {
	return request.Page >= 0 && request.PageSize >= 0 && request.PageSize <= 100 &&
		request.UniversityID >= 0 && request.SchoolID >= 0 && request.DepartmentID >= 0
}

func userData(user *userpb.UserData) gin.H {
	if user == nil {
		return nil
	}
	return gin.H{
		"id": user.GetId(), "uid": user.GetUid(), "name": user.GetName(),
		"role": user.GetRole(), "status": user.GetStatus(),
		"universityId": user.GetUniversityId(), "schoolId": user.GetSchoolId(),
		"departmentId": user.GetDepartmentId(),
	}
}

func normalizeBatchIDs(ids []int64) ([]int64, bool) {
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

// nonNilBatchIDs 保证空 missingIds 稳定编码为 []。
func nonNilBatchIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}

func organizationData(item *userpb.OrganizationData) gin.H {
	return gin.H{
		"id": item.GetId(), "name": item.GetName(), "parentId": item.GetParentId(),
	}
}
