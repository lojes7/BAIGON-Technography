// 百工谱 — OccupationService gRPC 实现
package com.baigon.occupation.grpc;

import com.baigon.occupation.CatalogItem;
import com.baigon.occupation.CatalogListRequest;
import com.baigon.occupation.CatalogListResponse;
import com.baigon.occupation.ChildCatalogListRequest;
import com.baigon.occupation.EmbeddableCatalogItem;
import com.baigon.occupation.EmbeddableCatalogListResponse;
import com.baigon.occupation.EmbeddingProgress;
import com.baigon.occupation.EmbeddingTaskRequest;
import com.baigon.occupation.EmbeddingTaskStatus;
import com.baigon.occupation.GetEmbeddingProgressResponse;
import com.baigon.occupation.GetJobAnalysisTaskRequest;
import com.baigon.occupation.GetJobAnalysisTaskResponse;
import com.baigon.occupation.JobAnalysisCandidate;
import com.baigon.occupation.JobAnalysisTaskDetail;
import com.baigon.occupation.JobAnalysisTaskSummary;
import com.baigon.occupation.ListJobAnalysisTasksRequest;
import com.baigon.occupation.ListJobAnalysisTasksResponse;
import com.baigon.occupation.OccupationServiceGrpc;
import com.baigon.occupation.ReviewJobAnalysisTaskRequest;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingTaskManager;
import com.baigon.occupation.service.EmbeddingTaskManager.Resource;
import com.baigon.occupation.service.EmbeddingTaskSnapshot;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisReviewService;
import com.baigon.occupation.service.major.MajorCatalogService;
import com.baigon.occupation.service.occupation.OccupationCatalogService;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/** gateway REST 请求经 gRPC 进入本服务，所有成功与失败都写 occupation.logs。 */
@Service
public class OccupationGrpcService extends OccupationServiceGrpc.OccupationServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(OccupationGrpcService.class);

    private final MajorCatalogService majorCatalogService;
    private final OccupationCatalogService occupationCatalogService;
    private final EmbeddingTaskManager taskManager;
    private final JobAnalysisQueryService jobAnalysisQueryService;
    private final JobAnalysisReviewService jobAnalysisReviewService;
    private final LogService logService;

    public OccupationGrpcService(MajorCatalogService majorCatalogService,
                                 OccupationCatalogService occupationCatalogService,
                                 EmbeddingTaskManager taskManager,
                                 JobAnalysisQueryService jobAnalysisQueryService,
                                 JobAnalysisReviewService jobAnalysisReviewService,
                                 LogService logService) {
        this.majorCatalogService = majorCatalogService;
        this.occupationCatalogService = occupationCatalogService;
        this.taskManager = taskManager;
        this.jobAnalysisQueryService = jobAnalysisQueryService;
        this.jobAnalysisReviewService = jobAnalysisReviewService;
        this.logService = logService;
        logger.info("OccupationGrpcService 初始化完成");
    }

    @Override
    public void listDisciplineCategories(CatalogListRequest request,
                                         StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = majorCatalogService.normalizedPageSize(request.getPageSize());
            var page = majorCatalogService.listDisciplineCategories(
                    request.getPage(), pageSize, request.getKeyword());
            respond(observer, catalogResponse(page.map(item -> catalogItem(
                    item.getId(), item.getCode(), item.getName()))));
            logService.info(audit, "list discipline categories: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list discipline categories failed");
        }
    }

    @Override
    public void listMajorCategories(ChildCatalogListRequest request,
                                    StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = majorCatalogService.normalizedPageSize(request.getPageSize());
            var page = majorCatalogService.listMajorCategories(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, catalogResponse(page.map(item -> catalogItem(
                    item.getId(), item.getCode(), item.getName()))));
            logService.info(audit, "list major categories: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list major categories failed");
        }
    }

    @Override
    public void listMajors(ChildCatalogListRequest request,
                           StreamObserver<EmbeddableCatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = majorCatalogService.normalizedPageSize(request.getPageSize());
            var page = majorCatalogService.listMajors(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, embeddableResponse(page.map(item -> embeddableCatalogItem(
                    item.getId(), item.getCode(), item.getName(), item.getEmbeddingStatus()))));
            logService.info(audit, "list majors: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list majors failed");
        }
    }

    @Override
    public void listOccupationMajorCategories(CatalogListRequest request,
                                              StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = occupationCatalogService.normalizedPageSize(request.getPageSize());
            var page = occupationCatalogService.listMajorCategories(
                    request.getPage(), pageSize, request.getKeyword());
            respond(observer, catalogResponse(page.map(item -> catalogItem(
                    item.getId(), item.getCode(), item.getName()))));
            logService.info(audit, "list occupation major categories: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list occupation major categories failed");
        }
    }

    @Override
    public void listOccupationSubCategories(ChildCatalogListRequest request,
                                            StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = occupationCatalogService.normalizedPageSize(request.getPageSize());
            var page = occupationCatalogService.listSubCategories(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, catalogResponse(page.map(item -> catalogItem(
                    item.getId(), item.getCode(), item.getName()))));
            logService.info(audit, "list occupation sub categories: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list occupation sub categories failed");
        }
    }

    @Override
    public void listOccupationCategories(ChildCatalogListRequest request,
                                         StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = occupationCatalogService.normalizedPageSize(request.getPageSize());
            var page = occupationCatalogService.listCategories(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, catalogResponse(page.map(item -> catalogItem(
                    item.getId(), item.getCode(), item.getName()))));
            logService.info(audit, "list occupation categories: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list occupation categories failed");
        }
    }

    @Override
    public void listOccupations(ChildCatalogListRequest request,
                                StreamObserver<EmbeddableCatalogListResponse> observer) {
        AuditContext audit = audit(request);
        try {
            int pageSize = occupationCatalogService.normalizedPageSize(request.getPageSize());
            var page = occupationCatalogService.listOccupations(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, embeddableResponse(page.map(item -> embeddableCatalogItem(
                    item.getId(), item.getCode(), item.getName(), item.getEmbeddingStatus()))));
            logService.info(audit, "list occupations: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list occupations failed");
        }
    }

    @Override
    public void getEmbeddingProgress(EmbeddingTaskRequest request,
                                     StreamObserver<GetEmbeddingProgressResponse> observer) {
        AuditContext audit = audit(request);
        try {
            EmbeddingDataService.Progress majors = taskManager.getProgress(Resource.MAJOR);
            EmbeddingDataService.Progress occupations = taskManager.getProgress(Resource.OCCUPATION);
            GetEmbeddingProgressResponse response = GetEmbeddingProgressResponse.newBuilder()
                    .setMajors(progress(majors))
                    .setOccupations(progress(occupations))
                    .build();
            respond(observer, response);
            logService.info(audit, "get embedding progress");
        } catch (Exception exception) {
            fail(observer, audit, exception, "get embedding progress failed");
        }
    }

    @Override
    public void startMajorEmbedding(EmbeddingTaskRequest request,
                                    StreamObserver<EmbeddingTaskStatus> observer) {
        startTask(Resource.MAJOR, request, observer);
    }

    @Override
    public void getMajorEmbeddingStatus(EmbeddingTaskRequest request,
                                        StreamObserver<EmbeddingTaskStatus> observer) {
        getTaskStatus(Resource.MAJOR, request, observer);
    }

    @Override
    public void stopMajorEmbedding(EmbeddingTaskRequest request,
                                   StreamObserver<EmbeddingTaskStatus> observer) {
        stopTask(Resource.MAJOR, request, observer);
    }

    @Override
    public void startOccupationEmbedding(EmbeddingTaskRequest request,
                                         StreamObserver<EmbeddingTaskStatus> observer) {
        startTask(Resource.OCCUPATION, request, observer);
    }

    @Override
    public void getOccupationEmbeddingStatus(EmbeddingTaskRequest request,
                                             StreamObserver<EmbeddingTaskStatus> observer) {
        getTaskStatus(Resource.OCCUPATION, request, observer);
    }

    @Override
    public void stopOccupationEmbedding(EmbeddingTaskRequest request,
                                        StreamObserver<EmbeddingTaskStatus> observer) {
        stopTask(Resource.OCCUPATION, request, observer);
    }

    @Override
    public void listJobAnalysisTasks(ListJobAnalysisTasksRequest request,
                                     StreamObserver<ListJobAnalysisTasksResponse> observer) {
        AuditContext audit = audit(request);
        try {
            Page<JobAnalysisTask> page = jobAnalysisQueryService.list(
                    request.getPage(), request.getPageSize(), request.getReviewStatus());
            respond(observer, ListJobAnalysisTasksResponse.newBuilder()
                    .addAllItems(page.getContent().stream().map(this::jobAnalysisSummary).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(page.getNumber())
                    .setPageSize(page.getSize())
                    .build());
            logService.info(audit, "list job analysis tasks: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list job analysis tasks failed");
        }
    }

    @Override
    public void getJobAnalysisTask(GetJobAnalysisTaskRequest request,
                                   StreamObserver<GetJobAnalysisTaskResponse> observer) {
        AuditContext audit = audit(request);
        try {
            var detail = jobAnalysisQueryService.detail(request.getId());
            if (detail.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job analysis task not found"));
                return;
            }
            respond(observer, GetJobAnalysisTaskResponse.newBuilder()
                    .setAnalysis(jobAnalysisDetail(detail.get()))
                    .build());
            logService.info(audit, "get job analysis task: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job analysis task failed");
        }
    }

    @Override
    public void reviewJobAnalysisTask(ReviewJobAnalysisTaskRequest request,
                                      StreamObserver<GetJobAnalysisTaskResponse> observer) {
        AuditContext audit = audit(request);
        try {
            if (request.getId() <= 0 || request.getOccupationId() <= 0) {
                throw new IllegalArgumentException("id and occupation_id must be > 0");
            }
            var reviewed = jobAnalysisReviewService.review(
                    request.getId(), request.getOccupationId(), audit);
            if (reviewed.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job analysis task not found"));
                return;
            }
            var detail = jobAnalysisQueryService.detail(request.getId()).orElseThrow();
            respond(observer, GetJobAnalysisTaskResponse.newBuilder()
                    .setAnalysis(jobAnalysisDetail(detail))
                    .build());
        } catch (ApiException exception) {
            logger.warn("review job analysis rejected: {}", exception.getMessage());
            logService.warning(audit, exception.getMessage());
            observer.onError(exception.asGrpcException());
        } catch (IllegalArgumentException exception) {
            logger.warn("review job analysis rejected: {}", exception.getMessage());
            logService.warning(audit, exception.getMessage());
            observer.onError(ApiException.grpcException(ApiException.ErrorCode.BAD_REQUEST, exception.getMessage()));
        } catch (Exception exception) {
            fail(observer, audit, exception, "review job analysis task failed");
        }
    }

    private void startTask(Resource resource,
                           EmbeddingTaskRequest request,
                           StreamObserver<EmbeddingTaskStatus> observer) {
        AuditContext audit = audit(request);
        try {
            respond(observer, taskStatus(taskManager.start(resource, audit)));
        } catch (Exception exception) {
            fail(observer, audit, exception, "start embedding task failed");
        }
    }

    private void getTaskStatus(Resource resource,
                               EmbeddingTaskRequest request,
                               StreamObserver<EmbeddingTaskStatus> observer) {
        AuditContext audit = audit(request);
        try {
            EmbeddingTaskSnapshot snapshot = taskManager.getStatus(resource);
            respond(observer, taskStatus(snapshot));
            logService.info(audit, "get " + resource.name().toLowerCase() + " embedding status: " + snapshot.status());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get embedding task status failed");
        }
    }

    private void stopTask(Resource resource,
                          EmbeddingTaskRequest request,
                          StreamObserver<EmbeddingTaskStatus> observer) {
        AuditContext audit = audit(request);
        try {
            respond(observer, taskStatus(taskManager.stop(resource, audit)));
        } catch (Exception exception) {
            fail(observer, audit, exception, "stop embedding task failed");
        }
    }

    private CatalogItem catalogItem(Long id, String code, String name) {
        return CatalogItem.newBuilder()
                .setId(id)
                .setCode(orEmpty(code))
                .setName(orEmpty(name))
                .build();
    }

    private EmbeddableCatalogItem embeddableCatalogItem(Long id,
                                                        String code,
                                                        String name,
                                                        TaskStatus status) {
        return EmbeddableCatalogItem.newBuilder()
                .setId(id)
                .setCode(orEmpty(code))
                .setName(orEmpty(name))
                .setIsEmbed(status == TaskStatus.SUCCESS)
                .build();
    }

    private CatalogListResponse catalogResponse(Page<CatalogItem> page) {
        return CatalogListResponse.newBuilder()
                .addAllItems(page.getContent())
                .setTotal(page.getTotalElements())
                .setPage(page.getNumber())
                .setPageSize(page.getSize())
                .build();
    }

    private EmbeddableCatalogListResponse embeddableResponse(Page<EmbeddableCatalogItem> page) {
        return EmbeddableCatalogListResponse.newBuilder()
                .addAllItems(page.getContent())
                .setTotal(page.getTotalElements())
                .setPage(page.getNumber())
                .setPageSize(page.getSize())
                .build();
    }

    private EmbeddingProgress progress(EmbeddingDataService.Progress progress) {
        return EmbeddingProgress.newBuilder()
                .setEmbedded(progress.embedded())
                .setTotal(progress.total())
                .build();
    }

    private EmbeddingTaskStatus taskStatus(EmbeddingTaskSnapshot snapshot) {
        return EmbeddingTaskStatus.newBuilder()
                .setStatus(orEmpty(snapshot.status()))
                .setTraceId(orEmpty(snapshot.traceId()))
                .setTotal(snapshot.total())
                .setProcessed(snapshot.processed())
                .setSucceeded(snapshot.succeeded())
                .setFailed(snapshot.failed())
                .setMessage(orEmpty(snapshot.message()))
                .setStartedAt(time(snapshot.startedAt()))
                .setFinishedAt(time(snapshot.finishedAt()))
                .build();
    }

    private JobAnalysisTaskSummary jobAnalysisSummary(JobAnalysisTask task) {
        return JobAnalysisTaskSummary.newBuilder()
                .setId(task.getId())
                .setJobId(task.getJobId())
                .setTraceId(task.getTraceId())
                .setJobName(orEmpty(task.getJobName()))
                .setTaskStatus(task.getTaskStatus() == null ? "" : task.getTaskStatus().name())
                .setReviewStatus(task.getReviewStatus() == null ? "" : task.getReviewStatus().name())
                .setSelectedOccupationId(task.getSelectedOccupationId() == null ? 0 : task.getSelectedOccupationId())
                .setModelName(orEmpty(task.getModelName()))
                .setErrorMsg(orEmpty(task.getErrorMsg()))
                .setAttempts(task.getAttempts() == null ? 0 : task.getAttempts())
                .setCreatedAt(time(task.getCreatedAt()))
                .setReviewedAt(time(task.getReviewedAt()))
                .setReviewedBy(task.getReviewedBy() == null ? 0 : task.getReviewedBy())
                .build();
    }

    private JobAnalysisTaskDetail jobAnalysisDetail(JobAnalysisQueryService.JobAnalysisDetail detail) {
        return JobAnalysisTaskDetail.newBuilder()
                .setTask(jobAnalysisSummary(detail.task()))
                .addAllCandidates(detail.candidates().stream().map(candidate ->
                        JobAnalysisCandidate.newBuilder()
                                .setOccupationId(candidate.getOccupationId())
                                .setOccupationName(orEmpty(candidate.getOccupationName()))
                                .setRank(candidate.getRank())
                                .setSimilarity(candidate.getSimilarity())
                                .build()).toList())
                .build();
    }

    private AuditContext audit(CatalogListRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(ChildCatalogListRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(EmbeddingTaskRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(ListJobAnalysisTasksRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(GetJobAnalysisTaskRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(ReviewJobAnalysisTaskRequest request) {
        return audit(request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
    }

    private AuditContext audit(String traceId,
                               long userId,
                               String userName,
                               String userIp,
                               String requestMethod,
                               String requestUrl) {
        Long parsedTraceId = null;
        if (traceId != null && !traceId.isBlank()) {
            try {
                parsedTraceId = Long.parseLong(traceId);
            } catch (NumberFormatException ignored) {
                // 非法 trace_id 不阻断业务，后台任务启动时会生成新的雪花 ID。
            }
        }
        return new AuditContext(parsedTraceId, userId, userName, userIp, requestMethod, requestUrl);
    }

    private <T> void respond(StreamObserver<T> observer, T response) {
        observer.onNext(response);
        observer.onCompleted();
    }

    private <T> void fail(StreamObserver<T> observer,
                          AuditContext audit,
                          Exception exception,
                          String detail) {
        logger.error(detail, exception);
        logService.error(audit, exception.getMessage(), detail);
        if (exception instanceof ApiException apiException) {
            observer.onError(apiException.asGrpcException());
        } else if (exception instanceof IllegalArgumentException) {
            observer.onError(ApiException.grpcException(ApiException.ErrorCode.BAD_REQUEST, exception.getMessage()));
        } else {
            observer.onError(ApiException.grpcException(ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    private String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private String time(OffsetDateTime value) {
        return value == null ? "" : value.toString();
    }
}
