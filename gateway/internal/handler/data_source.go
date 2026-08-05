// 百工谱 — data-source 服务相关 REST handler
// 网关 REST → gRPC 调用 data-source-service（清洗数据查询与人工复核）

package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/response"
	datasourcepb "baigon-technography/gateway/pb/datasourcepb"

	"github.com/gin-gonic/gin"
)

// listCleanedJobsRequest 分页列表请求体（用户确认用 POST + body）
type listCleanedJobsRequest struct {
	Page            int    `json:"page" example:"0"`                     // 页码，从 0 开始
	PageSize        int    `json:"pageSize" example:"20"`                // 每页条数
	ReviewStatus    string `json:"reviewStatus" example:"PENDING"`       // 复核状态筛选，空=全部
	PublishDateFrom string `json:"publishDateFrom" example:"2025-01-01"` // 发布时间起点
	PublishDateTo   string `json:"publishDateTo" example:"2025-12-31"`   // 发布时间终点
}

// editReviewRequest 修改后通过复核请求体
type editReviewRequest struct {
	JobName        string `json:"jobName"`        // 岗位名称
	CompanyName    string `json:"companyName"`    // 公司名称
	Salary         string `json:"salary"`         // 薪资
	City           string `json:"city"`           // 城市
	Education      string `json:"education"`      // 学历要求
	Experience     string `json:"experience"`     // 经验要求
	JobDescription string `json:"jobDescription"` // 岗位描述
}

// ListCleanedJobsHandler 分页查询清洗后岗位列表
// @Summary      分页查询清洗后岗位
// @Description  分页查询 cleaned_job_sources，支持按复核状态、发布时间筛选；仅返回摘要字段
// @Tags         数据治理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body listCleanedJobsRequest true "分页筛选请求"
// @Success      200  {object}  response.SuccessBody  "列表，data 内含 items/total/page/pageSize"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      503  {object}  response.ErrorBody    "data-source 服务不可用"
// @Router       /api/auth/data-source [post]
func ListCleanedJobsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req listCleanedJobsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("data-source-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ListCleanedJobs(ctx, &datasourcepb.ListCleanedJobsRequest{
			Page:            int32(req.Page),
			PageSize:        int32(req.PageSize),
			ReviewStatus:    req.ReviewStatus,
			PublishDateFrom: req.PublishDateFrom,
			PublishDateTo:   req.PublishDateTo,
			TraceId:         c.GetString("trace_id"),
			UserId:          userIDFromContext(c),
			UserName:        c.GetString("uid"),
			UserIp:          c.ClientIP(),
			RequestMethod:   c.Request.Method,
			RequestUrl:      c.Request.URL.Path,
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		response.Success(c, gin.H{
			"items":    resp.GetItems(),
			"total":    resp.GetTotal(),
			"page":     resp.GetPage(),
			"pageSize": resp.GetPageSize(),
		})
	}
}

// GetCleanedJobHandler 查看清洗后岗位详情
// @Summary      查看清洗后岗位详情
// @Description  返回 cleaned_job_sources 某条记录的全字段
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody  "详情，data 内含 job 全字段"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "data-source 服务不可用"
// @Router       /api/auth/data-source/{id} [get]
func GetCleanedJobHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("data-source-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).GetCleanedJob(ctx, &datasourcepb.GetCleanedJobRequest{
			Id:            id,
			TraceId:       c.GetString("trace_id"),
			UserId:        userIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		response.Success(c, gin.H{"job": resp.GetJob()})
	}
}

// GetSourceJobHandler 查看原始记录
// @Summary      查看原始记录
// @Description  查看 cleaned_job_sources 对应 job_sources 表的原始记录（经 crawler-service 查询）
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody  "原始记录，data 内含 source 全字段"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/source [get]
func GetSourceJobHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("data-source-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).GetSourceJob(ctx, &datasourcepb.GetSourceJobRequest{
			Id:            id,
			TraceId:       c.GetString("trace_id"),
			UserId:        userIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		response.Success(c, gin.H{"source": resp.GetSource()})
	}
}

// ApproveReviewHandler 复核通过
// @Summary      复核通过
// @Description  将 cleaned_job_sources 记录标记为复核通过（PASSED）
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody  "复核后记录"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/review [post]
func ApproveReviewHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return reviewActionHandler(pool, datasourcepb.ReviewAction_APPROVE)
}

// RejectReviewHandler 复核拒绝
// @Summary      复核拒绝
// @Description  将 cleaned_job_sources 记录标记为复核拒绝（REJECTED）
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody  "复核后记录"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/review [delete]
func RejectReviewHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return reviewActionHandler(pool, datasourcepb.ReviewAction_REJECT)
}

// EditReviewHandler 修改后通过复核
// @Summary      修改后通过复核
// @Description  修改部分字段后将 cleaned_job_sources 记录标记为复核通过（PASSED）
// @Tags         数据治理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id      path      int                 true  "cleaned_job_sources.id"
// @Param        request body      editReviewRequest   true  "修改后的字段"
// @Success      200  {object}  response.SuccessBody  "复核后记录"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/review [put]
func EditReviewHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var req editReviewRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("data-source-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ReviewJob(ctx, &datasourcepb.ReviewJobRequest{
			Id:     id,
			Action: datasourcepb.ReviewAction_APPROVE_WITH_EDIT,
			Edited: &datasourcepb.CleanedJobDetail{
				JobName:        req.JobName,
				CompanyName:    req.CompanyName,
				Salary:         req.Salary,
				City:           req.City,
				Education:      req.Education,
				Experience:     req.Experience,
				JobDescription: req.JobDescription,
			},
			TraceId:       c.GetString("trace_id"),
			UserId:        userIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		response.Success(c, gin.H{"job": resp.GetJob()})
	}
}

// reviewActionHandler 通过/拒绝复核的公共 handler
func reviewActionHandler(pool *grpcpool.GrpcClientPool, action datasourcepb.ReviewAction) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("data-source-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ReviewJob(ctx, &datasourcepb.ReviewJobRequest{
			Id:            id,
			Action:        action,
			TraceId:       c.GetString("trace_id"),
			UserId:        userIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		response.Success(c, gin.H{"job": resp.GetJob()})
	}
}
