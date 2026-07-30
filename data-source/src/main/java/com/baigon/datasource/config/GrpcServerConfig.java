// 百工谱 — gRPC Server 配置

package com.baigon.datasource.config;

import com.baigon.datasource.grpc.DataSourceGrpcService;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * gRPC Server 手动配置（与 grpc-server-spring-boot-starter 互为补充）
 * 用于注册 DataSourceService gRPC 实现
 */
@Configuration
public class GrpcServerConfig {

    private static final Logger log = LoggerFactory.getLogger(GrpcServerConfig.class);

    @Value("${grpc.server.port:50052}")
    private int grpcPort;

    private Server server;

    private final DataSourceGrpcService grpcService;

    public GrpcServerConfig(DataSourceGrpcService grpcService) {
        this.grpcService = grpcService;
    }

    @PostConstruct
    public void startGrpcServer() throws IOException {
        server = ServerBuilder.forPort(grpcPort)
                // TODO: 当 proto stub 生成后注册实际服务
                // .addService(grpcService)
                .maxInboundMessageSize(50 * 1024 * 1024) // 50MB
                .build()
                .start();

        log.info("gRPC server 启动在端口 {}", grpcPort);

        // 注册 JVM 关闭钩子
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("正在关闭 gRPC server...");
            GrpcServerConfig.this.stopGrpcServer();
        }));
    }

    @PreDestroy
    public void stopGrpcServer() {
        if (server != null) {
            server.shutdown();
            log.info("gRPC server 已关闭");
        }
    }
}
