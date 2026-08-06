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

// crawlRequest 启动采集请求体（ADMIN 前端直接配置爬取参数）
type crawlRequest struct {
	Type         string   `json:"type" example:"JOB"`          // 采集数据类型，目前仅支持 JOB
	Categories   []string `json:"categories"`                  // 要爬的岗位分类，空=全部
	MaxDocuments int      `json:"maxDocuments" example:"1000"` // 单分类最大条数，默认 1000
}

// StartCrawlHandler 启动一次采集任务
// @Summary      启动采集
// @Description  触发 crawler-service 执行一次采集：爬取(stub) → 写 job_sources → 清洗(stub) → Kafka 发送
// @Tags         数据获取
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
		// 约束：单分类最大条数上限 1000
		if req.MaxDocuments > 1000 {
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

		// 透传用户上下文 + 爬取参数（ADMIN 前端传参）
		resp, err := crawlerpb.NewCrawlerServiceClient(conn).Crawl(ctx, &crawlerpb.CrawlRequest{
			Type:          req.Type,
			TraceId:       c.GetString("trace_id"),
			UserId:        userIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
			Categories:    req.Categories,
			MaxDocuments:  int32(req.MaxDocuments),
		})
		if err != nil {
			code := grpcErrorToHTTP(err)
			response.Error(c, code, code)
			return
		}

		// 统一响应格式: {"code": 200, "data": {...}}
		// 异步任务：立即返回 running 状态，进度用 GET /crawl 查询
		response.Success(c, gin.H{
			"count":    resp.GetCount(), // string，proto 定义如此，原样透出
			"trace_id": resp.GetTraceId(),
			"status":   resp.GetStatus(),
		})
	}
}

// GetCrawlStatusHandler 查询采集状态
// @Summary      查询采集状态
// @Description  返回 crawler-service 最近一次采集任务状态（idle/running/success/failed/stopped）
// @Tags         数据获取
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
			"status":          resp.GetStatus(),
			"count":           resp.GetCount(),
			"message":         resp.GetMessage(),
			"currentCategory": resp.GetCurrentCategory(),
			"progress":        resp.GetProgress(),
			"totalCleaned":    resp.GetTotalCleaned(),
		})
	}
}

// StopCrawlHandler 停止采集
// @Summary      停止采集
// @Description  请求 crawler-service 停止当前采集任务
// @Tags         数据获取
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

// ingestedJob 单条注入数据（字段与爬虫产出的 JobRecord 完全一致）
type ingestedJob struct {
	PublishDate    string `json:"publishDate" example:"2025-01-01T00:00:00+08:00"` // 发布日期 ISO8601，可空
	SourcePlatform string `json:"sourcePlatform" example:"手动注入"`                   // 来源平台
	SourceURL      string `json:"sourceUrl"`                                       // 来源 URL
	City           string `json:"city"`                                            // 城市
	Tags           string `json:"tags"`                                            // 技能标签
	Major          string `json:"major"`                                           // 专业方向
	Nature         string `json:"nature"`                                          // 工作性质
	Salary         string `json:"salary"`                                          // 薪资
	JobName        string `json:"jobName"`                                         // 岗位名称
	CompanyName    string `json:"companyName"`                                     // 公司名称
	CompanySize    string `json:"companySize"`                                     // 公司规模
	Province       string `json:"province"`                                        // 省份
	Education      string `json:"education"`                                       // 学历要求
	Experience     string `json:"experience"`                                      // 经验要求
	JobDescription string `json:"jobDescription"`                                  // 岗位描述
}

// ingestDataRequest 模拟采集请求体
type ingestDataRequest struct {
	Jobs []ingestedJob `json:"jobs"` // 注入的岗位数据
}

// IngestDataHandler 模拟采集：注入配置数据走完整链路
// @Summary      模拟采集（注入数据）
// @Description  由 ADMIN 提交配置好的岗位数据，走与爬虫相同的落库/清洗/Kafka 流程（不真爬）
// @Tags         数据获取
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body ingestDataRequest true "注入的岗位数据"
// @Success      200  {object}  response.SuccessBody  "注入完成，data 内含 count/trace_id/status"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误、jobs 为空或超过 1000 条"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN"
// @Failure      503  {object}  response.ErrorBody    "crawler 服务不可用"
// @Router       /api/auth/crawl/ingest [post]
func IngestDataHandler(pool *grpcpool.GrpcClientPool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ingestDataRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}
		// 校验：jobs 非空、条数 ≤ 1000
		if len(req.Jobs) == 0 || len(req.Jobs) > 1000 {
			response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
			return
		}

		conn, err := pool.GetConn("crawler-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
		defer cancel()

		// 组装 gRPC 请求（透传审计字段）
		jobs := make([]*crawlerpb.IngestedJob, 0, len(req.Jobs))
		for _, j := range req.Jobs {
			jobs = append(jobs, &crawlerpb.IngestedJob{
				PublishDate:    j.PublishDate,
				SourcePlatform: j.SourcePlatform,
				SourceUrl:      j.SourceURL,
				City:           j.City,
				Tags:           j.Tags,
				Major:          j.Major,
				Nature:         j.Nature,
				Salary:         j.Salary,
				JobName:        j.JobName,
				CompanyName:    j.CompanyName,
				CompanySize:    j.CompanySize,
				Province:       j.Province,
				Education:      j.Education,
				Experience:     j.Experience,
				JobDescription: j.JobDescription,
			})
		}
		resp, err := crawlerpb.NewCrawlerServiceClient(conn).IngestData(ctx, &crawlerpb.IngestDataRequest{
			Jobs:          jobs,
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
			"count":    resp.GetCount(),
			"trace_id": resp.GetTraceId(),
			"status":   resp.GetStatus(),
		})
	}
}
