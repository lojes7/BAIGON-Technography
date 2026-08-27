// 百工谱 — 职业/专业技能时间图谱 REST handler
package skillgraph

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// OccupationSkillGraphHandler 查询指定职业的技能时间图谱。
// @Summary      查询职业技能时间图谱
// @Tags         岗位能力图谱
// @Produce      json
// @Security     Bearer
// @Param        id path int true "occupations.id"
// @Param        fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param        toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Param        evidenceLimit query int false "每个技能的代表岗位数，默认 10、最大 50"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/occupations/{id}/skill-graph [get]
func OccupationSkillGraphHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return skillGraphHandler(pool, "OCCUPATION")
}

// MajorSkillGraphHandler 查询指定专业的技能时间图谱。
// @Summary      查询专业技能时间图谱
// @Tags         岗位能力图谱
// @Produce      json
// @Security     Bearer
// @Param        id path int true "majors.id"
// @Param        fromMonth query string false "包含的起始自然月，YYYY-MM"
// @Param        toMonth query string false "不包含的结束自然月，YYYY-MM"
// @Param        evidenceLimit query int false "每个技能的代表岗位数，默认 10、最大 50"
// @Success      200 {object} response.SuccessBody
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Router       /api/auth/occupation/majors/{id}/skill-graph [get]
func MajorSkillGraphHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return skillGraphHandler(pool, "MAJOR")
}

func skillGraphHandler(pool *grpcpool.GrpcClientPool, scopeType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeID, err := commonhandler.PositivePathID(c, "id")
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		query, err := commonhandler.ParseSkillGraphQuery(c)
		if err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()
		var trailer metadata.MD
		result, err := occupationpb.NewOccupationServiceClient(conn).GetSkillGraph(
			ctx,
			&occupationpb.GetSkillGraphRequest{
				ScopeType: scopeType, ScopeId: scopeID,
				FromMonth: query.FromMonth, ToMonth: query.ToMonth,
				EvidenceLimit: query.EvidenceLimit,
				TraceId:       c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
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
		response.Success(c, skillGraphData(result))
	}
}

func skillGraphData(result *occupationpb.GetSkillGraphResponse) gin.H {
	parents := func(items []*occupationpb.SkillGraphParent) []gin.H {
		mapped := make([]gin.H, 0, len(items))
		for _, item := range items {
			mapped = append(mapped, gin.H{"id": item.GetId(), "name": item.GetName()})
		}
		return mapped
	}
	evidenceJobs := func(items []*occupationpb.SkillGraphEvidenceJob) []gin.H {
		mapped := make([]gin.H, 0, len(items))
		for _, item := range items {
			mapped = append(mapped, gin.H{
				"jobId": item.GetJobId(), "jobName": item.GetJobName(),
				"companyName": item.GetCompanyName(), "sourcePlatform": item.GetSourcePlatform(),
				"sourceUrl": item.GetSourceUrl(), "publishDate": item.GetPublishDate(),
			})
		}
		return mapped
	}
	skills := make([]gin.H, 0, len(result.GetSkills()))
	for _, skill := range result.GetSkills() {
		skills = append(skills, gin.H{
			"skillId": skill.GetSkillId(), "skillName": skill.GetSkillName(),
			"jobCount": skill.GetJobCount(), "coverage": skill.GetCoverage(),
			"parents":      parents(skill.GetParents()),
			"evidenceJobs": evidenceJobs(skill.GetEvidenceJobs()),
		})
	}
	return gin.H{
		"scope": gin.H{
			"type": result.GetScope().GetType(), "id": result.GetScope().GetId(),
			"code": result.GetScope().GetCode(), "name": result.GetScope().GetName(),
		},
		"timeline": gin.H{
			"fromMonth": result.GetTimeline().GetFromMonth(),
			"toMonth":   result.GetTimeline().GetToMonth(),
			"timezone":  result.GetTimeline().GetTimezone(),
		},
		"totalJobCount": result.GetTotalJobCount(),
		"skills":        skills,
	}
}
