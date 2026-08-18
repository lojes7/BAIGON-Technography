// 百工谱 — 当前用户简历 REST handler
package user

import (
	"context"
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

const maxResumeFileSize = 10 << 20

type createResumeUploadRequest struct {
	FileName string `json:"fileName" binding:"required"`
	FileSize int64  `json:"fileSize" binding:"required"`
}

type completeResumeUploadRequest struct {
	UploadID int64  `json:"uploadId" binding:"required"`
	FileName string `json:"fileName" binding:"required"`
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

// CompleteResumeUploadHandler 在前端完成 MinIO 直传后，同步创建记录并执行 OCR。
// @Summary      完成简历上传并提取文字
// @Description  前端使用预签名 URL 直传 MinIO 后调用；服务校验实际对象并同步回写 OCR content。
// @Tags         用户简历
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        body body completeResumeUploadRequest true "上传 ID 及原文件名"
// @Success      200 {object} response.SuccessBody "data 为简历 ID、文件信息及 OCR content"
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
		response.Success(c, resumeResponseData(result.GetResume()))
	}
}

// GetMyResumeHandler 查询当前用户最近一份已完成 OCR 的简历。
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
		response.Success(c, resumeResponseData(resume))
	}
}

func normalizedResumeFileName(value string) (string, bool) {
	fileName := filepath.Base(strings.ReplaceAll(strings.TrimSpace(value), "\\", "/"))
	extension := strings.ToLower(filepath.Ext(fileName))
	return fileName, fileName != "." && utf8.RuneCountInString(fileName) <= 255 &&
		(extension == ".pdf" || extension == ".docx")
}

func resumeResponseData(resume *userpb.ResumeData) gin.H {
	return gin.H{
		"id": resume.GetId(), "fileName": resume.GetFileName(),
		"fileSize": resume.GetFileSize(), "content": resume.GetContent(),
		"createdAt": resume.GetCreatedAt(),
	}
}
