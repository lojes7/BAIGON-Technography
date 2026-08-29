// 百工谱 — 岗位分析任务与子资源 REST handler
package jobanalysis

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

type resource int

const (
	tasks resource = iota
	occupationCandidates
	majorCandidates
	results
)

type lookupRequest struct {
	IDs []int64 `json:"ids"`
}

type reviewRequest struct {
	MajorID      int64         `json:"majorId" binding:"required"`
	OccupationID int64         `json:"occupationId" binding:"required"`
	SkillReviews []skillReview `json:"skillReviews"`
}

type skillReview struct {
	ResultID         int64  `json:"resultId"`
	Action           string `json:"action"`
	SkillName        string `json:"skillName"`
	SkillProficiency string `json:"skillProficiency"`
	Evidence         string `json:"evidence"`
}

// ListTasksHandler 返回岗位分析任务 ID 页。
// @Summary      分页查询岗位分析任务 ID
// @Tags         岗位分析审核
// @Produce      json
// @Security     Bearer
// @Param        page query int false "页码，从 0 开始"
// @Param        pageSize query int false "每页条数，默认 20，最大 100"
// @Param        taskStatus query string false "PENDING / SUCCESS / FAILED"
// @Param        reviewStatus query string false "PENDING / PASSED / REJECTED"
// @Success      200 {object} response.SuccessBody{data=response.IDPageData} "data 含 ids/total/page/pageSize"
// @Router       /api/auth/occupation/job-analysis [get]
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
		result, err := occupationpb.NewOccupationServiceClient(conn).ListJobAnalysisTasks(
			ctx, &occupationpb.ListJobAnalysisTasksRequest{
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
// @Summary 批量查询岗位分析任务本体
// @Tags 岗位分析审核
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个任务 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.TaskLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/lookup [post]
func LookupTasksHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, tasks)
}

// GetTaskHandler 返回任务本体与子资源 ID。
// @Summary 查询岗位分析任务详情
// @Tags 岗位分析审核
// @Produce json
// @Security Bearer
// @Param id path int true "任务 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.TaskDetailData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/{id} [get]
func GetTaskHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, tasks)
}

// LookupOccupationCandidatesHandler 批量查询职业候选关系。
// @Summary 批量查询职业候选
// @Tags 岗位分析审核
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个候选 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.OccupationCandidateLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/occupation-candidates/lookup [post]
func LookupOccupationCandidatesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, occupationCandidates)
}

// GetOccupationCandidateHandler 查询职业候选关系。
// @Summary 查询职业候选详情
// @Tags 岗位分析审核
// @Produce json
// @Security Bearer
// @Param id path int true "候选 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.OccupationCandidateData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/occupation-candidates/{id} [get]
func GetOccupationCandidateHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, occupationCandidates)
}

// LookupMajorCandidatesHandler 批量查询专业候选关系。
// @Summary 批量查询专业候选
// @Tags 岗位分析审核
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个候选 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.MajorCandidateLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/major-candidates/lookup [post]
func LookupMajorCandidatesHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, majorCandidates)
}

// GetMajorCandidateHandler 查询专业候选关系。
// @Summary 查询专业候选详情
// @Tags 岗位分析审核
// @Produce json
// @Security Bearer
// @Param id path int true "候选 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.MajorCandidateData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/major-candidates/{id} [get]
func GetMajorCandidateHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, majorCandidates)
}

// LookupResultsHandler 批量查询岗位分析结果本体。
// @Summary 批量查询岗位分析结果
// @Tags 岗位分析审核
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body lookupRequest true "1 至 200 个结果 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.ResultLookupData}
// @Failure 400 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/results/lookup [post]
func LookupResultsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return lookupHandler(pool, results)
}

// GetResultHandler 查询岗位分析结果本体。
// @Summary 查询岗位分析结果详情
// @Tags 岗位分析审核
// @Produce json
// @Security Bearer
// @Param id path int true "结果 ID"
// @Success 200 {object} response.SuccessBody{data=jobanalysis.ResultData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/results/{id} [get]
func GetResultHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return getHandler(pool, results)
}

func getHandler(pool grpcpool.ConnectionProvider, target resource) gin.HandlerFunc {
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
		request := detailRequest(c, id)
		client := occupationpb.NewOccupationServiceClient(conn)
		var trailer metadata.MD
		var data gin.H
		switch target {
		case tasks:
			result, callErr := client.GetJobAnalysisTask(ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				data = taskDetailData(result.GetAnalysis())
			}
		case occupationCandidates:
			result, callErr := client.GetJobAnalysisOccupationCandidate(
				ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				data = occupationCandidateData(result.GetItem())
			}
		case majorCandidates:
			result, callErr := client.GetJobAnalysisMajorCandidate(
				ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				data = majorCandidateData(result.GetItem())
			}
		case results:
			result, callErr := client.GetJobAnalysisResult(ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				data = resultData(result.GetItem())
			}
		}
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, data)
	}
}

func lookupHandler(pool grpcpool.ConnectionProvider, target resource) gin.HandlerFunc {
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
		request := lookupRPCRequest(c, ids)
		client := occupationpb.NewOccupationServiceClient(conn)
		var trailer metadata.MD
		items := make([]gin.H, 0)
		var missingIDs []int64
		switch target {
		case tasks:
			result, callErr := client.LookupJobAnalysisTasks(ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				for _, item := range result.GetItems() {
					items = append(items, taskData(item))
				}
				missingIDs = result.GetMissingIds()
			}
		case occupationCandidates:
			result, callErr := client.LookupJobAnalysisOccupationCandidates(
				ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				for _, item := range result.GetItems() {
					items = append(items, occupationCandidateData(item))
				}
				missingIDs = result.GetMissingIds()
			}
		case majorCandidates:
			result, callErr := client.LookupJobAnalysisMajorCandidates(
				ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				for _, item := range result.GetItems() {
					items = append(items, majorCandidateData(item))
				}
				missingIDs = result.GetMissingIds()
			}
		case results:
			result, callErr := client.LookupJobAnalysisResults(ctx, request, grpc.Trailer(&trailer))
			err = callErr
			if result != nil {
				for _, item := range result.GetItems() {
					items = append(items, resultData(item))
				}
				missingIDs = result.GetMissingIds()
			}
		}
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{"items": items, "missingIds": nonNilIDs(missingIDs)})
	}
}

// ReviewTaskHandler 审核写操作只返回任务 ID。
// @Summary 审核岗位分析任务
// @Tags 岗位分析审核
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "任务 ID"
// @Param body body reviewRequest true "审核选择与技能处理结果"
// @Success 200 {object} response.SuccessBody{data=response.IDData}
// @Failure 400 {object} response.ErrorBody
// @Failure 404 {object} response.ErrorBody
// @Router /api/auth/occupation/job-analysis/{id}/review [put]
func ReviewTaskHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := commonhandler.PositivePathID(c, "id")
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		var body reviewRequest
		if err := c.ShouldBindJSON(&body); err != nil || body.MajorID <= 0 || body.OccupationID <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		reviews := make([]*occupationpb.JobAnalysisSkillReview, 0, len(body.SkillReviews))
		for _, item := range body.SkillReviews {
			reviews = append(reviews, &occupationpb.JobAnalysisSkillReview{
				ResultId: item.ResultID, Action: strings.TrimSpace(item.Action),
				SkillName:        strings.TrimSpace(item.SkillName),
				SkillProficiency: strings.TrimSpace(item.SkillProficiency),
				Evidence:         strings.TrimSpace(item.Evidence),
			})
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).ReviewJobAnalysisTask(
			ctx, &occupationpb.ReviewJobAnalysisTaskRequest{
				Id: id, MajorId: body.MajorID, OccupationId: body.OccupationID,
				SkillReviews: reviews,
				TraceId:      c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
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

func taskData(task *occupationpb.JobAnalysisTaskSummary) gin.H {
	if task == nil {
		return nil
	}
	return gin.H{
		"id": task.GetId(), "jobId": task.GetJobId(),
		"taskStatus": task.GetTaskStatus(), "reviewStatus": task.GetReviewStatus(),
		"selectedOccupationId": nullableID(task.GetSelectedOccupationId()),
		"attempts":             task.GetAttempts(), "createdAt": task.GetCreatedAt(),
		"reviewedAt":               nullableText(task.GetReviewedAt()),
		"reviewedBy":               nullableID(task.GetReviewedBy()),
		"occupationAnalysisStatus": task.GetOccupationAnalysisStatus(),
		"jdAnalysisStatus":         task.GetJdAnalysisStatus(),
		"selectedMajorId":          nullableID(task.GetSelectedMajorId()),
		"majorAnalysisStatus":      task.GetMajorAnalysisStatus(),
	}
}

func taskDetailData(detail *occupationpb.JobAnalysisTaskDetail) gin.H {
	if detail == nil {
		return nil
	}
	data := taskData(detail.GetTask())
	if data == nil {
		data = gin.H{}
	}
	data["candidateIds"] = nonNilIDs(detail.GetCandidateIds())
	data["majorCandidateIds"] = nonNilIDs(detail.GetMajorCandidateIds())
	data["resultIds"] = nonNilIDs(detail.GetResultIds())
	return data
}

func occupationCandidateData(item *occupationpb.JobAnalysisCandidate) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{"id": item.GetId(), "occupationId": item.GetOccupationId(),
		"rank": item.GetRank(), "similarity": item.GetSimilarity()}
}

func majorCandidateData(item *occupationpb.JobAnalysisMajorCandidate) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{"id": item.GetId(), "majorId": item.GetMajorId(),
		"rank": item.GetRank(), "similarity": item.GetSimilarity()}
}

func resultData(item *occupationpb.JobAnalysisResult) gin.H {
	if item == nil {
		return nil
	}
	return gin.H{
		"id": item.GetId(), "jobId": item.GetJobId(),
		"skillName": item.GetSkillName(), "skillProficiency": item.GetSkillProficiency(),
		"evidence": item.GetEvidence(), "rank": item.GetRank(),
		"reviewStatus": item.GetReviewStatus(), "reviewAction": item.GetReviewAction(),
		"reviewedSkillName":        item.GetReviewedSkillName(),
		"reviewedSkillProficiency": item.GetReviewedSkillProficiency(),
		"reviewedEvidence":         item.GetReviewedEvidence(),
		"reviewedAt":               nullableText(item.GetReviewedAt()),
		"reviewedBy":               nullableID(item.GetReviewedBy()),
	}
}

func detailRequest(c *gin.Context, id int64) *occupationpb.GetJobAnalysisTaskRequest {
	return &occupationpb.GetJobAnalysisTaskRequest{
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
