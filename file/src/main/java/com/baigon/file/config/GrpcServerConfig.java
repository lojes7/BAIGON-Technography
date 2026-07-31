// 百工谱 — gRPC Server 配置

package com.baigon.file.config;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Configuration
public class GrpcServerConfig {

    private static final Logger log = LoggerFactory.getLogger(GrpcServerConfig.class);

    @Value("${grpc.server.port:50057}")
    private int grpcPort;

    private Server server;

    @PostConstruct
    public void startGrpcServer() throws IOException {
        server = ServerBuilder.forPort(grpcPort)
                .maxInboundMessageSize(50 * 1024 * 1024) // 50MB
                .keepAliveTime(30, TimeUnit.SECONDS)
                .keepAliveTimeout(10, TimeUnit.SECONDS)
                .permitKeepAliveWithoutCalls(true)
                .build()
                .start();

        log.info("gRPC server 启动在端口 {}", grpcPort);

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
