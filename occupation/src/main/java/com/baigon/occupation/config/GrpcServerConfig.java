// 百工谱 — gRPC Server 配置

package com.baigon.occupation.config;

import com.baigon.occupation.grpc.service.datasource.DataSourceGrpcService;
import com.baigon.occupation.grpc.service.occupation.OccupationGrpcService;
import com.baigon.occupation.grpc.service.user.UserGrpcService;
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
 * 用于在同一端口注册数据治理、职业与用户三套既有 gRPC 契约。
 */
@Configuration
public class GrpcServerConfig {

    private static final Logger log = LoggerFactory.getLogger(GrpcServerConfig.class);

    @Value("${grpc.server.port:50054}")
    private int grpcPort;

    private Server server;

    private final OccupationGrpcService occupationGrpcService;
    private final DataSourceGrpcService dataSourceGrpcService;
    private final UserGrpcService userGrpcService;

    public GrpcServerConfig(OccupationGrpcService occupationGrpcService,
                            DataSourceGrpcService dataSourceGrpcService,
                            UserGrpcService userGrpcService) {
        this.occupationGrpcService = occupationGrpcService;
        this.dataSourceGrpcService = dataSourceGrpcService;
        this.userGrpcService = userGrpcService;
    }

    @PostConstruct
    public void startGrpcServer() throws IOException {
        server = ServerBuilder.forPort(grpcPort)
                // 部署合并不破坏既有 protobuf 契约：同一端口注册三套服务。
                .addService(occupationGrpcService)
                .addService(dataSourceGrpcService)
                .addService(userGrpcService)
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
