// 百工谱 — 规范技能详情、名称解析及父子关系维护
package skill

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

type lookupSkillsRequest struct {
	SkillIDs []int64 `json:"skillIds"`
}

type mutateSkillRelationRequest struct {
	RelatedSkillID int64 `json:"relatedSkillId"`
}

// LookupSkillsHandler 按一组规范技能 ID 批量解析本体详情，供所有已登录用户使用。
// @Summary      批量解析规范技能详情
// @Tags         技能关系
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body lookupSkillsRequest true "1 到 200 个规范技能 ID"
// @Success      200 {object} response.SuccessBody{data=skill.SkillLookupData} "data 含 items(id/name/isEmbed) 与 missingIds"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/lookup [post]
func LookupSkillsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request lookupSkillsRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		skillIDs, ok := normalizeLookupSkillIDs(request.SkillIDs)
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
		result, err := occupationpb.NewOccupationServiceClient(conn).LookupSkills(
			ctx,
			&occupationpb.LookupSkillsRequest{
				SkillIds: skillIDs,
				TraceId:  c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
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
			"items":      skillLookupItems(result.GetItems()),
			"missingIds": nonNilIDs(result.GetMissingSkillIds()),
		})
	}
}

// GetSkillHandler 查询单个规范技能本体，不附带父子关系。
// @Summary      查询规范技能详情
// @Tags         技能关系
// @Produce      json
// @Security     Bearer
// @Param        id path int true "skills.id"
// @Success      200 {object} response.SuccessBody{data=skill.SkillData} "data 仅含 id/name/isEmbed"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/{id} [get]
func GetSkillHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := positiveID(c.Param("id"))
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetSkill(
			ctx,
			&occupationpb.GetSkillRequest{
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
		response.Success(c, skillDetailData(result.GetSkill()))
	}
}

// GetSkillRelationsHandler 显式查询指定方向的一跳规范技能关系。
// @Summary      查询规范技能一跳关系
// @Tags         技能关系
// @Produce      json
// @Security     Bearer
// @Param        id path int true "skills.id"
// @Param        direction query string true "parents 或 children"
// @Success      200 {object} response.SuccessBody{data=response.SkillIDsData} "data.skillIds 仅含一跳关系 ID"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/{id}/relations [get]
func GetSkillRelationsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := positiveID(c.Param("id"))
		direction := c.Query("direction")
		if !ok || (direction != "parents" && direction != "children") {
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
		result, err := occupationpb.NewOccupationServiceClient(conn).GetSkillRelations(
			ctx,
			&occupationpb.GetSkillRelationsRequest{
				Id: id, Direction: direction, TraceId: c.GetString("trace_id"),
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
		response.Success(c, gin.H{"skillIds": nonNilIDs(result.GetSkillIds())})
	}
}

// AddSkillRelationHandler 为指定技能新增一个直接父技能或子技能。
// @Summary      新增规范技能父子关系
// @Tags         技能关系
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id path int true "当前 skills.id"
// @Param        direction path string true "parents 或 children"
// @Param        request body mutateSkillRelationRequest true "关联技能 ID"
// @Success      200 {object} response.SuccessBody{data=response.RelationIDsData} "data 含实际写入的 parentSkillId/childSkillId"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      409 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/{id}/relations/{direction} [post]
func AddSkillRelationHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return mutateSkillRelationHandler(pool, false)
}

// DeleteSkillRelationHandler 删除指定技能的一条直接父子关系。
// @Summary      删除规范技能父子关系
// @Tags         技能关系
// @Produce      json
// @Security     Bearer
// @Param        id path int true "当前 skills.id"
// @Param        direction path string true "parents 或 children"
// @Param        relatedId path int true "关联 skills.id"
// @Success      200 {object} response.SuccessBody{data=response.RelationIDsData} "data 含实际删除的 parentSkillId/childSkillId"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/occupation/skills/{id}/relations/{direction}/{relatedId} [delete]
func DeleteSkillRelationHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return mutateSkillRelationHandler(pool, true)
}

func mutateSkillRelationHandler(pool grpcpool.ConnectionProvider, deleting bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		skillID, ok := positiveID(c.Param("id"))
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		var relatedSkillID int64
		if deleting {
			var valid bool
			relatedSkillID, valid = positiveID(c.Param("relatedId"))
			if !valid {
				response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
				return
			}
		} else {
			var request mutateSkillRelationRequest
			if err := c.ShouldBindJSON(&request); err != nil {
				response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
				return
			}
			relatedSkillID = request.RelatedSkillID
		}

		parentSkillID, childSkillID, ok := relationEndpoints(
			skillID, relatedSkillID, c.Param("direction"),
		)
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
		request := &occupationpb.SkillRelationMutationRequest{
			ParentSkillId: parentSkillID, ChildSkillId: childSkillID,
			TraceId: c.GetString("trace_id"), UserId: commonhandler.UserIDFromContext(c),
			UserName: c.GetString("uid"), UserIp: c.ClientIP(),
			RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
		}
		client := occupationpb.NewOccupationServiceClient(conn)
		var result *occupationpb.SkillRelationMutationResponse
		if deleting {
			result, err = client.DeleteSkillRelation(ctx, request, grpc.Trailer(&trailer))
		} else {
			result, err = client.AddSkillRelation(ctx, request, grpc.Trailer(&trailer))
		}
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		response.Success(c, gin.H{
			"parentSkillId": result.GetParentSkillId(),
			"childSkillId":  result.GetChildSkillId(),
		})
	}
}

func positiveID(value string) (int64, bool) {
	id, err := strconv.ParseInt(value, 10, 64)
	return id, err == nil && id > 0
}

func skillLookupItems(items []*occupationpb.SkillLookupData) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		result = append(result, gin.H{
			"id": item.GetId(), "name": item.GetName(), "isEmbed": item.GetIsEmbed(),
		})
	}
	return result
}

func skillDetailData(detail *occupationpb.SkillDetailData) gin.H {
	if detail == nil {
		return nil
	}
	return commonhandler.CanonicalSkillData(detail.GetSkill())
}

// nonNilIDs 保证 repeated 字段为空时仍编码为 JSON []，而不是 null。
func nonNilIDs(ids []int64) []int64 {
	result := make([]int64, len(ids))
	copy(result, ids)
	return result
}

// validPositiveIDs 校验一组 ID 均为正数；requireItem 表示至少需要一个 ID。
func validPositiveIDs(ids []int64, requireItem bool) bool {
	if requireItem && len(ids) == 0 {
		return false
	}
	for _, id := range ids {
		if id <= 0 {
			return false
		}
	}
	return true
}

// normalizeLookupSkillIDs 先校验原始数量，再按首次出现顺序去重。
func normalizeLookupSkillIDs(values []int64) ([]int64, bool) {
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

// relationEndpoints 将相对当前技能的方向转换为数据库关系的父、子技能 ID。
func relationEndpoints(skillID, relatedSkillID int64, direction string) (int64, int64, bool) {
	if skillID <= 0 || relatedSkillID <= 0 || skillID == relatedSkillID {
		return 0, 0, false
	}
	switch direction {
	case "parents":
		return relatedSkillID, skillID, true
	case "children":
		return skillID, relatedSkillID, true
	default:
		return 0, 0, false
	}
}
