// 百工谱 — gateway-service 主入口
// Go + GIN 网关，负责请求路由、JWT 鉴权、限流熔断

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"baigon-technography/gateway/internal/config"
	"baigon-technography/gateway/internal/middleware"
	"baigon-technography/gateway/internal/proxy"

	"github.com/gin-gonic/gin"
	consulapi "github.com/hashicorp/consul/api"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化 Consul 客户端
	consulClient, err := consulapi.NewClient(&consulapi.Config{
		Address: cfg.ConsulAddr,
	})
	if err != nil {
		log.Fatalf("连接 Consul 失败: %v", err)
	}

	// 注册网关服务到 Consul
	serviceID := fmt.Sprintf("gateway-%s", cfg.Hostname)
	err = consulClient.Agent().ServiceRegister(&consulapi.AgentServiceRegistration{
		ID:      serviceID,
		Name:    "gateway-service",
		Address: cfg.Hostname,
		Port:    cfg.Port,
		Check: &consulapi.AgentServiceCheck{
			HTTP:     fmt.Sprintf("http://%s:%d/health", cfg.Hostname, cfg.Port),
			Interval: "10s",
			Timeout:  "5s",
		},
	})
	if err != nil {
		log.Fatalf("注册 Consul 服务失败: %v", err)
	}
	log.Printf("已在 Consul 注册: gateway-service (id=%s, port=%d)", serviceID, cfg.Port)

	// 初始化 gRPC 客户端连接池
	grpcPool := proxy.NewGrpcClientPool(consulClient)

	// 设置 GIN 路由
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// 中间件链: RequestID → Logger → CORS → Auth → RateLimit → CircuitBreaker
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS())

	// 健康检查端点 (不需要鉴权)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "gateway-service",
			"status":  "healthy",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// API 路由组
	api := router.Group("/api/v1")
	api.Use(middleware.Auth(cfg.JWTSecret))
	api.Use(middleware.RateLimit(100, time.Minute)) // 100 req/min

	// 注册所有路由
	proxy.RegisterRoutes(api, grpcPool, consulClient)

	// 启动 HTTP 服务
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("gateway-service 启动在端口 %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP 服务启动失败: %v", err)
		}
	}()

	// 关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭 gateway-service...")

	// 从 Consul 注销
	consulClient.Agent().ServiceDeregister(serviceID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	grpcPool.Close()
	log.Println("gateway-service 已安全关闭")
}
