// 百工谱 — 原始岗位追溯 gRPC 编排测试
package com.baigon.occupation.grpc.service.datasource;

import com.baigon.crawler.GetJobSourceByTraceIdResponse;
import com.baigon.datasource.GetSourceJobRequest;
import com.baigon.datasource.GetSourceJobResponse;
import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.crawler.CrawlerGrpcClient;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.datasource.CleanedJobSourceService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DataSourceGrpcServiceTest {

    private CleanedJobSourceService cleanedJobSourceService;
    private CrawlerGrpcClient crawlerGrpcClient;
    private DataSourceGrpcService service;

    @BeforeEach
    void setUp() {
        cleanedJobSourceService = mock(CleanedJobSourceService.class);
        crawlerGrpcClient = mock(CrawlerGrpcClient.class);
        service = new DataSourceGrpcService(
                cleanedJobSourceService,
                mock(LogService.class),
                crawlerGrpcClient);
    }

    @Test
    void getSourceJobShouldQueryCrawlerByCleanedJobTraceId() {
        CleanedJobSource cleaned = new CleanedJobSource();
        cleaned.setId(1001L);
        cleaned.setTraceId(9001L);
        when(cleanedJobSourceService.findById(1001L)).thenReturn(Optional.of(cleaned));
        when(crawlerGrpcClient.getJobSourceByTraceId(eq(9001L), any()))
                .thenReturn(GetJobSourceByTraceIdResponse.newBuilder()
                        .setId(2001L)
                        .setTraceId(9001L)
                        .setJobName("Java 工程师")
                        .build());
        @SuppressWarnings("unchecked")
        StreamObserver<GetSourceJobResponse> observer = mock(StreamObserver.class);

        service.getSourceJob(request(1001L), observer);

        ArgumentCaptor<GetSourceJobResponse> response =
                ArgumentCaptor.forClass(GetSourceJobResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals(2001L, response.getValue().getSource().getId());
        assertEquals("Java 工程师", response.getValue().getSource().getJobName());
    }

    @Test
    void getSourceJobShouldPreserveCrawlerNotFound() {
        CleanedJobSource cleaned = new CleanedJobSource();
        cleaned.setId(1001L);
        cleaned.setTraceId(9002L);
        when(cleanedJobSourceService.findById(1001L)).thenReturn(Optional.of(cleaned));
        when(crawlerGrpcClient.getJobSourceByTraceId(eq(9002L), any()))
                .thenThrow(new ApiException(ApiException.ErrorCode.NOT_FOUND,
                        "source job not found"));
        @SuppressWarnings("unchecked")
        StreamObserver<GetSourceJobResponse> observer = mock(StreamObserver.class);

        service.getSourceJob(request(1001L), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        verify(observer, never()).onCompleted();
        assertEquals(Status.Code.NOT_FOUND,
                Status.fromThrowable(error.getValue()).getCode());
    }

    private GetSourceJobRequest request(long id) {
        return GetSourceJobRequest.newBuilder()
                .setId(id)
                .setTraceId("8001")
                .setUserId(7L)
                .setUserName("reviewer")
                .setUserIp("127.0.0.1")
                .setRequestMethod("GET")
                .setRequestUrl("/api/auth/data-source/1001/source")
                .build();
    }
}
