// 百工谱 — crawler-service gRPC 客户端
// 通过 Consul 发现 crawler-service 实例，查询 job_sources 原始记录（跨库追溯）。
// 注：gateway 已提供 crawler 查询的 REST 端点，但合并服务仍通过内部 gRPC 直连，
// 遵循"服务间走 gRPC"的约定（与 gateway → 后端 的调用方式一致）。

package com.baigon.occupation.grpc;

import com.baigon.crawler.CrawlerServiceGrpc;
import com.baigon.crawler.GetJobSourceByTraceIdRequest;
import com.baigon.crawler.GetJobSourceByTraceIdResponse;
import com.baigon.occupation.service.AuditContext;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class CrawlerGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(CrawlerGrpcClient.class);

    private final DiscoveryClient discoveryClient;

    public CrawlerGrpcClient(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    /**
     * 按 trace_id 查询 crawler 库中的原始岗位记录（job_sources 表）。
     * 返回 null 表示未找到或服务不可用。
     */
    public GetJobSourceByTraceIdResponse getJobSourceByTraceId(long traceId, AuditContext audit) {
        String address = discoverCrawlerAddress();
        if (address == null) {
            log.warn("crawler-service 无可用实例，无法查询原始记录 trace_id={}", traceId);
            return null;
        }
        ManagedChannel channel = ManagedChannelBuilder.forTarget(address)
                .usePlaintext()
                .build();
        try {
            CrawlerServiceGrpc.CrawlerServiceBlockingStub stub =
                    CrawlerServiceGrpc.newBlockingStub(channel)
                            .withDeadlineAfter(5, TimeUnit.SECONDS);
            GetJobSourceByTraceIdResponse resp = stub.getJobSourceByTraceId(
                    GetJobSourceByTraceIdRequest.newBuilder()
                            .setTraceId(traceId)
                            .setUserId(audit.userId())
                            .setUserName(audit.userName())
                            .setUserIp(audit.userIp())
                            .setRequestMethod(audit.requestMethod())
                            .setRequestUrl(audit.requestUrl())
                            .build());
            return resp;
        } catch (Exception e) {
            log.error("调 crawler-service 查询原始记录失败 trace_id={}", traceId, e);
            return null;
        } finally {
            channel.shutdown();
        }
    }

    /** 从 Consul 发现 crawler-service 健康实例，返回 "host:port" 地址 */
    private String discoverCrawlerAddress() {
        List<ServiceInstance> instances = discoveryClient.getInstances("crawler-service");
        if (instances == null || instances.isEmpty()) {
            return null;
        }
        ServiceInstance instance = instances.get(0);
        return instance.getHost() + ":" + instance.getPort();
    }
}
