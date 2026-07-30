// 百工谱 — gRPC 反向代理
// 负责将 HTTP 请求转发至内部 gRPC 服务

package proxy

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	consulapi "github.com/hashicorp/consul/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// GrpcClientPool gRPC 客户端连接池
type GrpcClientPool struct {
	mu       sync.RWMutex
	conns    map[string]*grpc.ClientConn
	consul   *consulapi.Client
}

// NewGrpcClientPool 创建 gRPC 连接池
func NewGrpcClientPool(consulClient *consulapi.Client) *GrpcClientPool {
	return &GrpcClientPool{
		conns:  make(map[string]*grpc.ClientConn),
		consul: consulClient,
	}
}

// GetConn 获取或创建到目标服务的 gRPC 连接
func (p *GrpcClientPool) GetConn(serviceName string) (*grpc.ClientConn, error) {
	p.mu.RLock()
	conn, ok := p.conns[serviceName]
	p.mu.RUnlock()
	if ok {
		return conn, nil
	}

	// 从 Consul 获取服务地址
	addr, err := p.discoverService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("服务发现失败 %s: %w", serviceName, err)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	// 双重检查
	if conn, ok = p.conns[serviceName]; ok {
		return conn, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err = grpc.DialContext(ctx, addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
	)
	if err != nil {
		return nil, fmt.Errorf("gRPC 连接失败 %s: %w", serviceName, err)
	}

	p.conns[serviceName] = conn
	log.Printf("gRPC 连接池: 已连接 %s (%s)", serviceName, addr)
	return conn, nil
}

// discoverService 从 Consul 发现服务实例
func (p *GrpcClientPool) discoverService(serviceName string) (string, error) {
	services, _, err := p.consul.Health().Service(serviceName, "", true, nil)
	if err != nil {
		return "", err
	}
	if len(services) == 0 {
		return "", fmt.Errorf("无健康实例: %s", serviceName)
	}
	// 取第一个健康实例
	s := services[0].Service
	return fmt.Sprintf("%s:%d", s.Address, s.Port), nil
}

// Close 关闭所有 gRPC 连接
func (p *GrpcClientPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for name, conn := range p.conns {
		conn.Close()
		log.Printf("gRPC 连接池: 已关闭 %s", name)
	}
}

// RegisterRoutes 注册所有 API 路由
func RegisterRoutes(api *gin.RouterGroup, pool *GrpcClientPool, consulClient *consulapi.Client) {
	// ==================== 认证 ====================
	auth := api.Group("/auth")
	{
		auth.POST("/login", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "登录接口 — 待实现"})
		})
		auth.POST("/refresh", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "刷新Token — 待实现"})
		})
		auth.POST("/logout", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "登出 — 待实现"})
		})
	}

	// ==================== 用户模块 → user_service ====================
	users := api.Group("/users")
	{
		users.GET("/me", proxyToGrpc(pool, "user_service"))
		users.PUT("/me", proxyToGrpc(pool, "user_service"))
	}

	resumes := api.Group("/resumes")
	{
		resumes.POST("/upload", proxyToGrpc(pool, "user_service"))
		resumes.GET("/:id", proxyToGrpc(pool, "user_service"))
	}

	match := api.Group("/match")
	{
		match.POST("/analyze", proxyToGrpc(pool, "user_service"))
		match.GET("/results/:id", proxyToGrpc(pool, "user_service"))
	}

	api.GET("/learning-paths/:id", proxyToGrpc(pool, "user_service"))

	// ==================== 岗位图谱 → occupation_service ====================
	occupations := api.Group("/occupations")
	{
		occupations.GET("", proxyToGrpc(pool, "occupation_service"))
		occupations.GET("/:id", proxyToGrpc(pool, "occupation_service"))
		occupations.GET("/:id/evolution", proxyToGrpc(pool, "occupation_service"))
		occupations.GET("/emerging", proxyToGrpc(pool, "occupation_service"))
	}

	skills := api.Group("/skills")
	{
		skills.GET("", proxyToGrpc(pool, "occupation_service"))
		skills.GET("/:id/trend", proxyToGrpc(pool, "occupation_service"))
	}

	api.GET("/knowledge-graph", proxyToGrpc(pool, "occupation_service"))

	// ==================== 数据管理 → data_source_service ====================
	dataSources := api.Group("/data-sources")
	{
		dataSources.GET("", proxyToGrpc(pool, "data_source_service"))
		dataSources.POST("/import", proxyToGrpc(pool, "data_source_service"))
	}

	review := api.Group("/review-queue")
	{
		review.GET("", proxyToGrpc(pool, "data_source_service"))
		review.POST("/:id/approve", proxyToGrpc(pool, "data_source_service"))
		review.POST("/:id/reject", proxyToGrpc(pool, "data_source_service"))
	}

	// ==================== 院校 → university_service ====================
	universities := api.Group("/universities")
	{
		universities.GET("/:id/curriculum", proxyToGrpc(pool, "university_service"))
		universities.POST("/:id/coverage-analysis", proxyToGrpc(pool, "university_service"))
	}

	// ==================== 文件 → file_service ====================
	files := api.Group("/files")
	{
		files.POST("/upload", proxyToGrpc(pool, "file_service"))
		files.GET("/:id", proxyToGrpc(pool, "file_service"))
		files.GET("/:id/download", proxyToGrpc(pool, "file_service"))
	}
}

// proxyToGrpc 返回一个 gin.HandlerFunc，将请求转发到目标 gRPC 服务（桩实现）
func proxyToGrpc(pool *GrpcClientPool, serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从路径中提取 action
		path := c.Request.URL.Path
		// 移除 /api/v1/ 前缀
		action := strings.TrimPrefix(path, "/api/v1/")
		action = strings.ReplaceAll(action, "/", ".")
		action = strings.ReplaceAll(action, ":", "")

		// 尝试连接目标服务
		_, err := pool.GetConn(serviceName)
		if err != nil {
			c.JSON(502, gin.H{
				"error":   fmt.Sprintf("服务 %s 不可达", serviceName),
				"code":    502,
				"action":  action,
				"detail":  err.Error(),
			})
			return
		}

		// TODO: 实际的 gRPC 调用
		// 桩：返回占位响应
		c.JSON(200, gin.H{
			"message":      "请求已接收（桩响应）",
			"service":      serviceName,
			"action":       action,
			"trace_id":     c.GetString("trace_id"),
			"status":       "not_implemented",
		})
	}
}
