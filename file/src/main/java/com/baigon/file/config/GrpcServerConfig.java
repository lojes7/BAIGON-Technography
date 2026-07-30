package com.baigon.file.config;

import net.devh.boot.grpc.server.serverfactory.GrpcServerConfigurer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;

import java.util.concurrent.TimeUnit;

/**
 * gRPC 服务端配置
 * 设置监听端口与 keep-alive 参数
 */
@Configuration
public class GrpcServerConfig {

    @Value("${grpc.server.port:50057}")
    private int grpcPort;

    @Bean
    public GrpcServerConfigurer grpcServerConfigurer() {
        return serverBuilder -> {
            if (serverBuilder instanceof NettyServerBuilder nettyBuilder) {
                nettyBuilder
                        .keepAliveTime(30, TimeUnit.SECONDS)
                        .keepAliveTimeout(10, TimeUnit.SECONDS)
                        .permitKeepAliveWithoutCalls(true);
            }
        };
    }
}
