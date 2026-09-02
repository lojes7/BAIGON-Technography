// 百工谱 — 数据治理 REST handler
// 网关 REST → gRPC 调用 occupation-service（清洗数据查询与人工复核）

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
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
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
	MajorName      string `json:"majorName"`      // 专业要求
	Salary         string `json:"salary"`         // 薪资
	City           string `json:"city"`           // 城市
	Education      string `json:"education"`      // 学历要求
	Experience     string `json:"experience"`     // 经验要求
	JobDescription string `json:"jobDescription"` // 岗位描述
}

type dataSourceBatchRequest struct {
	IDs []int64 `json:"ids" binding:"required"`
}

// ListCleanedJobsHandler 分页查询清洗后岗位列表
// @Summary      分页查询清洗后岗位
// @Description  分页查询 cleaned_job_sources，支持按复核状态、发布时间筛选；仅返回记录 ID 与分页元数据
// @Tags         数据治理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body listCleanedJobsRequest true "分页筛选请求"
// @Success      200  {object}  response.SuccessBody{data=response.IDPageData}  "列表，data 内含 ids/total/page/pageSize"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      503  {object}  response.ErrorBody    "occupation 服务不可用"
// @Router       /api/auth/data-source [post]
func ListCleanedJobsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req listCleanedJobsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
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

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ListCleanedJobs(ctx, &datasourcepb.ListCleanedJobsRequest{
			Page:            int32(req.Page),
			PageSize:        int32(req.PageSize),
			ReviewStatus:    req.ReviewStatus,
			PublishDateFrom: req.PublishDateFrom,
			PublishDateTo:   req.PublishDateTo,
			TraceId:         c.GetString("trace_id"),
			UserId:          UserIDFromContext(c),
			UserName:        c.GetString("uid"),
			UserIp:          c.ClientIP(),
			RequestMethod:   c.Request.Method,
			RequestUrl:      c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{
			"ids":      nonNilDataSourceIDs(resp.GetCleanedJobIds()),
			"total":    resp.GetTotal(),
			"page":     resp.GetPage(),
			"pageSize": resp.GetPageSize(),
		})
	}
}

// BatchGetCleanedJobsHandler 按 ID 批量查询清洗岗位详情。
// @Summary      批量查询清洗岗位摘要
// @Tags         数据治理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        body body dataSourceBatchRequest true "1 至 200 个清洗岗位 ID"
// @Success      200 {object} response.SuccessBody{data=datasource.CleanedJobLookupData}
// @Failure      400 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Router       /api/auth/data-source/lookup [post]
func BatchGetCleanedJobsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dataSourceBatchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeDataSourceBatchIDs(req.IDs)
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
		var trailers metadata.MD
		result, err := datasourcepb.NewDataSourceServiceClient(conn).BatchGetCleanedJobs(
			ctx,
			&datasourcepb.BatchGetCleanedJobsRequest{
				Ids: ids, TraceId: c.GetString("trace_id"),
				UserId: UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailers),
		)
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailers)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetJobs()))
		for _, job := range result.GetJobs() {
			items = append(items, cleanedJobSummaryData(job))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilDataSourceIDs(result.GetMissingIds()),
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
// @Success      200  {object}  response.SuccessBody{data=datasource.CleanedJobData}  "详情，data 为扁平岗位对象"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN / DATA_REVIEWER"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "occupation 服务不可用"
// @Router       /api/auth/data-source/{id} [get]
func GetCleanedJobHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
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

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).GetCleanedJob(ctx, &datasourcepb.GetCleanedJobRequest{
			Id:            id,
			TraceId:       c.GetString("trace_id"),
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, cleanedJobData(resp.GetJob()))
	}
}

// GetSourceJobHandler 查看原始记录
// @Summary      查看原始记录
// @Description  查看 cleaned_job_sources 对应 job_sources 表的原始记录（经 crawler-service 查询）
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody{data=datasource.SourceJobData}  "原始记录，data 为扁平岗位对象"
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

		conn, err := pool.GetConn("occupation-service")
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
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, sourceJobData(resp.GetSource()))
	}
}

// ApproveReviewHandler 复核通过
// @Summary      复核通过
// @Description  将 cleaned_job_sources 标记为 PASSED，并把原业务数据保存到 reviewed_cleaned_job_sources
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "data 仅含 cleaned-job id"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "无权限(code=403)或记录已被其他审核人处理(code=40301)"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/review [post]
func ApproveReviewHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return reviewActionHandler(pool, datasourcepb.ReviewAction_APPROVE)
}

// RejectReviewHandler 复核拒绝
// @Summary      复核拒绝
// @Description  将 cleaned_job_sources 标记为 REJECTED，不写入 reviewed_cleaned_job_sources
// @Tags         数据治理
// @Produce      json
// @Security     Bearer
// @Param        id   path      int  true  "cleaned_job_sources.id"
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "data 仅含 cleaned-job id"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "无权限(code=403)或记录已被其他审核人处理(code=40301)"
// @Failure      404  {object}  response.ErrorBody    "记录不存在"
// @Failure      503  {object}  response.ErrorBody    "服务不可用"
// @Router       /api/auth/data-source/{id}/review [delete]
func RejectReviewHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return reviewActionHandler(pool, datasourcepb.ReviewAction_REJECT)
}

// EditReviewHandler 修改后通过复核
// @Summary      修改后通过复核
// @Description  cleaned_job_sources 只更新审核参数；编辑后的版本保存到 reviewed_cleaned_job_sources
// @Tags         数据治理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id      path      int                 true  "cleaned_job_sources.id"
// @Param        request body      editReviewRequest   true  "修改后的字段"
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "data 仅含 cleaned-job id"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "无权限(code=403)或记录已被其他审核人处理(code=40301)"
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

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		var trailers metadata.MD
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ReviewJob(ctx, &datasourcepb.ReviewJobRequest{
			Id:     id,
			Action: datasourcepb.ReviewAction_APPROVE_WITH_EDIT,
			Edited: &datasourcepb.CleanedJobDetail{
				JobName:        req.JobName,
				CompanyName:    req.CompanyName,
				Major:          req.MajorName,
				Salary:         req.Salary,
				City:           req.City,
				Education:      req.Education,
				Experience:     req.Experience,
				JobDescription: req.JobDescription,
			},
			TraceId:       c.GetString("trace_id"),
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		}, grpc.Trailer(&trailers))
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailers)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{"id": resp.GetCleanedJobId()})
	}
}

func normalizeDataSourceBatchIDs(ids []int64) ([]int64, bool) {
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

func nonNilDataSourceIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}

// cleanedJobData 在 REST 边界显式定义 camelCase DTO，避免泄漏 protobuf 的字段命名与包装层。
func cleanedJobData(job *datasourcepb.CleanedJobDetail) gin.H {
	if job == nil {
		return gin.H{}
	}
	var reviewedAt any
	if job.GetReviewedAt() != "" {
		reviewedAt = job.GetReviewedAt()
	}
	var reviewedBy any
	if job.GetReviewedBy() > 0 {
		reviewedBy = job.GetReviewedBy()
	}
	return gin.H{
		"id":             job.GetId(),
		"publishDate":    job.GetPublishDate(),
		"sourcePlatform": job.GetSourcePlatform(),
		"sourceUrl":      job.GetSourceUrl(),
		"city":           job.GetCity(),
		"tags":           job.GetTags(),
		"major":          job.GetMajor(),
		"nature":         job.GetNature(),
		"salary":         job.GetSalary(),
		"jobName":        job.GetJobName(),
		"companyName":    job.GetCompanyName(),
		"companySize":    job.GetCompanySize(),
		"province":       job.GetProvince(),
		"education":      job.GetEducation(),
		"experience":     job.GetExperience(),
		"jobDescription": job.GetJobDescription(),
		"reviewStatus":   job.GetReviewStatus(),
		"reviewedAt":     reviewedAt,
		"reviewedBy":     reviewedBy,
		"createdAt":      job.GetCreatedAt(),
	}
}

// sourceJobData 将跨服务原始记录投影成稳定的 REST DTO。
func sourceJobData(job *datasourcepb.SourceJobDetail) gin.H {
	if job == nil {
		return gin.H{}
	}
	return gin.H{
		"id":             job.GetId(),
		"publishDate":    job.GetPublishDate(),
		"sourcePlatform": job.GetSourcePlatform(),
		"sourceUrl":      job.GetSourceUrl(),
		"city":           job.GetCity(),
		"tags":           job.GetTags(),
		"major":          job.GetMajor(),
		"nature":         job.GetNature(),
		"salary":         job.GetSalary(),
		"jobName":        job.GetJobName(),
		"companyName":    job.GetCompanyName(),
		"companySize":    job.GetCompanySize(),
		"province":       job.GetProvince(),
		"education":      job.GetEducation(),
		"experience":     job.GetExperience(),
		"jobDescription": job.GetJobDescription(),
	}
}

// cleanedJobSummaryData 仅返回列表渲染所需字段，避免批量查询携带长描述等详情。
func cleanedJobSummaryData(job *datasourcepb.CleanedJobDetail) gin.H {
	if job == nil {
		return gin.H{}
	}
	return gin.H{
		"id":             job.GetId(),
		"jobName":        job.GetJobName(),
		"companyName":    job.GetCompanyName(),
		"sourcePlatform": job.GetSourcePlatform(),
		"publishDate":    job.GetPublishDate(),
		"createdAt":      job.GetCreatedAt(),
		"reviewStatus":   job.GetReviewStatus(),
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

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 审计字段（gateway 透传用户上下文，供后端写 logs 表）
		var trailers metadata.MD
		resp, err := datasourcepb.NewDataSourceServiceClient(conn).ReviewJob(ctx, &datasourcepb.ReviewJobRequest{
			Id:            id,
			Action:        action,
			TraceId:       c.GetString("trace_id"),
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		}, grpc.Trailer(&trailers))
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err, trailers)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{"id": resp.GetCleanedJobId()})
	}
}
