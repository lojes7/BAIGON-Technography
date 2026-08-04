// 百工谱 — crawler-service 相关 REST handler
// 网关 REST → gRPC 调用 crawler-service（采集任务启动/状态/停止）

package handler

import (
	"context"
	"net/http"
	"time"

	"baigon-technography/gateway/internal/grpcpool"
	"baigon-technography/gateway/internal/response"
	crawlerpb "baigon-technography/gateway/pb/crawlerpb"

	"github.com/gin-gonic/gin"
)

// crawlRequest 启动采集请求体
type crawlRequest struct {
	Type string `json:"type" example:"JOB"` // 采集数据类型，目前仅支持 JOB
}

// StartCrawlHandler 启动一次采集任务
// @Summary      启动采集
// @Description  触发 crawler-service 执行一次采集：爬取(stub) → 写 job_sources → 清洗(stub) → Kafka 发送
// @Tags         爬虫
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body crawlRequest true "采集请求"
// @Success      200  {object}  response.SuccessBody  "采集完成，data 内含 count 与 trace_id"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误或 type 不支持"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN 或无权限；已有采集任务在运行"
// @Failure      503  {object}  response.ErrorBody    "crawler 服务不可用"
// @Router       /api/auth/crawl [post]
func StartCrawlHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req crawlRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		// 缺省 type 视为 JOB
		if req.Type != "JOB" {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("crawler-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		// 采集链路比登录慢：60s 超时（不要照抄 LoginHandler 的 5s）
		ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
		defer cancel()

		// 透传用户上下文（Auth 中间件已注入 userId/uid）
		resp, err := crawlerpb.NewCrawlerServiceClient(conn).Crawl(ctx, &crawlerpb.CrawlRequest{
			Type:          req.Type,
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

		// 统一响应格式: {"code": 200, "data": {...}}
		response.Success(c, gin.H{
			"count":    resp.GetCount(), // string，proto 定义如此，原样透出
			"trace_id": resp.GetTraceId(),
		})
	}
}

// GetCrawlStatusHandler 查询采集状态
// @Summary      查询采集状态
// @Description  返回 crawler-service 最近一次采集任务状态（idle/running/success/failed/stopped）
// @Tags         爬虫
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  response.SuccessBody  "采集状态，data 内含 status/count/message"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN"
// @Failure      503  {object}  response.ErrorBody    "crawler 服务不可用"
// @Router       /api/auth/crawl [get]
func GetCrawlStatusHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("crawler-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 透传用户上下文，供后端写 logs 表
		resp, err := crawlerpb.NewCrawlerServiceClient(conn).GetCrawlStatus(ctx, &crawlerpb.GetCrawlStatusRequest{
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

		response.Success(c, gin.H{
			"status":  resp.GetStatus(),
			"count":   resp.GetCount(),
			"message": resp.GetMessage(),
		})
	}
}

// StopCrawlHandler 停止采集
// @Summary      停止采集
// @Description  请求 crawler-service 停止当前采集任务
// @Tags         爬虫
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  response.SuccessBody  "已停止，data 内含 status"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN"
// @Failure      503  {object}  response.ErrorBody    "crawler 服务不可用"
// @Router       /api/auth/crawl [delete]
func StopCrawlHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := pool.GetConn("crawler-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// 透传用户上下文，供后端写 logs 表
		resp, err := crawlerpb.NewCrawlerServiceClient(conn).StopCrawl(ctx, &crawlerpb.StopCrawlRequest{
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

		response.Success(c, gin.H{
			"status": resp.GetStatus(),
		})
	}
}
