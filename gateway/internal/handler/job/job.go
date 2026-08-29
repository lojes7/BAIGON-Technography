// 百工谱 — 已审核岗位 REST handler
package job

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"
	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type listJobsRequest struct {
	Page         int    `json:"page" example:"0"`
	PageSize     int    `json:"pageSize" example:"20"`
	Name         string `json:"name" example:"Java开发工程师"`
	OccupationID *int64 `json:"occupationId" example:"123"`
	MajorID      *int64 `json:"majorId" example:"456"`
	Major        string `json:"major" example:"计算机科学与技术"`
	City         string `json:"city" example:"杭州"`
	Province     string `json:"province" example:"浙江"`
	Salary       string `json:"salary" example:"15K-25K"`
	Company      string `json:"company" example:"百工科技"`
	Education    string `json:"education" example:"本科"`
	Nature       string `json:"nature" example:"全职"`
	CompanySize  string `json:"companySize" example:"100-499人"`
}

type lookupIDsRequest struct {
	IDs []int64 `json:"ids"`
}

// ListJobsHandler 分页查询 jobs，并按请求体中的岗位字段组合筛选。
// @Summary      分页查询岗位
// @Description  文本条件忽略大小写并执行包含匹配，majorId、occupationId 执行精确匹配
// @Tags         岗位
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body listJobsRequest true "分页与岗位筛选条件"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData} "data 内含 ids/total/page/pageSize"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/jobs [post]
func ListJobsHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request listJobsRequest
		if err := c.ShouldBindJSON(&request); err != nil || !validListRequest(request) {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		occupationID := int64(0)
		if request.OccupationID != nil {
			occupationID = *request.OccupationID
		}
		majorID := int64(0)
		if request.MajorID != nil {
			majorID = *request.MajorID
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).ListJobs(
			ctx,
			&occupationpb.ListJobsRequest{
				Page: int32(request.Page), PageSize: int32(request.PageSize),
				Name: request.Name, OccupationId: occupationID,
				MajorId: majorID, Major: request.Major,
				City: request.City, Province: request.Province, Salary: request.Salary,
				Company: request.Company, Education: request.Education,
				Nature: request.Nature, CompanySize: request.CompanySize,
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
			"ids": nonNilIDs(result.GetIds()), "total": result.GetTotal(),
			"page": result.GetPage(), "pageSize": result.GetPageSize(),
		})
	}
}

// GetJobHandler 查询单个岗位本体及其外键、岗位技能关系 ID。
// @Summary      查询岗位详情
// @Tags         岗位
// @Produce      json
// @Security     Bearer
// @Param        id path int true "jobs.id"
// @Success      200 {object} response.SuccessBody{data=job.JobData} "data 为扁平岗位详情与 jobSkillIds"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/jobs/{id} [get]
func GetJobHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetJob(
			ctx,
			&occupationpb.GetJobRequest{
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

		response.Success(c, jobData(result.GetJob()))
	}
}

// LookupJobsHandler 批量解析岗位详情，最多 200 个去重 ID。
// @Summary      批量查询岗位详情
// @Tags         岗位
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body lookupIDsRequest true "岗位 ID"
// @Success      200 {object} response.SuccessBody{data=job.JobLookupData} "data 含 items/missingIds"
// @Router       /api/jobs/lookup [post]
func LookupJobsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body lookupIDsRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeLookupIDs(body.IDs)
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
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupJobs(
			ctx, &occupationpb.CatalogLookupRequest{
				Ids: ids, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			}, grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, jobData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

// GetJobSkillHandler 查询单个正式岗位技能关系本体。
// @Summary      查询岗位技能详情
// @Tags         岗位
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skills.id"
// @Success      200 {object} response.SuccessBody{data=job.JobSkillData}
// @Router       /api/job-skills/{id} [get]
func GetJobSkillHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := parsePositiveID(c.Param("id"))
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetJobSkill(
			ctx, &occupationpb.GetJobRequest{
				Id: id, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			}, grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, jobSkillData(result.GetJobSkill()))
	}
}

// LookupJobSkillsHandler 批量解析正式岗位技能关系详情。
// @Summary      批量查询岗位技能详情
// @Tags         岗位
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body lookupIDsRequest true "岗位技能 ID"
// @Success      200 {object} response.SuccessBody{data=job.JobSkillLookupData} "data 含 items/missingIds"
// @Router       /api/job-skills/lookup [post]
func LookupJobSkillsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body lookupIDsRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		ids, ok := normalizeLookupIDs(body.IDs)
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
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupJobSkills(
			ctx, &occupationpb.CatalogLookupRequest{
				Ids: ids, TraceId: c.GetString("trace_id"),
				UserId: commonhandler.UserIDFromContext(c), UserName: c.GetString("uid"),
				UserIp: c.ClientIP(), RequestMethod: c.Request.Method,
				RequestUrl: c.Request.URL.Path,
			}, grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, jobSkillData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

func validListRequest(request listJobsRequest) bool {
	if request.Page < 0 || request.PageSize < 0 || request.PageSize > 100 {
		return false
	}
	return (request.OccupationID == nil || *request.OccupationID > 0) &&
		(request.MajorID == nil || *request.MajorID > 0)
}

func normalizeLookupIDs(values []int64) ([]int64, bool) {
	// 先限制原始请求数量，避免大量重复 ID 绕过 200 条上限。
	if len(values) == 0 || len(values) > 200 {
		return nil, false
	}
	seen := make(map[int64]struct{}, len(values))
	ids := make([]int64, 0, len(values))
	for _, id := range values {
		if id <= 0 {
			return nil, false
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, true
}

func nonNilIDs(values []int64) []int64 {
	ids := make([]int64, len(values))
	copy(ids, values)
	return ids
}

func jobData(job *occupationpb.JobData) gin.H {
	if job == nil {
		return nil
	}
	var occupationID any
	if job.GetOccupationId() > 0 {
		occupationID = job.GetOccupationId()
	}
	var majorID any
	if job.GetMajorId() > 0 {
		majorID = job.GetMajorId()
	}
	return gin.H{
		"id": job.GetId(), "name": job.GetName(), "occupationId": occupationID,
		"majorId":     majorID,
		"publishDate": job.GetPublishDate(), "sourcePlatform": job.GetSourcePlatform(),
		"sourceUrl": job.GetSourceUrl(), "city": job.GetCity(), "tags": job.GetTags(),
		"major": job.GetMajor(), "nature": job.GetNature(), "salary": job.GetSalary(),
		"companyName": job.GetCompanyName(), "companySize": job.GetCompanySize(),
		"province": job.GetProvince(), "education": job.GetEducation(),
		"experience": job.GetExperience(), "jobDescription": job.GetJobDescription(),
		"createdAt": job.GetCreatedAt(), "updatedAt": job.GetUpdatedAt(),
		"jobSkillIds": nonNilIDs(job.GetJobSkillIds()),
	}
}

func jobSkillData(skill *occupationpb.JobSkillData) gin.H {
	var skillID any
	if skill.GetSkillId() > 0 {
		skillID = skill.GetSkillId()
	}
	return gin.H{
		"id": skill.GetId(), "jobId": skill.GetJobId(),
		"skillId": skillID, "skillName": skill.GetSkillName(),
		"skillProficiency": skill.GetSkillProficiency(), "evidence": skill.GetEvidence(),
	}
}

// MatchMyResumeToJobHandler 使用当前用户最新简历与指定 jobs 记录进行匹配。
// @Summary      匹配我的简历与岗位
// @Description  服务端自动选取当前用户最新简历，并仅使用指定 jobs 记录的岗位信息进行匹配。
// @Tags         岗位
// @Produce      json
// @Security     Bearer
// @Param        id path int true "jobs.id"
// @Success      200 {object} response.SuccessBody{data=response.IDData} "data 仅含匹配结果 id"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/jobs/{id}/match [post]
func MatchMyResumeToJobHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}
		jobID, ok := parsePositiveID(c.Param("id"))
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		// 人岗匹配包含 AI 调用，不在远程分析完成前提前结束请求。
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Minute)
		defer cancel()
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).MatchMyResumeToJob(
			ctx,
			&userpb.MatchMyResumeToJobRequest{
				JobId: jobID, TraceId: c.GetString("trace_id"), UserId: userID,
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
		if result == nil || result.GetId() <= 0 || result.GetResumeId() <= 0 || result.GetJobId() != jobID ||
			result.GetScore() < 0 || result.GetScore() > 100 {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}

		response.Success(c, gin.H{"id": result.GetId()})
	}
}

// GetLatestMyJobMatchHandler 按岗位 ID 查询当前用户最新一次人岗匹配结果。
// @Summary      查询我的最新人岗匹配结果
// @Description  前端只需提供岗位 ID；用户 ID 由 Gateway 从 JWT 透传。
// @Tags         岗位
// @Produce      json
// @Security     Bearer
// @Param        id path int true "jobs.id"
// @Success      200 {object} response.SuccessBody{data=job.MatchResultData} "data 内含匹配结果 ID、分数、摘要、待学习技能和行动建议"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/jobs/{id}/match [get]
func GetLatestMyJobMatchHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}
		jobID, ok := parsePositiveID(c.Param("id"))
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
		result, err := userpb.NewUserServiceClient(conn).GetLatestMyJobMatch(
			ctx,
			&userpb.GetLatestMyJobMatchRequest{
				JobId: jobID, TraceId: c.GetString("trace_id"), UserId: userID,
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
		if result == nil || result.GetId() <= 0 || result.GetResumeId() <= 0 ||
			result.GetJobId() != jobID || result.GetScore() < 0 || result.GetScore() > 100 {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}

		response.Success(c, matchResponseData(result))
	}
}

func parsePositiveID(value string) (int64, bool) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func matchResponseData(result *userpb.MatchMyResumeToJobResponse) gin.H {
	skills := make([]gin.H, 0, len(result.GetSkillsToLearn()))
	for _, skill := range result.GetSkillsToLearn() {
		if skill == nil {
			continue
		}
		skills = append(skills, gin.H{
			"skillName": skill.GetSkillName(), "reason": skill.GetReason(),
			"suggestion": skill.GetSuggestion(),
		})
	}
	actions := make([]string, 0, len(result.GetActionSuggestions()))
	actions = append(actions, result.GetActionSuggestions()...)
	return gin.H{
		"id": result.GetId(), "resumeId": result.GetResumeId(), "jobId": result.GetJobId(),
		"score": result.GetScore(), "summary": result.GetSummary(),
		"skillsToLearn": skills, "actionSuggestions": actions,
		"createdAt": result.GetCreatedAt(),
	}
}
