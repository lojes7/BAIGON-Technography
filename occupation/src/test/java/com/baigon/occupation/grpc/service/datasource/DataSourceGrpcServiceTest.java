// 百工谱 — 原始岗位追溯 gRPC 编排测试
package com.baigon.occupation.grpc.service.datasource;

import com.baigon.crawler.GetJobSourceByTraceIdResponse;
import com.baigon.datasource.CleanedJobDetail;
import com.baigon.datasource.GetSourceJobRequest;
import com.baigon.datasource.GetSourceJobResponse;
import com.baigon.datasource.ReviewAction;
import com.baigon.datasource.ReviewJobRequest;
import com.baigon.datasource.ReviewJobResponse;
import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.entity.datasource.ReviewedCleanedJobSource;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.grpc.client.crawler.CrawlerGrpcClient;
import com.baigon.occupation.service.AuditContext;
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

    @Test
    void approveWithEditShouldForwardAndReturnEditedMajor() {
        CleanedJobSource source = new CleanedJobSource();
        source.setId(1001L);
        source.setTraceId(9003L);
        source.setMajor("原专业");
        ReviewedCleanedJobSource approved = new ReviewedCleanedJobSource();
        approved.setMajor("软件工程");
        when(cleanedJobSourceService.review(
                eq(1001L),
                eq(CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT),
                any(CleanedJobSource.class),
                any(AuditContext.class)))
                .thenReturn(Optional.of(new CleanedJobSourceService.ReviewResult(source, approved)));
        @SuppressWarnings("unchecked")
        StreamObserver<ReviewJobResponse> observer = mock(StreamObserver.class);

        service.reviewJob(ReviewJobRequest.newBuilder()
                .setId(1001L)
                .setAction(ReviewAction.APPROVE_WITH_EDIT)
                .setEdited(CleanedJobDetail.newBuilder().setMajor("软件工程"))
                .setTraceId("8002")
                .setUserId(7L)
                .setUserName("reviewer")
                .setUserIp("127.0.0.1")
                .setRequestMethod("PUT")
                .setRequestUrl("/api/auth/data-source/1001/review")
                .build(), observer);

        ArgumentCaptor<CleanedJobSource> edited = ArgumentCaptor.forClass(CleanedJobSource.class);
        verify(cleanedJobSourceService).review(
                eq(1001L),
                eq(CleanedJobSourceService.ReviewAction.APPROVE_WITH_EDIT),
                edited.capture(),
                any(AuditContext.class));
        assertEquals("软件工程", edited.getValue().getMajor());
        ArgumentCaptor<ReviewJobResponse> response = ArgumentCaptor.forClass(ReviewJobResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals("软件工程", response.getValue().getJob().getMajor());
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
