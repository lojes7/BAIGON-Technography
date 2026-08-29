// 百工谱 — crawler-service 相关 REST handler
// 网关 REST → gRPC 调用 crawler-service（采集任务启动/状态/停止）

package handler

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

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
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "采集任务已启动，data 内仅含任务 id"
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
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
			Categories:    req.Categories,
			MaxDocuments:  int32(req.MaxDocuments),
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		// 启动命令只返回资源身份，进度与状态统一由 GET /crawl 查询。
		response.Success(c, gin.H{"id": resp.GetId()})
	}
}

// GetCrawlStatusHandler 查询采集状态
// @Summary      查询采集状态
// @Description  返回 crawler-service 最近一次采集任务状态（idle/running/success/failed/stopped）
// @Tags         数据获取
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  response.SuccessBody{data=crawler.StatusData}  "采集状态详情，data 内含任务 id 与运行状态"
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
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{
			"id":              resp.GetId(),
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
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "停止命令已接收，data 内仅含任务 id"
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
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		response.Success(c, gin.H{"id": resp.GetId()})
	}
}

// ingestedJob 单条注入数据（字段与爬虫产出的 JobRecord 完全一致）
type ingestedJob struct {
	PublishDate    string `json:"publishDate" example:"2025-01-01 00:00:00"` // 发布日期，可空；支持日期或秒级时间
	SourcePlatform string `json:"sourcePlatform" example:"CSV注入"`            // 来源平台，可空；后端为空时补“手动注入”
	SourceURL      string `json:"sourceUrl"`                                 // 来源 URL，可空；非空时必须为 HTTP(S)
	City           string `json:"city"`                                      // 城市，可空
	Tags           string `json:"tags"`                                      // 技能标签，可空
	Major          string `json:"major"`                                     // 专业方向，可空
	Nature         string `json:"nature"`                                    // 工作性质，可空
	Salary         string `json:"salary"`                                    // 薪资，可空
	JobName        string `json:"jobName"`                                   // 岗位名称，非空
	CompanyName    string `json:"companyName"`                               // 公司名称，可空
	CompanySize    string `json:"companySize"`                               // 公司规模，可空
	Province       string `json:"province"`                                  // 省份，可空
	Education      string `json:"education"`                                 // 学历要求，可空
	Experience     string `json:"experience"`                                // 经验要求，可空
	JobDescription string `json:"jobDescription"`                            // 岗位描述，可空
}

var ingestPublishDateLayouts = []string{
	"2006-01-02",
	"2006-01-02 15:04:05",
	"2006-01-02T15:04:05",
}

// normalizeIngestedJob 在网关信任边界统一清理空白并校验公开导入契约。
func normalizeIngestedJob(job ingestedJob) (ingestedJob, bool) {
	job.PublishDate = strings.TrimSpace(job.PublishDate)
	job.SourcePlatform = strings.TrimSpace(job.SourcePlatform)
	job.SourceURL = strings.TrimSpace(job.SourceURL)
	job.City = strings.TrimSpace(job.City)
	job.Tags = strings.TrimSpace(job.Tags)
	job.Major = strings.TrimSpace(job.Major)
	job.Nature = strings.TrimSpace(job.Nature)
	job.Salary = strings.TrimSpace(job.Salary)
	job.JobName = strings.TrimSpace(job.JobName)
	job.CompanyName = strings.TrimSpace(job.CompanyName)
	job.CompanySize = strings.TrimSpace(job.CompanySize)
	job.Province = strings.TrimSpace(job.Province)
	job.Education = strings.TrimSpace(job.Education)
	job.Experience = strings.TrimSpace(job.Experience)
	job.JobDescription = strings.TrimSpace(job.JobDescription)

	// varchar 字段在进入异步链路前校验，避免后台落库时才暴露坏数据。
	lengthLimits := []struct {
		value string
		max   int
	}{
		{job.SourcePlatform, 32},
		{job.SourceURL, 512},
		{job.City, 64},
		{job.Major, 64},
		{job.Nature, 64},
		{job.Salary, 64},
		{job.JobName, 64},
		{job.CompanyName, 64},
		{job.CompanySize, 64},
		{job.Province, 64},
		{job.Education, 64},
	}
	if job.JobName == "" {
		return job, false
	}
	for _, limit := range lengthLimits {
		if utf8.RuneCountInString(limit.value) > limit.max {
			return job, false
		}
	}

	if job.SourceURL != "" {
		parsedURL, err := url.ParseRequestURI(job.SourceURL)
		if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
			return job, false
		}
	}
	if job.PublishDate != "" {
		validDate := false
		for _, layout := range ingestPublishDateLayouts {
			if _, err := time.Parse(layout, job.PublishDate); err == nil {
				validDate = true
				break
			}
		}
		if !validDate {
			return job, false
		}
	}

	return job, true
}

// ingestDataRequest 模拟采集请求体
type ingestDataRequest struct {
	Jobs []ingestedJob `json:"jobs"` // 注入的岗位数据
}

// IngestDataHandler 模拟采集：后台注入配置数据并走完整链路
// @Summary      模拟采集（注入数据）
// @Description  由 ADMIN 提交配置好的岗位数据，后台分批执行落库/清洗/Kafka 流程（不真爬），进度通过 GET /crawl 查询
// @Tags         数据获取
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request body ingestDataRequest true "注入的岗位数据"
// @Success      200  {object}  response.SuccessBody{data=response.IDData}  "注入任务已启动，data 内仅含任务 id"
// @Failure      400  {object}  response.ErrorBody    "请求体格式错误、jobs 为空/超过 1000 条或岗位字段不符合约束"
// @Failure      401  {object}  response.ErrorBody    "未认证"
// @Failure      403  {object}  response.ErrorBody    "非 ADMIN；已有采集或注入任务运行"
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
		for index, job := range req.Jobs {
			normalized, valid := normalizeIngestedJob(job)
			if !valid {
				response.Error(c, http.StatusBadRequest, http.StatusBadRequest)
				return
			}
			req.Jobs[index] = normalized
		}

		conn, err := pool.GetConn("crawler-service")
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, http.StatusServiceUnavailable)
			return
		}

		// crawler 只负责接收任务并立即返回，10 秒足以覆盖发现与启动开销。
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
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
			UserId:        UserIDFromContext(c),
			UserName:      c.GetString("uid"),
			UserIp:        c.ClientIP(),
			RequestMethod: c.Request.Method,
			RequestUrl:    c.Request.URL.Path,
		})
		if err != nil {
			httpCode, errorCode := GRPCErrorCodes(err)
			response.Error(c, httpCode, errorCode)
			return
		}

		// 统一响应格式；后台任务通过 GET /crawl 查询进度。
		// 注入同样是异步命令；条数与状态由统一状态接口读取。
		response.Success(c, gin.H{"id": resp.GetId()})
	}
}
