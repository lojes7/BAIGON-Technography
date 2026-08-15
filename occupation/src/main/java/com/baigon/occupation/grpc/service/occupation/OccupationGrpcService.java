// 百工谱 — OccupationService gRPC 实现
package com.baigon.occupation.grpc.service.occupation;

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
import com.baigon.occupation.GetJobRequest;
import com.baigon.occupation.GetJobResponse;
import com.baigon.occupation.GetJobAnalysisTaskRequest;
import com.baigon.occupation.GetJobAnalysisTaskResponse;
import com.baigon.occupation.JobData;
import com.baigon.occupation.JobAnalysisCandidate;
import com.baigon.occupation.JobAnalysisResult;
import com.baigon.occupation.JobAnalysisTaskDetail;
import com.baigon.occupation.JobAnalysisTaskSummary;
import com.baigon.occupation.JobOccupationData;
import com.baigon.occupation.JobSkillData;
import com.baigon.occupation.ListJobAnalysisTasksRequest;
import com.baigon.occupation.ListJobAnalysisTasksResponse;
import com.baigon.occupation.ListJobsRequest;
import com.baigon.occupation.ListJobsResponse;
import com.baigon.occupation.OccupationServiceGrpc;
import com.baigon.occupation.ReviewJobAnalysisTaskRequest;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingTaskManager;
import com.baigon.occupation.service.EmbeddingTaskManager.Resource;
import com.baigon.occupation.service.EmbeddingTaskSnapshot;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisReviewService;
import com.baigon.occupation.service.job.JobQueryService;
import com.baigon.occupation.service.major.MajorCatalogService;
import com.baigon.occupation.service.occupation.OccupationCatalogService;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Locale;

/** gateway REST 请求经 gRPC 进入本服务，所有成功与失败都写 occupation.logs。 */
@Service
public class OccupationGrpcService extends OccupationServiceGrpc.OccupationServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(OccupationGrpcService.class);

    private final MajorCatalogService majorCatalogService;
    private final OccupationCatalogService occupationCatalogService;
    private final EmbeddingTaskManager taskManager;
    private final JobAnalysisQueryService jobAnalysisQueryService;
    private final JobAnalysisReviewService jobAnalysisReviewService;
    private final JobQueryService jobQueryService;
    private final LogService logService;

    public OccupationGrpcService(MajorCatalogService majorCatalogService,
                                 OccupationCatalogService occupationCatalogService,
                                 EmbeddingTaskManager taskManager,
                                 JobAnalysisQueryService jobAnalysisQueryService,
                                 JobAnalysisReviewService jobAnalysisReviewService,
                                 JobQueryService jobQueryService,
                                 LogService logService) {
        this.majorCatalogService = majorCatalogService;
        this.occupationCatalogService = occupationCatalogService;
        this.taskManager = taskManager;
        this.jobAnalysisQueryService = jobAnalysisQueryService;
        this.jobAnalysisReviewService = jobAnalysisReviewService;
        this.jobQueryService = jobQueryService;
        this.logService = logService;
        logger.info("OccupationGrpcService 初始化完成");
    }

    @Override
    public void listDisciplineCategories(CatalogListRequest request,
                                         StreamObserver<CatalogListResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            if (request.getId() <= 0 || request.getOccupationId() <= 0) {
                throw new IllegalArgumentException("id and occupation_id must be > 0");
            }
            var decisions = request.getSkillReviewsList().stream()
                    .map(item -> new JobAnalysisReviewService.SkillReviewDecision(
                            item.getResultId(),
                            JobAnalysisReviewAction.valueOf(item.getAction().toUpperCase(Locale.ROOT)),
                            item.getSkillName(), item.getSkillProficiency(), item.getEvidence()))
                    .toList();
            var reviewed = jobAnalysisReviewService.review(
                    request.getId(), request.getOccupationId(), decisions, audit);
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

    @Override
    public void listJobs(ListJobsRequest request,
                         StreamObserver<ListJobsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var criteria = new JobQueryService.JobSearchCriteria(
                    request.getName(), request.getOccupationId(), request.getMajor(),
                    request.getCity(), request.getProvince(), request.getSalary(),
                    request.getCompany(), request.getEducation(), request.getNature(),
                    request.getCompanySize());
            Page<Job> page = jobQueryService.list(request.getPage(), request.getPageSize(), criteria);
            respond(observer, ListJobsResponse.newBuilder()
                    .addAllItems(page.getContent().stream().map(this::jobData).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(page.getNumber())
                    .setPageSize(page.getSize())
                    .build());
            logService.info(audit, "list jobs: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list jobs failed");
        }
    }

    @Override
    public void getJob(GetJobRequest request,
                       StreamObserver<GetJobResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var detail = jobQueryService.detail(request.getId());
            if (detail.isEmpty()) {
                logService.warning(audit, "job not found: id=" + request.getId());
                observer.onError(ApiException.grpcException(
                        ApiException.ErrorCode.NOT_FOUND, "job not found"));
                return;
            }
            GetJobResponse.Builder response = GetJobResponse.newBuilder()
                    .setJob(jobData(detail.get().job()))
                    .addAllJobSkills(detail.get().jobSkills().stream().map(this::jobSkillData).toList());
            if (detail.get().occupation() != null) {
                response.setOccupation(jobOccupationData(detail.get().occupation()));
            }
            respond(observer, response.build());
            logService.info(audit, "get job: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job failed");
        }
    }

    private void startTask(Resource resource,
                           EmbeddingTaskRequest request,
                           StreamObserver<EmbeddingTaskStatus> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            respond(observer, taskStatus(taskManager.start(resource, audit)));
        } catch (Exception exception) {
            fail(observer, audit, exception, "start embedding task failed");
        }
    }

    private void getTaskStatus(Resource resource,
                               EmbeddingTaskRequest request,
                               StreamObserver<EmbeddingTaskStatus> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
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
                .setOccupationAnalysisStatus(task.getOccupationAnalysisStatus() == null
                        ? "" : task.getOccupationAnalysisStatus().name())
                .setJdAnalysisStatus(task.getJdAnalysisStatus() == null
                        ? "" : task.getJdAnalysisStatus().name())
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
                .addAllResults(detail.results().stream().map(result ->
                        JobAnalysisResult.newBuilder()
                                .setId(result.getId())
                                .setJobId(result.getJobId())
                                .setSkillName(orEmpty(result.getSkillName()))
                                .setSkillProficiency(orEmpty(result.getSkillProficiency()))
                                .setEvidence(orEmpty(result.getEvidence()))
                                .setRank(result.getRank() == null ? 0 : result.getRank())
                                .setReviewStatus(result.getReviewStatus() == null
                                        ? "" : result.getReviewStatus().name())
                                .setReviewAction(result.getReviewAction() == null
                                        ? "" : result.getReviewAction().name())
                                .setReviewedSkillName(orEmpty(result.getReviewedSkillName()))
                                .setReviewedSkillProficiency(orEmpty(result.getReviewedSkillProficiency()))
                                .setReviewedEvidence(orEmpty(result.getReviewedEvidence()))
                                .setReviewedAt(time(result.getReviewedAt()))
                                .setReviewedBy(result.getReviewedBy() == null ? 0 : result.getReviewedBy())
                                .build()).toList())
                .build();
    }

    private JobData jobData(Job job) {
        return JobData.newBuilder()
                .setId(job.getId())
                .setName(orEmpty(job.getName()))
                .setOccupationId(job.getOccupationId() == null ? 0 : job.getOccupationId())
                .setPublishDate(time(job.getPublishDate()))
                .setSourcePlatform(orEmpty(job.getSourcePlatform()))
                .setSourceUrl(orEmpty(job.getSourceUrl()))
                .setCity(orEmpty(job.getCity()))
                .setTags(orEmpty(job.getTags()))
                .setMajor(orEmpty(job.getMajor()))
                .setNature(orEmpty(job.getNature()))
                .setSalary(orEmpty(job.getSalary()))
                .setCompanyName(orEmpty(job.getCompanyName()))
                .setCompanySize(orEmpty(job.getCompanySize()))
                .setProvince(orEmpty(job.getProvince()))
                .setEducation(orEmpty(job.getEducation()))
                .setExperience(orEmpty(job.getExperience()))
                .setJobDescription(orEmpty(job.getJobDescription()))
                .setCreatedAt(time(job.getCreatedAt()))
                .setUpdatedAt(time(job.getUpdatedAt()))
                .build();
    }

    private JobOccupationData jobOccupationData(Occupation occupation) {
        return JobOccupationData.newBuilder()
                .setId(occupation.getId())
                .setCode(orEmpty(occupation.getCode()))
                .setName(orEmpty(occupation.getName()))
                .setOccupationCategoryId(occupation.getOccupationCategoryId())
                .setDescription(orEmpty(occupation.getDescription()))
                .build();
    }

    private JobSkillData jobSkillData(JobSkill skill) {
        return JobSkillData.newBuilder()
                .setId(skill.getId())
                .setSkillName(orEmpty(skill.getSkillName()))
                .setSkillProficiency(orEmpty(skill.getSkillProficiency()))
                .setEvidence(orEmpty(skill.getEvidence()))
                .build();
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
