// 百工谱 — 当前用户简历 REST handler
package user

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"baigon-technography/gateway/internal/grpcpool"
	commonhandler "baigon-technography/gateway/internal/handler"
	"baigon-technography/gateway/internal/response"
	"baigon-technography/gateway/pb/userpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

const (
	maxResumeFileSize         = 10 << 20
	skillTimelineMaxRecvBytes = 50 * 1024 * 1024
)

type createResumeUploadRequest struct {
	FileName string `json:"fileName" binding:"required"`
	FileSize int64  `json:"fileSize" binding:"required"`
}

type completeResumeUploadRequest struct {
	UploadID int64  `json:"uploadId" binding:"required"`
	FileName string `json:"fileName" binding:"required"`
}

type editMyResumeRequest struct {
	Content *string         `json:"content"`
	Fields  json.RawMessage `json:"fields" binding:"required"`
}

// editMyResumeRequestDoc 只用于 Swagger 展示；运行时保留 RawMessage 交给后端严格检查重复键。
type editMyResumeRequestDoc struct {
	Content *string                `json:"content"`
	Fields  map[string]interface{} `json:"fields"`
}

// CreateResumeUploadHandler 签发由浏览器直接 PUT 到 MinIO 的临时上传地址。
// @Summary      创建简历直传地址
// @Description  仅接受 PDF 或 DOCX 元数据；返回预签名 URL，文件内容不经过 gateway。
// @Tags         用户简历
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        body body createResumeUploadRequest true "文件名及文件大小（最大 10 MiB）"
// @Success      200 {object} response.SuccessBody "data 内含 uploadId/uploadUrl/method/contentType/expiresAt"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      413 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/resumes/upload-url [post]
func CreateResumeUploadHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}

		var body createResumeUploadRequest
		if err := c.ShouldBindJSON(&body); err != nil || body.FileSize <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		if body.FileSize > maxResumeFileSize {
			response.Error(c, http.StatusRequestEntityTooLarge, http.StatusRequestEntityTooLarge)
			return
		}
		fileName, ok := normalizedResumeFileName(body.FileName)
		if !ok {
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
		result, err := userpb.NewUserServiceClient(conn).CreateResumeUpload(
			ctx,
			&userpb.CreateResumeUploadRequest{
				FileName: fileName, FileSize: body.FileSize,
				TraceId: c.GetString("trace_id"), UserId: userID,
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
			"uploadId": result.GetUploadId(), "uploadUrl": result.GetUploadUrl(),
			"method": result.GetMethod(), "contentType": result.GetContentType(),
			"expiresAt": result.GetExpiresAt(),
		})
	}
}

// CompleteResumeUploadHandler 在前端完成 MinIO 直传后，同步执行 OCR 与结构化分析。
// @Summary      完成简历上传和结构化分析
// @Description  前端使用预签名 URL 直传 MinIO 后调用；服务同步提取正文、校验并保存五类简历字段。
// @Tags         用户简历
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        body body completeResumeUploadRequest true "上传 ID 及原文件名"
// @Success      200 {object} response.SuccessBody "data 为文件信息、OCR content 及五类结构化字段"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/resumes/upload-complete [post]
func CompleteResumeUploadHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}

		var body completeResumeUploadRequest
		if err := c.ShouldBindJSON(&body); err != nil || body.UploadID <= 0 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		fileName, ok := normalizedResumeFileName(body.FileName)
		if !ok {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Minute)
		defer cancel()
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).CompleteResumeUpload(
			ctx,
			&userpb.CompleteResumeUploadRequest{
				UploadId: body.UploadID, FileName: fileName,
				TraceId: c.GetString("trace_id"), UserId: userID,
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
		if result.GetResume() == nil {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		data, ok := resumeResponseData(result.GetResume())
		if !ok {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, data)
	}
}

// GetMyResumeHandler 查询当前用户最近一份已完成分析的简历。
// @Summary      查询我的简历
// @Description  当前用户仅保留一份最新简历，返回单个对象；无简历时 data 为空对象。
// @Tags         用户简历
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody "data 为简历对象，无简历时为空对象"
// @Failure      401 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/resumes [get]
func GetMyResumeHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
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
		result, err := userpb.NewUserServiceClient(conn).GetMyResume(
			ctx,
			&userpb.GetMyResumeRequest{
				TraceId: c.GetString("trace_id"), UserId: userID,
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

		resume := result.GetResume()
		if resume == nil {
			response.Success(c, gin.H{})
			return
		}
		data, ok := resumeResponseData(resume)
		if !ok {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, data)
	}
}

// EditMyResumeHandler 保存当前用户人工编辑的完整简历字段。
// @Summary      编辑我的简历
// @Description  接收 content 与 format.json 对应的 fields；保存一条不绑定文件的 EDITED 记录。
// @Tags         用户简历
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        body body editMyResumeRequestDoc true "人工编辑的简历正文与结构化字段"
// @Success      200 {object} response.SuccessBody "data 为保存后的完整简历对象"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/resumes [put]
func EditMyResumeHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}

		var body editMyResumeRequest
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Fields) == 0 {
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
		request := &userpb.EditMyResumeRequest{
			FieldsJson: string(body.Fields),
			TraceId:    c.GetString("trace_id"), UserId: userID,
			UserName: c.GetString("uid"), UserIp: c.ClientIP(),
			RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
		}
		if body.Content != nil {
			request.Content = body.Content
		}
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).EditMyResume(
			ctx, request, grpc.Trailer(&trailer))
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		if result.GetResume() == nil {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		data, ok := resumeResponseData(result.GetResume())
		if !ok {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}
		response.Success(c, data)
	}
}

func normalizedResumeFileName(value string) (string, bool) {
	fileName := filepath.Base(strings.ReplaceAll(strings.TrimSpace(value), "\\", "/"))
	extension := strings.ToLower(filepath.Ext(fileName))
	return fileName, fileName != "." && utf8.RuneCountInString(fileName) <= 255 &&
		(extension == ".pdf" || extension == ".docx")
}

func resumeResponseData(resume *userpb.ResumeData) (gin.H, bool) {
	var fields map[string]any
	if err := json.Unmarshal([]byte(resume.GetFieldsJson()), &fields); err != nil || fields == nil {
		return nil, false
	}

	data := gin.H{
		"id": resume.GetId(), "fileName": nil, "fileSize": nil,
		"content": nil, "createdAt": resume.GetCreatedAt(),
		"fields": fields, "source": resume.GetSource(),
	}
	if resume.FileName != nil {
		data["fileName"] = resume.GetFileName()
	}
	if resume.FileSize != nil {
		data["fileSize"] = resume.GetFileSize()
	}
	if resume.Content != nil {
		data["content"] = resume.GetContent()
	}
	return data, true
}

// AnalyzeMyResumeSkillsHandler 使用当前用户最新简历识别技能并保存本次技能快照。
// @Summary      分析我的简历技能
// @Description  服务端自动选取当前用户最新简历；请求不接收简历 ID、正文或用户 ID。
// @Tags         用户技能
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody "data 内含 resumeId 与本次识别的 skills"
// @Failure      400 {object} response.ErrorBody
// @Failure      401 {object} response.ErrorBody
// @Failure      403 {object} response.ErrorBody
// @Failure      404 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/resumes/analyze-skills [post]
func AnalyzeMyResumeSkillsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
			return
		}

		conn, err := pool.GetConn("occupation-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}
		// 技能识别包含 AI 调用，超时与简历结构化分析保持一致。
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Minute)
		defer cancel()
		var trailer metadata.MD
		result, err := userpb.NewUserServiceClient(conn).AnalyzeMyResumeSkills(
			ctx,
			&userpb.AnalyzeMyResumeSkillsRequest{
				TraceId: c.GetString("trace_id"), UserId: userID,
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
		if result == nil || result.GetResumeId() <= 0 {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}

		response.Success(c, gin.H{
			"resumeId": result.GetResumeId(),
			"skills":   userSkillItems(result.GetSkills()),
		})
	}
}

// ListMySkillsHandler 返回当前用户按识别时间保留的全部技能记录。
// @Summary      查询我的技能时间线
// @Description  返回历次简历技能分析产生的记录；无记录时 items 固定为空数组。
// @Tags         用户技能
// @Produce      json
// @Security     Bearer
// @Success      200 {object} response.SuccessBody "data 内含 items"
// @Failure      401 {object} response.ErrorBody
// @Failure      500 {object} response.ErrorBody
// @Failure      503 {object} response.ErrorBody
// @Router       /api/auth/me/skills [get]
func ListMySkillsHandler(pool grpcpool.ConnectionProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := commonhandler.UserIDFromContext(c)
		if userID <= 0 {
			response.Error(c, http.StatusUnauthorized, http.StatusUnauthorized)
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
		result, err := userpb.NewUserServiceClient(conn).ListMySkills(
			ctx,
			&userpb.ListMySkillsRequest{
				TraceId: c.GetString("trace_id"), UserId: userID,
				UserName: c.GetString("uid"), UserIp: c.ClientIP(),
				RequestMethod: c.Request.Method, RequestUrl: c.Request.URL.Path,
			},
			grpc.Trailer(&trailer),
			// proposal 要求返回全部历史；显式放宽默认 4 MiB 接收上限。
			grpc.MaxCallRecvMsgSize(skillTimelineMaxRecvBytes),
		)
		if err != nil {
			httpCode, errorCode := commonhandler.GRPCErrorCodes(err, trailer)
			response.Error(c, httpCode, errorCode)
			return
		}
		if result == nil {
			response.Error(c, http.StatusInternalServerError, http.StatusInternalServerError)
			return
		}

		response.Success(c, gin.H{"items": userSkillItems(result.GetItems())})
	}
}

// userSkillItems 显式构造非 nil 切片，确保空技能列表编码为 [] 而不是 null。
func userSkillItems(skills []*userpb.UserSkillData) []gin.H {
	items := make([]gin.H, 0, len(skills))
	for _, skill := range skills {
		if skill == nil {
			continue
		}
		items = append(items, gin.H{
			"id": skill.GetId(), "resumeId": skill.GetResumeId(),
			"skillName": skill.GetSkillName(), "proficiency": skill.GetProficiency(),
			"evidence": skill.GetEvidence(), "createdAt": skill.GetCreatedAt(),
		})
	}
	return items
}
