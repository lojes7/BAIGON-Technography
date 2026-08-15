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

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type listJobsRequest struct {
	Page         int    `json:"page" example:"0"`
	PageSize     int    `json:"pageSize" example:"20"`
	Name         string `json:"name" example:"Java开发工程师"`
	OccupationID *int64 `json:"occupationId" example:"123"`
	Major        string `json:"major" example:"计算机科学与技术"`
	City         string `json:"city" example:"杭州"`
	Province     string `json:"province" example:"浙江"`
	Salary       string `json:"salary" example:"15K-25K"`
	Company      string `json:"company" example:"百工科技"`
	Education    string `json:"education" example:"本科"`
	Nature       string `json:"nature" example:"全职"`
	CompanySize  string `json:"companySize" example:"100-499人"`
}

// ListJobsHandler 分页查询 jobs，并按请求体中的岗位字段组合筛选。
// @Summary      分页查询岗位
// @Description  文本条件忽略大小写并执行包含匹配，occupationId 执行精确匹配
// @Tags         岗位
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body listJobsRequest true "分页与岗位筛选条件"
// @Success      200 {object} response.SuccessBody "data 内含 items/total/page/pageSize"
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
				Name: request.Name, OccupationId: occupationID, Major: request.Major,
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

		items := make([]gin.H, 0, len(result.GetItems()))
		for _, item := range result.GetItems() {
			items = append(items, jobData(item))
		}
		response.Success(c, gin.H{
			"items": items, "total": result.GetTotal(),
			"page": result.GetPage(), "pageSize": result.GetPageSize(),
		})
	}
}

// GetJobHandler 聚合查询单个岗位、对应职业和正式岗位技能。
// @Summary      查询岗位详情
// @Tags         岗位
// @Produce      json
// @Security     Bearer
// @Param        id path int true "jobs.id"
// @Success      200 {object} response.SuccessBody "data 内含 job/occupation/jobSkills"
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

		var occupation any
		if result.GetOccupation() != nil {
			occupation = occupationData(result.GetOccupation())
		}
		skills := make([]gin.H, 0, len(result.GetJobSkills()))
		for _, skill := range result.GetJobSkills() {
			skills = append(skills, jobSkillData(skill))
		}
		response.Success(c, gin.H{
			"job":        jobData(result.GetJob()),
			"occupation": occupation,
			"jobSkills":  skills,
		})
	}
}

func validListRequest(request listJobsRequest) bool {
	if request.Page < 0 || request.PageSize < 0 || request.PageSize > 100 {
		return false
	}
	return request.OccupationID == nil || *request.OccupationID > 0
}

func jobData(job *occupationpb.JobData) gin.H {
	if job == nil {
		return nil
	}
	var occupationID any
	if job.GetOccupationId() > 0 {
		occupationID = job.GetOccupationId()
	}
	return gin.H{
		"id": job.GetId(), "name": job.GetName(), "occupationId": occupationID,
		"publishDate": job.GetPublishDate(), "sourcePlatform": job.GetSourcePlatform(),
		"sourceUrl": job.GetSourceUrl(), "city": job.GetCity(), "tags": job.GetTags(),
		"major": job.GetMajor(), "nature": job.GetNature(), "salary": job.GetSalary(),
		"companyName": job.GetCompanyName(), "companySize": job.GetCompanySize(),
		"province": job.GetProvince(), "education": job.GetEducation(),
		"experience": job.GetExperience(), "jobDescription": job.GetJobDescription(),
		"createdAt": job.GetCreatedAt(), "updatedAt": job.GetUpdatedAt(),
	}
}

func occupationData(occupation *occupationpb.JobOccupationData) gin.H {
	return gin.H{
		"id": occupation.GetId(), "code": occupation.GetCode(), "name": occupation.GetName(),
		"occupationCategoryId": occupation.GetOccupationCategoryId(),
		"description":          occupation.GetDescription(),
	}
}

func jobSkillData(skill *occupationpb.JobSkillData) gin.H {
	return gin.H{
		"id": skill.GetId(), "skillName": skill.GetSkillName(),
		"skillProficiency": skill.GetSkillProficiency(), "evidence": skill.GetEvidence(),
	}
}
