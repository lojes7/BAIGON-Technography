// 百工谱 — 岗位技能归一任务与候选资源 REST handler
package skillresolution

import (
	"context"
	"net/http"
	"strings"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type lookupRequest struct {
	IDs []int64 `json:"ids"`
}

type reviewRequest struct {
	ResolutionAction string  `json:"resolutionAction" binding:"required"`
	SkillID          int64   `json:"skillId"`
	NewSkillName     string  `json:"newSkillName"`
	ParentSkillIDs   []int64 `json:"parentSkillIds"`
}

// ListTasksHandler 返回技能归一任务 ID 页。
// @Summary      分页查询岗位技能归一任务 ID
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        taskStatus query string false "PENDING / RUNNING / SUCCESS / FAILED"
// @Param        reviewStatus query string false "PENDING / PASSED"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData} "data 含 ids/total/page/pageSize"
// @Router       /api/auth/occupation/job-skill-resolution [get]
func ListTasksHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, err := commonhandler.ParseCatalogPageQuery(c)
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
		result, err := occupationpb.NewOccupationServiceClient(conn).ListJobSkillResolutionTasks(
			ctx, &occupationpb.ListJobSkillResolutionTasksRequest{
				Page: page.Page, PageSize: page.PageSize,
				TaskStatus: c.Query("taskStatus"), ReviewStatus: c.Query("reviewStatus"),
				TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			}, grpc.Trailer(&trailer))
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

// LookupTasksHandler 按 ID 批量解析任务本体。
// @Summary      批量查询技能归一任务
// @Tags         技能归一审核
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody{data=skillresolution.TaskLookupData} "data 含 items/missingIds"
// @Router       /api/auth/occupation/job-skill-resolution/lookup [post]
func LookupTasksHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		ids, ok := bindLookupIDs(c)
		if !ok {
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
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupJobSkillResolutionTasks(
			ctx, lookupRPCRequest(c, ids), grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, taskData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

// GetTaskHandler 返回任务本体与候选资源 ID。
// @Summary      查询技能归一任务详情
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Success      200 {object} response.SuccessBody{data=skillresolution.TaskDetailData}
// @Router       /api/auth/occupation/job-skill-resolution/{id} [get]
func GetTaskHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := commonhandler.PositivePathID(c, "id")
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetJobSkillResolutionTask(
			ctx, detailRequest(c, id), grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, taskDetailData(result.GetResolution()))
	}
}

// LookupCandidatesHandler 按持久化候选资源 ID 批量解析候选。
// @Summary      批量查询技能归一候选
// @Tags         技能归一审核
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody{data=skillresolution.CandidateLookupData} "data 含 items/missingIds"
// @Router       /api/auth/occupation/job-skill-resolution/candidates/lookup [post]
func LookupCandidatesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		ids, ok := bindLookupIDs(c)
		if !ok {
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
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupJobSkillResolutionCandidates(
			ctx, lookupRPCRequest(c, ids), grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, candidateData(item))
		}
		response.Success(c, gin.H{
			"items": items, "missingIds": nonNilIDs(result.GetMissingIds()),
		})
	}
}

// GetCandidateHandler 查询单个持久化候选。
// @Summary      查询技能归一候选详情
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_candidates.id"
// @Success      200 {object} response.SuccessBody{data=skillresolution.CandidateData}
// @Router       /api/auth/occupation/job-skill-resolution/candidates/{id} [get]
func GetCandidateHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := commonhandler.PositivePathID(c, "id")
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetJobSkillResolutionCandidate(
			ctx, detailRequest(c, id), grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, candidateData(result.GetItem()))
	}
}

// ListSimilarSkillsHandler 返回实时计算的 Top 5 技能引用，不复制技能名称。
// @Summary      查询技能归一 Top 5 相似技能
// @Tags         技能归一审核
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Success      200 {object} response.SuccessBody{data=skillresolution.SimilarSkillListData}
// @Router       /api/auth/occupation/job-skill-resolution/{id}/similar-skills [get]
func ListSimilarSkillsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := commonhandler.PositivePathID(c, "id")
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
		result, err := occupationpb.NewOccupationServiceClient(conn).ListJobSkillResolutionSimilarSkills(
			ctx, detailRequest(c, id), grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, similarSkillData(item))
		}
		response.Success(c, gin.H{"items": items})
	}
}

// ReviewTaskHandler 审核写操作只返回任务 ID。
// @Summary      审核岗位技能归一任务
// @Description  SELECT_CANDIDATE 选择当前候选；SELECT_EXISTING 选择任意规范技能；CREATE_NEW 创建新技能并可指定最多 20 个直接父技能
// @Tags         技能归一审核
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id path int true "job_skill_resolution_tasks.id"
// @Param        request body reviewRequest true "技能归一动作"
// @Success      200 {object} response.SuccessBody{data=response.IDData} "data 仅含 id"
// @Router       /api/auth/occupation/job-skill-resolution/{id}/review [put]
func ReviewTaskHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := commonhandler.PositivePathID(c, "id")
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var body reviewRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		body.ResolutionAction = strings.TrimSpace(body.ResolutionAction)
		body.NewSkillName = strings.TrimSpace(body.NewSkillName)
		if !validReview(body) {
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
		result, err := occupationpb.NewOccupationServiceClient(conn).ReviewJobSkillResolutionTask(
			ctx, &occupationpb.ReviewJobSkillResolutionTaskRequest{
				Id: id, ResolutionAction: body.ResolutionAction, SkillId: body.SkillID,
				NewSkillName: body.NewSkillName, ParentSkillIds: body.ParentSkillIDs,
				TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			}, grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"id": result.GetId()})
	}
}

func taskData(task *occupationpb.JobSkillResolutionTaskSummary) gin.H {
	if task == nil {
		return nil
	}
	return gin.H{
		"id": task.GetId(), "jobSkillId": task.GetJobSkillId(),
		"taskStatus": task.GetTaskStatus(), "reviewStatus": task.GetReviewStatus(),
		"resolutionAction": task.GetResolutionAction(),
		"selectedSkillId":  nullableID(task.GetSelectedSkillId()),
		"attempts":         task.GetAttempts(), "createdAt": task.GetCreatedAt(),
		"reviewedAt": nullableText(task.GetReviewedAt()),
		"reviewedBy": nullableID(task.GetReviewedBy()),
	}
}

func taskDetailData(detail *occupationpb.JobSkillResolutionTaskDetail) gin.H {
	if detail == nil {
		return nil
	}
	data := taskData(detail.GetTask())
	if data == nil {
		data = gin.H{}
	}
	data["candidateIds"] = nonNilIDs(detail.GetCandidateIds())
	return data
}

func candidateData(item *occupationpb.JobSkillResolutionCandidate) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{
		"id": item.GetId(), "skillId": item.GetSkillId(),
		"rank": item.GetRank(), "similarity": item.GetSimilarity(),
	}
}

func similarSkillData(item *occupationpb.JobSkillResolutionCandidate) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{
		"skillId": item.GetSkillId(),
		"rank":    item.GetRank(), "similarity": item.GetSimilarity(),
	}
}

func bindLookupIDs(c *gin.Context) ([]int64, bool) {
	var body lookupRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
		return nil, false
	}
	ids, ok := normalizeIDs(body.IDs)
	if !ok {
		response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
		return nil, false
	}
	return ids, true
}

func detailRequest(c *gin.Context, id int64) *occupationpb.GetJobSkillResolutionTaskRequest {
	return &occupationpb.GetJobSkillResolutionTaskRequest{
		Id: id, TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
		UserName: c.GetString("uid"), UserIp: c.ClientIP(),
		RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
	}
}

func lookupRPCRequest(c *gin.Context, ids []int64) *occupationpb.CatalogLookupRequest {
	return &occupationpb.CatalogLookupRequest{
		Ids: ids, TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
		UserName: c.GetString("uid"), UserIp: c.ClientIP(),
		RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
	}
}

func normalizeIDs(values []int64) ([]int64, bool) {
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

func validReview(body reviewRequest) bool {
	switch body.ResolutionAction {
	case "SELECT_CANDIDATE", "SELECT_EXISTING":
		return body.SkillID > 0 && body.NewSkillName == "" && len(body.ParentSkillIDs) == 0
	case "CREATE_NEW":
		if body.SkillID != 0 || body.NewSkillName == "" {
			return false
		}
		seen := make(map[int64]struct{}, len(body.ParentSkillIDs))
		for _, parentSkillID := range body.ParentSkillIDs {
			if parentSkillID <= 0 {
				return false
			}
			seen[parentSkillID] = struct{}{}
		}
		return len(seen) <= 20
	default:
		return false
	}
}

func nonNilIDs(values []int64) []int64 {
	ids := make([]int64, len(values))
	copy(ids, values)
	return ids
}

func nullableID(id int64) any {
	if id <= 0 {
		return nil
	}
	return id
}

func nullableText(value string) any {
	if value == "" {
		return nil
	}
	return value
}
