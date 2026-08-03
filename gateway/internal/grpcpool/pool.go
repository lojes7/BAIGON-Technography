// 百工谱 — gRPC 客户端连接池
// 管理到各后端服务的 gRPC 连接，通过 Consul 做服务发现

package grpcpool

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	consulapi "github.com/hashicorp/consul/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// GrpcClientPool gRPC 客户端连接池
type GrpcClientPool struct {
	mu     sync.RWMutex
	conns  map[string]*grpc.ClientConn
	consul *consulapi.Client
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

	addr, err := p.discoverService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("服务发现失败 %s: %w", serviceName, err)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

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
