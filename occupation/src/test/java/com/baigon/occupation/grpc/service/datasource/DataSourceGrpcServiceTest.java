// 百工谱 — 原始岗位追溯 gRPC 编排测试
package com.baigon.occupation.grpc.service.datasource;

import com.baigon.crawler.GetJobSourceByTraceIdResponse;
import com.baigon.datasource.BatchGetCleanedJobsRequest;
import com.baigon.datasource.BatchGetCleanedJobsResponse;
import com.baigon.datasource.CleanedJobDetail;
import com.baigon.datasource.GetSourceJobRequest;
import com.baigon.datasource.GetSourceJobResponse;
import com.baigon.datasource.ListCleanedJobsRequest;
import com.baigon.datasource.ListCleanedJobsResponse;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
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
    void listCleanedJobsShouldReturnOnlyIdPage() {
        CleanedJobSource first = cleanedJob(1001L, "Java 工程师");
        CleanedJobSource second = cleanedJob(1002L, "Go 工程师");
        when(cleanedJobSourceService.list(1, 20, null, null, null))
                .thenReturn(new PageImpl<>(
                        List.of(first, second), PageRequest.of(1, 20), 42));
        @SuppressWarnings("unchecked")
        StreamObserver<ListCleanedJobsResponse> observer = mock(StreamObserver.class);

        service.listCleanedJobs(ListCleanedJobsRequest.newBuilder()
                .setPage(1)
                .setPageSize(20)
                .build(), observer);

        ArgumentCaptor<ListCleanedJobsResponse> response =
                ArgumentCaptor.forClass(ListCleanedJobsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(1001L, 1002L), response.getValue().getCleanedJobIdsList());
        assertEquals(42L, response.getValue().getTotal());
        assertEquals(null, response.getValue().getDescriptorForType().findFieldByName("items"));
    }

    @Test
    void batchGetCleanedJobsShouldKeepStableOrderAndReportMissingIds() {
        CleanedJobSource first = cleanedJob(1002L, "Go 工程师");
        CleanedJobSource second = cleanedJob(1001L, "Java 工程师");
        when(cleanedJobSourceService.batchFindByIds(List.of(1002L, 1001L, 1002L, 9999L)))
                .thenReturn(List.of(first, second));
        @SuppressWarnings("unchecked")
        StreamObserver<BatchGetCleanedJobsResponse> observer = mock(StreamObserver.class);

        service.batchGetCleanedJobs(BatchGetCleanedJobsRequest.newBuilder()
                .addAllIds(List.of(1002L, 1001L, 1002L, 9999L))
                .build(), observer);

        ArgumentCaptor<BatchGetCleanedJobsResponse> response =
                ArgumentCaptor.forClass(BatchGetCleanedJobsResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(List.of(1002L, 1001L), response.getValue().getJobsList().stream()
                .map(CleanedJobDetail::getId).toList());
        assertEquals(List.of(9999L), response.getValue().getMissingIdsList());
    }

    @Test
    void approveWithEditShouldForwardEditAndReturnOnlyCleanedJobId() {
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
        assertEquals(1001L, response.getValue().getCleanedJobId());
        assertEquals(1, response.getValue().getDescriptorForType().getFields().size());
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

    private CleanedJobSource cleanedJob(long id, String name) {
        CleanedJobSource source = new CleanedJobSource();
        source.setId(id);
        source.setTraceId(id + 8000L);
        source.setJobName(name);
        return source;
    }
}
