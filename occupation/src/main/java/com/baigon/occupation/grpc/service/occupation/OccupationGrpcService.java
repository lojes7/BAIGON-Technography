// 百工谱 — OccupationService gRPC 实现
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.common.AuditLogItem;
import com.baigon.common.PagedSearchAuditLogsRequest;
import com.baigon.common.PagedSearchAuditLogsResponse;
import com.baigon.occupation.CatalogDetailData;
import com.baigon.occupation.CatalogDetailRequest;
import com.baigon.occupation.CatalogDetailResponse;
import com.baigon.occupation.CatalogListRequest;
import com.baigon.occupation.CatalogListResponse;
import com.baigon.occupation.CatalogLookupRequest;
import com.baigon.occupation.CatalogLookupResponse;
import com.baigon.occupation.ChildCatalogListRequest;
import com.baigon.occupation.EmbeddableCatalogListResponse;
import com.baigon.occupation.EmbeddingProgress;
import com.baigon.occupation.EmbeddingTaskRequest;
import com.baigon.occupation.EmbeddingTaskStatus;
import com.baigon.occupation.GetEmbeddingProgressResponse;
import com.baigon.occupation.GetJobRequest;
import com.baigon.occupation.GetJobResponse;
import com.baigon.occupation.GetJobSkillResponse;
import com.baigon.occupation.GetJobAnalysisTaskRequest;
import com.baigon.occupation.GetJobAnalysisTaskResponse;
import com.baigon.occupation.GetJobAnalysisMajorCandidateResponse;
import com.baigon.occupation.GetJobAnalysisOccupationCandidateResponse;
import com.baigon.occupation.GetJobAnalysisResultResponse;
import com.baigon.occupation.GetJobSkillResolutionCandidateResponse;
import com.baigon.occupation.GetJobSkillResolutionTaskRequest;
import com.baigon.occupation.GetJobSkillResolutionTaskResponse;
import com.baigon.occupation.GetSkillRequest;
import com.baigon.occupation.GetSkillResponse;
import com.baigon.occupation.GetSkillRelationsRequest;
import com.baigon.occupation.GetSkillRelationsResponse;
import com.baigon.occupation.GetSkillGraphRequest;
import com.baigon.occupation.GetSkillGraphResponse;
import com.baigon.occupation.JobData;
import com.baigon.occupation.JobAnalysisCandidate;
import com.baigon.occupation.JobAnalysisMajorCandidate;
import com.baigon.occupation.JobAnalysisResult;
import com.baigon.occupation.JobAnalysisTaskDetail;
import com.baigon.occupation.JobAnalysisTaskSummary;
import com.baigon.occupation.JobSkillData;
import com.baigon.occupation.JobSkillResolutionTaskDetail;
import com.baigon.occupation.JobSkillResolutionTaskSummary;
import com.baigon.occupation.ListJobAnalysisTasksRequest;
import com.baigon.occupation.ListJobAnalysisTasksResponse;
import com.baigon.occupation.ListJobSkillResolutionTasksRequest;
import com.baigon.occupation.ListJobSkillResolutionTasksResponse;
import com.baigon.occupation.ListJobSkillResolutionSimilarSkillsResponse;
import com.baigon.occupation.ListSkillGraphEvidenceJobsRequest;
import com.baigon.occupation.ListSkillGraphEvidenceJobsResponse;
import com.baigon.occupation.ListJobsRequest;
import com.baigon.occupation.ListJobsResponse;
import com.baigon.occupation.ListSkillsRequest;
import com.baigon.occupation.ListSkillsResponse;
import com.baigon.occupation.LookupJobsResponse;
import com.baigon.occupation.LookupJobSkillsResponse;
import com.baigon.occupation.LookupJobAnalysisMajorCandidatesResponse;
import com.baigon.occupation.LookupJobAnalysisOccupationCandidatesResponse;
import com.baigon.occupation.LookupJobAnalysisResultsResponse;
import com.baigon.occupation.LookupJobAnalysisTasksResponse;
import com.baigon.occupation.LookupJobSkillResolutionCandidatesResponse;
import com.baigon.occupation.LookupJobSkillResolutionTasksResponse;
import com.baigon.occupation.LookupSkillsRequest;
import com.baigon.occupation.LookupSkillsResponse;
import com.baigon.occupation.LookupSkillGraphMetricsRequest;
import com.baigon.occupation.LookupSkillGraphMetricsResponse;
import com.baigon.occupation.OccupationServiceGrpc;
import com.baigon.occupation.ReviewJobAnalysisTaskRequest;
import com.baigon.occupation.ReviewJobSkillResolutionTaskRequest;
import com.baigon.occupation.ResourceIdResponse;
import com.baigon.occupation.SkillData;
import com.baigon.occupation.SkillDetailData;
import com.baigon.occupation.SkillGraphMetric;
import com.baigon.occupation.SkillLookupData;
import com.baigon.occupation.SkillRelationMutationRequest;
import com.baigon.occupation.SkillRelationMutationResponse;
import com.baigon.occupation.entity.BaseEntity;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.skill.JobSkillResolutionTask;
import com.baigon.occupation.entity.skill.Skill;
import com.baigon.occupation.entity.skill.SkillResolutionAction;
import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.EmbeddingDataService;
import com.baigon.occupation.service.EmbeddingTaskManager;
import com.baigon.occupation.service.EmbeddingTaskManager.Resource;
import com.baigon.occupation.service.EmbeddingTaskSnapshot;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.audit.AuditLogQueryService;
import com.baigon.occupation.service.catalog.CatalogDetail;
import com.baigon.occupation.service.catalog.CatalogLookupResult;
import com.baigon.occupation.service.jobanalysis.JobAnalysisQueryService;
import com.baigon.occupation.service.jobanalysis.JobAnalysisReviewService;
import com.baigon.occupation.service.job.JobQueryService;
import com.baigon.occupation.service.major.MajorCatalogService;
import com.baigon.occupation.service.occupation.OccupationCatalogService;
import com.baigon.occupation.service.skill.SkillResolutionQueryService;
import com.baigon.occupation.service.skill.SkillResolutionReviewService;
import com.baigon.occupation.service.skill.SkillHierarchyService;
import com.baigon.occupation.service.skill.graph.SkillGraphQueryService;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;

/** gateway REST 请求经 gRPC 进入本服务，所有成功与失败都写 occupation.logs。 */
@Service
public class OccupationGrpcService extends OccupationServiceGrpc.OccupationServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(OccupationGrpcService.class);

    private final MajorCatalogService majorCatalogService;
    private final OccupationCatalogService occupationCatalogService;
    private final EmbeddingTaskManager taskManager;
    private final JobAnalysisQueryService jobAnalysisQueryService;
    private final JobAnalysisReviewService jobAnalysisReviewService;
    private final SkillResolutionQueryService skillResolutionQueryService;
    private final SkillResolutionReviewService skillResolutionReviewService;
    private final SkillHierarchyService skillHierarchyService;
    private final SkillGraphQueryService skillGraphQueryService;
    private final JobQueryService jobQueryService;
    private final AuditLogQueryService auditLogQueryService;
    private final LogService logService;

    public OccupationGrpcService(MajorCatalogService majorCatalogService,
                                 OccupationCatalogService occupationCatalogService,
                                 EmbeddingTaskManager taskManager,
                                 JobAnalysisQueryService jobAnalysisQueryService,
                                 JobAnalysisReviewService jobAnalysisReviewService,
                                 SkillResolutionQueryService skillResolutionQueryService,
                                 SkillResolutionReviewService skillResolutionReviewService,
                                 SkillHierarchyService skillHierarchyService,
                                 SkillGraphQueryService skillGraphQueryService,
                                 JobQueryService jobQueryService,
                                 AuditLogQueryService auditLogQueryService,
                                 LogService logService) {
        this.majorCatalogService = majorCatalogService;
        this.occupationCatalogService = occupationCatalogService;
        this.taskManager = taskManager;
        this.jobAnalysisQueryService = jobAnalysisQueryService;
        this.jobAnalysisReviewService = jobAnalysisReviewService;
        this.skillResolutionQueryService = skillResolutionQueryService;
        this.skillResolutionReviewService = skillResolutionReviewService;
        this.skillHierarchyService = skillHierarchyService;
        this.skillGraphQueryService = skillGraphQueryService;
        this.jobQueryService = jobQueryService;
        this.auditLogQueryService = auditLogQueryService;
        this.logService = logService;
        logger.info("OccupationGrpcService 初始化完成");
    }

    @Override
    public void pagedSearchAuditLogs(PagedSearchAuditLogsRequest request,
                                     StreamObserver<PagedSearchAuditLogsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            User.Role requesterRole = enumOrNull(User.Role.class, request.getUserRole(), "user_role");
            if (request.getUserId() <= 0 || requesterRole == null) {
                throw new ApiException(ApiException.ErrorCode.UNAUTHORIZED, "invalid requester");
            }
            if (requesterRole != User.Role.ADMIN) {
                // gRPC 入口先拒绝非管理员，业务层仍保留相同校验作为纵深防御。
                throw new ApiException(ApiException.ErrorCode.FORBIDDEN, "ADMIN role required");
            }
            if (request.getTargetLogIdsCount() > 0) {
                var items = auditLogQueryService.batchGet(
                        request.getUserId(), requesterRole, request.getTargetLogIdsList());
                var missingIds = new LinkedHashSet<>(request.getTargetLogIdsList());
                items.stream().map(item -> item.log().getId()).forEach(missingIds::remove);
                respond(observer, PagedSearchAuditLogsResponse.newBuilder()
                        .addAllDetailItems(items.stream().map(this::auditLogItem).toList())
                        .addAllMissingAuditLogIds(missingIds)
                        .setTotal(items.size())
                        .setPage(0)
                        .setPageSize(items.size())
                        .build());
                logService.info(audit,
                        "batch get occupation audit logs: total=" + items.size());
                return;
            }
            Log.Level level = enumOrNull(Log.Level.class, request.getLevel(), "level");
            User.Role userType = enumOrNull(User.Role.class, request.getUserType(), "user_type");
            Page<AuditLogQueryService.AuditLogEntry> page = auditLogQueryService.pagedSearch(
                    request.getUserId(),
                    requesterRole,
                    request.getPage(),
                    request.getPageSize(),
                    new AuditLogQueryService.SearchCriteria(
                            level,
                            timeOrNull(request.getCreatedAtFrom(), "created_at_from"),
                            timeOrNull(request.getCreatedAtTo(), "created_at_to"),
                            request.getTargetUserId() == 0 ? null : request.getTargetUserId(),
                            userType));

            respond(observer, PagedSearchAuditLogsResponse.newBuilder()
                    .addAllAuditLogIds(page.getContent().stream()
                            .map(entry -> entry.log().getId()).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(page.getNumber())
                    .setPageSize(page.getSize())
                    .build());
            logService.info(audit, "paged search occupation audit logs: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "paged search occupation audit logs failed");
        }
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
            respond(observer, catalogResponse(page));
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
            respond(observer, catalogResponse(page));
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
            respond(observer, embeddableResponse(page));
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
            respond(observer, catalogResponse(page));
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
            respond(observer, catalogResponse(page));
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
            respond(observer, catalogResponse(page));
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
            respond(observer, embeddableResponse(page));
            logService.info(audit, "list occupations: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list occupations failed");
        }
    }

    @Override
    public void getDisciplineCategory(CatalogDetailRequest request,
                                      StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> majorCatalogService.getDisciplineCategory(request.getId()),
                CatalogKind.DISCIPLINE_CATEGORY, "discipline category");
    }

    @Override
    public void lookupDisciplineCategories(CatalogLookupRequest request,
                                           StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> majorCatalogService.lookupDisciplineCategories(request.getIdsList()),
                CatalogKind.DISCIPLINE_CATEGORY, "discipline categories");
    }

    @Override
    public void getMajorCategory(CatalogDetailRequest request,
                                 StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> majorCatalogService.getMajorCategory(request.getId()),
                CatalogKind.MAJOR_CATEGORY, "major category");
    }

    @Override
    public void lookupMajorCategories(CatalogLookupRequest request,
                                      StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> majorCatalogService.lookupMajorCategories(request.getIdsList()),
                CatalogKind.MAJOR_CATEGORY, "major categories");
    }

    @Override
    public void getMajor(CatalogDetailRequest request,
                         StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> majorCatalogService.getMajor(request.getId()),
                CatalogKind.MAJOR, "major");
    }

    @Override
    public void lookupMajors(CatalogLookupRequest request,
                             StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> majorCatalogService.lookupMajors(request.getIdsList()),
                CatalogKind.MAJOR, "majors");
    }

    @Override
    public void getOccupationMajorCategory(CatalogDetailRequest request,
                                           StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> occupationCatalogService.getMajorCategory(request.getId()),
                CatalogKind.OCCUPATION_MAJOR_CATEGORY, "occupation major category");
    }

    @Override
    public void lookupOccupationMajorCategories(
            CatalogLookupRequest request,
            StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> occupationCatalogService.lookupMajorCategories(request.getIdsList()),
                CatalogKind.OCCUPATION_MAJOR_CATEGORY, "occupation major categories");
    }

    @Override
    public void getOccupationSubCategory(CatalogDetailRequest request,
                                         StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> occupationCatalogService.getSubCategory(request.getId()),
                CatalogKind.OCCUPATION_SUB_CATEGORY, "occupation sub category");
    }

    @Override
    public void lookupOccupationSubCategories(
            CatalogLookupRequest request,
            StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> occupationCatalogService.lookupSubCategories(request.getIdsList()),
                CatalogKind.OCCUPATION_SUB_CATEGORY, "occupation sub categories");
    }

    @Override
    public void getOccupationCategory(CatalogDetailRequest request,
                                      StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> occupationCatalogService.getCategory(request.getId()),
                CatalogKind.OCCUPATION_CATEGORY, "occupation category");
    }

    @Override
    public void lookupOccupationCategories(
            CatalogLookupRequest request,
            StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> occupationCatalogService.lookupCategories(request.getIdsList()),
                CatalogKind.OCCUPATION_CATEGORY, "occupation categories");
    }

    @Override
    public void getOccupation(CatalogDetailRequest request,
                              StreamObserver<CatalogDetailResponse> observer) {
        getCatalog(request, observer,
                () -> occupationCatalogService.getOccupation(request.getId()),
                CatalogKind.OCCUPATION, "occupation");
    }

    @Override
    public void lookupOccupations(CatalogLookupRequest request,
                                  StreamObserver<CatalogLookupResponse> observer) {
        lookupCatalog(request, observer,
                () -> occupationCatalogService.lookupOccupations(request.getIdsList()),
                CatalogKind.OCCUPATION, "occupations");
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
            EmbeddingDataService.Progress skills = taskManager.getProgress(Resource.SKILL);
            GetEmbeddingProgressResponse response = GetEmbeddingProgressResponse.newBuilder()
                    .setMajors(progress(majors))
                    .setOccupations(progress(occupations))
                    .setSkills(progress(skills))
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
    public void startSkillEmbedding(EmbeddingTaskRequest request,
                                    StreamObserver<EmbeddingTaskStatus> observer) {
        startTask(Resource.SKILL, request, observer);
    }

    @Override
    public void getSkillEmbeddingStatus(EmbeddingTaskRequest request,
                                        StreamObserver<EmbeddingTaskStatus> observer) {
        getTaskStatus(Resource.SKILL, request, observer);
    }

    @Override
    public void stopSkillEmbedding(EmbeddingTaskRequest request,
                                   StreamObserver<EmbeddingTaskStatus> observer) {
        stopTask(Resource.SKILL, request, observer);
    }

    @Override
    public void listJobAnalysisTasks(ListJobAnalysisTasksRequest request,
                                     StreamObserver<ListJobAnalysisTasksResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            Page<JobAnalysisTask> page = jobAnalysisQueryService.list(
                    request.getPage(), request.getPageSize(),
                    request.getTaskStatus(), request.getReviewStatus());
            respond(observer, ListJobAnalysisTasksResponse.newBuilder()
                    .addAllIds(page.getContent().stream().map(JobAnalysisTask::getId).toList())
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
    public void lookupJobAnalysisTasks(
            CatalogLookupRequest request,
            StreamObserver<LookupJobAnalysisTasksResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            JobAnalysisQueryService.Lookup<JobAnalysisTask> lookup =
                    jobAnalysisQueryService.lookupTasks(request.getIdsList());
            respond(observer, LookupJobAnalysisTasksResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::jobAnalysisSummary).toList())
                    .addAllMissingIds(lookup.missingIds())
                    .build());
            logService.info(audit, "lookup job analysis tasks: total=" + lookup.items().size()
                    + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job analysis tasks failed");
        }
    }

    @Override
    public void getJobAnalysisOccupationCandidate(
            GetJobAnalysisTaskRequest request,
            StreamObserver<GetJobAnalysisOccupationCandidateResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var item = jobAnalysisQueryService.getOccupationCandidate(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "occupation candidate not found"));
            respond(observer, GetJobAnalysisOccupationCandidateResponse.newBuilder()
                    .setItem(jobAnalysisCandidate(item)).build());
            logService.info(audit, "get job analysis occupation candidate: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job analysis occupation candidate failed");
        }
    }

    @Override
    public void lookupJobAnalysisOccupationCandidates(
            CatalogLookupRequest request,
            StreamObserver<LookupJobAnalysisOccupationCandidatesResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var lookup = jobAnalysisQueryService.lookupOccupationCandidates(request.getIdsList());
            respond(observer, LookupJobAnalysisOccupationCandidatesResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::jobAnalysisCandidate).toList())
                    .addAllMissingIds(lookup.missingIds()).build());
            logService.info(audit, "lookup job analysis occupation candidates: total="
                    + lookup.items().size() + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job analysis occupation candidates failed");
        }
    }

    @Override
    public void getJobAnalysisMajorCandidate(
            GetJobAnalysisTaskRequest request,
            StreamObserver<GetJobAnalysisMajorCandidateResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var item = jobAnalysisQueryService.getMajorCandidate(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "major candidate not found"));
            respond(observer, GetJobAnalysisMajorCandidateResponse.newBuilder()
                    .setItem(jobAnalysisMajorCandidate(item)).build());
            logService.info(audit, "get job analysis major candidate: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job analysis major candidate failed");
        }
    }

    @Override
    public void lookupJobAnalysisMajorCandidates(
            CatalogLookupRequest request,
            StreamObserver<LookupJobAnalysisMajorCandidatesResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var lookup = jobAnalysisQueryService.lookupMajorCandidates(request.getIdsList());
            respond(observer, LookupJobAnalysisMajorCandidatesResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::jobAnalysisMajorCandidate).toList())
                    .addAllMissingIds(lookup.missingIds()).build());
            logService.info(audit, "lookup job analysis major candidates: total="
                    + lookup.items().size() + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job analysis major candidates failed");
        }
    }

    @Override
    public void getJobAnalysisResult(
            GetJobAnalysisTaskRequest request,
            StreamObserver<GetJobAnalysisResultResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var item = jobAnalysisQueryService.getResult(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "job analysis result not found"));
            respond(observer, GetJobAnalysisResultResponse.newBuilder()
                    .setItem(jobAnalysisResult(item)).build());
            logService.info(audit, "get job analysis result: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job analysis result failed");
        }
    }

    @Override
    public void lookupJobAnalysisResults(
            CatalogLookupRequest request,
            StreamObserver<LookupJobAnalysisResultsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var lookup = jobAnalysisQueryService.lookupResults(request.getIdsList());
            respond(observer, LookupJobAnalysisResultsResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::jobAnalysisResult).toList())
                    .addAllMissingIds(lookup.missingIds()).build());
            logService.info(audit, "lookup job analysis results: total="
                    + lookup.items().size() + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job analysis results failed");
        }
    }

    @Override
    public void reviewJobAnalysisTask(ReviewJobAnalysisTaskRequest request,
                                      StreamObserver<ResourceIdResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            if (request.getId() <= 0 || request.getMajorId() <= 0
                    || request.getOccupationId() <= 0) {
                throw new IllegalArgumentException(
                        "id, major_id and occupation_id must be > 0");
            }
            var decisions = request.getSkillReviewsList().stream()
                    .map(item -> new JobAnalysisReviewService.SkillReviewDecision(
                            item.getResultId(),
                            JobAnalysisReviewAction.valueOf(item.getAction().toUpperCase(Locale.ROOT)),
                            item.getSkillName(), item.getSkillProficiency(), item.getEvidence()))
                    .toList();
            var reviewed = jobAnalysisReviewService.review(
                    request.getId(), request.getMajorId(), request.getOccupationId(), decisions, audit);
            if (reviewed.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job analysis task not found"));
                return;
            }
            respond(observer, ResourceIdResponse.newBuilder()
                    .setId(reviewed.get().task().getId())
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
    public void listSkills(ListSkillsRequest request,
                           StreamObserver<ListSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            Page<Skill> page = skillResolutionQueryService.listSkills(
                    request.getPage(), request.getPageSize(), request.getKeyword());
            respond(observer, ListSkillsResponse.newBuilder()
                    .addAllIds(page.getContent().stream().map(Skill::getId).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(page.getNumber())
                    .setPageSize(page.getSize())
                    .build());
            logService.info(audit, "list canonical skills: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list canonical skills failed");
        }
    }

    @Override
    public void getSkill(GetSkillRequest request,
                         StreamObserver<GetSkillResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var skill = skillHierarchyService.getSkill(request.getId());
            if (skill.isEmpty()) {
                throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "skill not found");
            }
            respond(observer, GetSkillResponse.newBuilder()
                    .setSkill(skillDetailData(skill.get()))
                    .build());
            logService.info(audit, "get canonical skill: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get canonical skill failed");
        }
    }

    @Override
    public void lookupSkills(LookupSkillsRequest request,
                             StreamObserver<LookupSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            SkillHierarchyService.SkillLookup lookup =
                    skillHierarchyService.lookupSkills(request.getSkillIdsList());
            respond(observer, LookupSkillsResponse.newBuilder()
                    .addAllItems(lookup.skills().stream().map(skill -> SkillLookupData.newBuilder()
                            .setId(skill.getId())
                            .setName(orEmpty(skill.getName()))
                            .setIsEmbed(skill.getEmbeddingStatus() == TaskStatus.SUCCESS)
                            .build()).toList())
                    .addAllMissingSkillIds(lookup.missingSkillIds())
                    .build());
            logService.info(audit, "lookup canonical skills: total=" + lookup.skills().size()
                    + ", missing=" + lookup.missingSkillIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup canonical skills failed");
        }
    }

    @Override
    public void getSkillRelations(GetSkillRelationsRequest request,
                                  StreamObserver<GetSkillRelationsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            SkillHierarchyService.DirectRelations relations = skillHierarchyService
                    .getDirectRelations(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "skill not found"));
            List<Long> skillIds = switch (request.getDirection().trim().toLowerCase(Locale.ROOT)) {
                case "parents" -> relations.parentSkillIds();
                case "children" -> relations.childSkillIds();
                default -> throw new IllegalArgumentException(
                        "direction must be parents or children");
            };
            respond(observer, GetSkillRelationsResponse.newBuilder()
                    .addAllSkillIds(skillIds)
                    .build());
            logService.info(audit, "get direct skill relations: id=" + request.getId()
                    + ", direction=" + request.getDirection() + ", total=" + skillIds.size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get direct skill relations failed");
        }
    }

    @Override
    public void getSkillGraph(GetSkillGraphRequest request,
                              StreamObserver<GetSkillGraphResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            SkillGraphQueryService.SkillGraph graph = skillGraphQueryService.getGraph(
                    request.getScopeType(), request.getScopeId(),
                    request.getFromMonth(), request.getToMonth());
            respond(observer, skillGraphResponse(graph));
            logService.info(audit,
                    "get skill graph: scope_type=" + request.getScopeType()
                            + ", scope_id=" + graph.scopeId()
                            + ", skills=" + graph.directSkillIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get skill graph failed");
        }
    }

    @Override
    public void lookupSkillGraphMetrics(
            LookupSkillGraphMetricsRequest request,
            StreamObserver<LookupSkillGraphMetricsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            SkillGraphQueryService.MetricLookup lookup = skillGraphQueryService.lookupMetrics(
                    request.getScopeType(), request.getScopeId(), request.getSkillIdsList(),
                    request.getFromMonth(), request.getToMonth());
            respond(observer, LookupSkillGraphMetricsResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(metric -> SkillGraphMetric.newBuilder()
                            .setSkillId(metric.skillId())
                            .setJobCount(metric.jobCount())
                            .setCoverage(metric.coverage())
                            .build()).toList())
                    .addAllMissingIds(lookup.missingIds())
                    .build());
            logService.info(audit, "lookup skill graph metrics: scope_type="
                    + request.getScopeType() + ", scope_id=" + request.getScopeId()
                    + ", total=" + lookup.items().size()
                    + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup skill graph metrics failed");
        }
    }

    @Override
    public void listSkillGraphEvidenceJobs(
            ListSkillGraphEvidenceJobsRequest request,
            StreamObserver<ListSkillGraphEvidenceJobsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            SkillGraphQueryService.EvidencePage page = skillGraphQueryService.listEvidenceJobs(
                    request.getScopeType(), request.getScopeId(), request.getSkillId(),
                    request.getFromMonth(), request.getToMonth(),
                    request.getPage(), request.getPageSize());
            respond(observer, ListSkillGraphEvidenceJobsResponse.newBuilder()
                    .addAllJobIds(page.jobIds())
                    .setTotal(page.total())
                    .setPage(page.page())
                    .setPageSize(page.pageSize())
                    .build());
            logService.info(audit, "list skill graph evidence jobs: scope_type="
                    + request.getScopeType() + ", scope_id=" + request.getScopeId()
                    + ", skill_id=" + request.getSkillId() + ", total=" + page.total());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list skill graph evidence jobs failed");
        }
    }

    @Override
    public void addSkillRelation(SkillRelationMutationRequest request,
                                 StreamObserver<SkillRelationMutationResponse> observer) {
        mutateSkillRelation(request, observer, true);
    }

    @Override
    public void deleteSkillRelation(SkillRelationMutationRequest request,
                                    StreamObserver<SkillRelationMutationResponse> observer) {
        mutateSkillRelation(request, observer, false);
    }

    private void mutateSkillRelation(SkillRelationMutationRequest request,
                                     StreamObserver<SkillRelationMutationResponse> observer,
                                     boolean add) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            if (add) {
                skillHierarchyService.addRelation(
                        request.getParentSkillId(), request.getChildSkillId());
            } else {
                skillHierarchyService.deleteRelation(
                        request.getParentSkillId(), request.getChildSkillId());
            }
            respond(observer, SkillRelationMutationResponse.newBuilder()
                    .setParentSkillId(request.getParentSkillId())
                    .setChildSkillId(request.getChildSkillId())
                    .build());
            logService.info(audit, (add ? "add" : "delete")
                    + " skill relation: parent_skill_id=" + request.getParentSkillId()
                    + ", child_skill_id=" + request.getChildSkillId());
        } catch (Exception exception) {
            fail(observer, audit, exception,
                    (add ? "add" : "delete") + " skill relation failed");
        }
    }

    @Override
    public void listJobSkillResolutionTasks(
            ListJobSkillResolutionTasksRequest request,
            StreamObserver<ListJobSkillResolutionTasksResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            Page<JobSkillResolutionTask> page = skillResolutionQueryService.listTasks(
                    request.getPage(), request.getPageSize(),
                    request.getTaskStatus(), request.getReviewStatus());
            respond(observer, ListJobSkillResolutionTasksResponse.newBuilder()
                    .addAllIds(page.getContent().stream()
                            .map(JobSkillResolutionTask::getId).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(page.getNumber())
                    .setPageSize(page.getSize())
                    .build());
            logService.info(audit,
                    "list job skill resolution tasks: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list job skill resolution tasks failed");
        }
    }

    @Override
    public void lookupJobSkillResolutionTasks(
            CatalogLookupRequest request,
            StreamObserver<LookupJobSkillResolutionTasksResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var lookup = skillResolutionQueryService.lookupTasks(request.getIdsList());
            respond(observer, LookupJobSkillResolutionTasksResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::skillResolutionSummary).toList())
                    .addAllMissingIds(lookup.missingIds())
                    .build());
            logService.info(audit, "lookup job skill resolution tasks: total="
                    + lookup.items().size() + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job skill resolution tasks failed");
        }
    }

    @Override
    public void getJobSkillResolutionCandidate(
            GetJobSkillResolutionTaskRequest request,
            StreamObserver<GetJobSkillResolutionCandidateResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var item = skillResolutionQueryService.getCandidate(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "skill resolution candidate not found"));
            respond(observer, GetJobSkillResolutionCandidateResponse.newBuilder()
                    .setItem(skillResolutionCandidate(item))
                    .build());
            logService.info(audit, "get job skill resolution candidate: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job skill resolution candidate failed");
        }
    }

    @Override
    public void lookupJobSkillResolutionCandidates(
            CatalogLookupRequest request,
            StreamObserver<LookupJobSkillResolutionCandidatesResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var lookup = skillResolutionQueryService.lookupCandidates(request.getIdsList());
            respond(observer, LookupJobSkillResolutionCandidatesResponse.newBuilder()
                    .addAllItems(lookup.items().stream().map(this::skillResolutionCandidate).toList())
                    .addAllMissingIds(lookup.missingIds())
                    .build());
            logService.info(audit, "lookup job skill resolution candidates: total="
                    + lookup.items().size() + ", missing=" + lookup.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job skill resolution candidates failed");
        }
    }

    @Override
    public void getJobSkillResolutionTask(
            GetJobSkillResolutionTaskRequest request,
            StreamObserver<GetJobSkillResolutionTaskResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var detail = skillResolutionQueryService.getDetail(request.getId());
            if (detail.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job skill resolution task not found"));
                return;
            }
            respond(observer, GetJobSkillResolutionTaskResponse.newBuilder()
                    .setResolution(skillResolutionDetail(detail.get()))
                    .build());
            logService.info(audit, "get job skill resolution task: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job skill resolution task failed");
        }
    }

    @Override
    public void listJobSkillResolutionSimilarSkills(
            GetJobSkillResolutionTaskRequest request,
            StreamObserver<ListJobSkillResolutionSimilarSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var candidates = skillResolutionQueryService.listSimilarSkills(request.getId());
            if (candidates.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job skill resolution task not found"));
                return;
            }
            var response = ListJobSkillResolutionSimilarSkillsResponse.newBuilder();
            int rank = 1;
            for (var candidate : candidates.get()) {
                response.addItems(com.baigon.occupation.JobSkillResolutionCandidate.newBuilder()
                        .setSkillId(candidate.getId())
                        .setRank(rank++)
                        .setSimilarity(candidate.getSimilarity() == null
                                ? 0 : candidate.getSimilarity())
                        .build());
            }
            respond(observer, response.build());
            logService.info(audit,
                    "list job skill resolution similar skills: task_id=" + request.getId()
                            + ", total=" + candidates.get().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list job skill resolution similar skills failed");
        }
    }

    @Override
    public void reviewJobSkillResolutionTask(
            ReviewJobSkillResolutionTaskRequest request,
            StreamObserver<ResourceIdResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            if (request.getId() <= 0 || request.getResolutionAction().isBlank()) {
                throw new IllegalArgumentException(
                        "id must be > 0 and resolution_action is required");
            }
            SkillResolutionAction action = SkillResolutionAction.valueOf(
                    request.getResolutionAction().trim().toUpperCase(Locale.ROOT));
            Long skillId = request.getSkillId() > 0 ? request.getSkillId() : null;
            var reviewed = skillResolutionReviewService.review(
                    request.getId(), action, skillId, request.getNewSkillName(),
                    request.getParentSkillIdsList(), audit);
            if (reviewed.isEmpty()) {
                observer.onError(ApiException.grpcException(ApiException.ErrorCode.NOT_FOUND,
                        "job skill resolution task not found"));
                return;
            }
            respond(observer, ResourceIdResponse.newBuilder()
                    .setId(reviewed.get().getId())
                    .build());
            logService.info(audit,
                    "review job skill resolution task: id=" + request.getId()
                            + ", action=" + action.name());
        } catch (ApiException exception) {
            logger.warn("review job skill resolution rejected: {}", exception.getMessage());
            logService.warning(audit, exception.getMessage());
            observer.onError(exception.asGrpcException());
        } catch (IllegalArgumentException exception) {
            logger.warn("review job skill resolution rejected: {}", exception.getMessage());
            logService.warning(audit, exception.getMessage());
            observer.onError(ApiException.grpcException(
                    ApiException.ErrorCode.BAD_REQUEST, exception.getMessage()));
        } catch (Exception exception) {
            fail(observer, audit, exception, "review job skill resolution task failed");
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
                    request.getName(), request.getOccupationId(), request.getMajorId(), request.getMajor(),
                    request.getCity(), request.getProvince(), request.getSalary(),
                    request.getCompany(), request.getEducation(), request.getNature(),
                    request.getCompanySize());
            Page<Job> page = jobQueryService.list(request.getPage(), request.getPageSize(), criteria);
            respond(observer, ListJobsResponse.newBuilder()
                    .addAllIds(page.getContent().stream().map(Job::getId).toList())
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
            respond(observer, GetJobResponse.newBuilder()
                    .setJob(jobData(detail.get().job(), detail.get().jobSkillIds()))
                    .build());
            logService.info(audit, "get job: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job failed");
        }
    }

    @Override
    public void lookupJobs(CatalogLookupRequest request,
                           StreamObserver<LookupJobsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            JobQueryService.JobLookup result = jobQueryService.lookupJobs(request.getIdsList());
            respond(observer, LookupJobsResponse.newBuilder()
                    .addAllItems(result.items().stream()
                            .map(item -> jobData(item.job(), item.jobSkillIds())).toList())
                    .addAllMissingIds(result.missingIds())
                    .build());
            logService.info(audit, "lookup jobs: total=" + result.items().size()
                    + ", missing=" + result.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup jobs failed");
        }
    }

    @Override
    public void getJobSkill(GetJobRequest request,
                            StreamObserver<GetJobSkillResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            JobSkill skill = jobQueryService.getJobSkill(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "job skill not found"));
            respond(observer, GetJobSkillResponse.newBuilder()
                    .setJobSkill(jobSkillData(skill))
                    .build());
            logService.info(audit, "get job skill: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get job skill failed");
        }
    }

    @Override
    public void lookupJobSkills(CatalogLookupRequest request,
                                StreamObserver<LookupJobSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            JobQueryService.JobSkillLookup result =
                    jobQueryService.lookupJobSkills(request.getIdsList());
            respond(observer, LookupJobSkillsResponse.newBuilder()
                    .addAllItems(result.items().stream().map(this::jobSkillData).toList())
                    .addAllMissingIds(result.missingIds())
                    .build());
            logService.info(audit, "lookup job skills: total=" + result.items().size()
                    + ", missing=" + result.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup job skills failed");
        }
    }

    private void getCatalog(CatalogDetailRequest request,
                            StreamObserver<CatalogDetailResponse> observer,
                            Supplier<Optional<CatalogDetail>> loader,
                            CatalogKind kind,
                            String label) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            CatalogDetail detail = loader.get().orElseThrow(() -> new ApiException(
                    ApiException.ErrorCode.NOT_FOUND, label + " not found"));
            respond(observer, CatalogDetailResponse.newBuilder()
                    .setItem(catalogDetailData(detail, kind))
                    .build());
            logService.info(audit, "get " + label + ": id=" + detail.id());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get " + label + " failed");
        }
    }

    private void lookupCatalog(CatalogLookupRequest request,
                               StreamObserver<CatalogLookupResponse> observer,
                               Supplier<CatalogLookupResult> loader,
                               CatalogKind kind,
                               String label) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            CatalogLookupResult result = loader.get();
            respond(observer, CatalogLookupResponse.newBuilder()
                    .addAllItems(result.items().stream()
                            .map(item -> catalogDetailData(item, kind)).toList())
                    .addAllMissingIds(result.missingIds())
                    .build());
            logService.info(audit, "lookup " + label + ": total=" + result.items().size()
                    + ", missing=" + result.missingIds().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup " + label + " failed");
        }
    }

    private CatalogDetailData catalogDetailData(CatalogDetail detail, CatalogKind kind) {
        CatalogDetailData.Builder builder = CatalogDetailData.newBuilder()
                .setId(detail.id())
                .setCode(orEmpty(detail.code()))
                .setName(orEmpty(detail.name()));
        long parentId = detail.parentId() == null ? 0 : detail.parentId();
        switch (kind) {
            case MAJOR_CATEGORY -> builder.setDisciplineCategoryId(parentId);
            case MAJOR -> builder.setMajorCategoryId(parentId).setIsEmbed(detail.embed());
            case OCCUPATION_SUB_CATEGORY -> builder.setOccupationMajorCategoryId(parentId);
            case OCCUPATION_CATEGORY -> builder.setOccupationSubCategoryId(parentId);
            case OCCUPATION -> builder.setOccupationCategoryId(parentId)
                    .setIsEmbed(detail.embed())
                    .setDescription(orEmpty(detail.description()));
            case DISCIPLINE_CATEGORY, OCCUPATION_MAJOR_CATEGORY -> {
                // 根级目录没有父级字段。
            }
        }
        return builder.build();
    }

    private enum CatalogKind {
        DISCIPLINE_CATEGORY,
        MAJOR_CATEGORY,
        MAJOR,
        OCCUPATION_MAJOR_CATEGORY,
        OCCUPATION_SUB_CATEGORY,
        OCCUPATION_CATEGORY,
        OCCUPATION
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

    private CatalogListResponse catalogResponse(Page<? extends BaseEntity> page) {
        return CatalogListResponse.newBuilder()
                .addAllIds(page.getContent().stream().map(BaseEntity::getId).toList())
                .setTotal(page.getTotalElements())
                .setPage(page.getNumber())
                .setPageSize(page.getSize())
                .build();
    }

    private EmbeddableCatalogListResponse embeddableResponse(
            Page<? extends BaseEntity> page) {
        return EmbeddableCatalogListResponse.newBuilder()
                .addAllIds(page.getContent().stream().map(BaseEntity::getId).toList())
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
                .setTaskStatus(task.getTaskStatus() == null ? "" : task.getTaskStatus().name())
                .setReviewStatus(task.getReviewStatus() == null ? "" : task.getReviewStatus().name())
                .setSelectedOccupationId(task.getSelectedOccupationId() == null ? 0 : task.getSelectedOccupationId())
                .setAttempts(task.getAttempts() == null ? 0 : task.getAttempts())
                .setCreatedAt(time(task.getCreatedAt()))
                .setReviewedAt(time(task.getReviewedAt()))
                .setReviewedBy(task.getReviewedBy() == null ? 0 : task.getReviewedBy())
                .setOccupationAnalysisStatus(task.getOccupationAnalysisStatus() == null
                        ? "" : task.getOccupationAnalysisStatus().name())
                .setJdAnalysisStatus(task.getJdAnalysisStatus() == null
                        ? "" : task.getJdAnalysisStatus().name())
                .setSelectedMajorId(task.getSelectedMajorId() == null ? 0 : task.getSelectedMajorId())
                .setMajorAnalysisStatus(task.getMajorAnalysisStatus() == null
                        ? "" : task.getMajorAnalysisStatus().name())
                .build();
    }

    private JobAnalysisTaskDetail jobAnalysisDetail(JobAnalysisQueryService.JobAnalysisDetail detail) {
        return JobAnalysisTaskDetail.newBuilder()
                .setTask(jobAnalysisSummary(detail.task()))
                .addAllCandidateIds(detail.candidateIds())
                .addAllMajorCandidateIds(detail.majorCandidateIds())
                .addAllResultIds(detail.resultIds())
                .build();
    }

    private JobAnalysisCandidate jobAnalysisCandidate(
            com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate candidate) {
        return JobAnalysisCandidate.newBuilder()
                .setId(candidate.getId())
                .setOccupationId(candidate.getOccupationId())
                .setRank(candidate.getRank() == null ? 0 : candidate.getRank())
                .setSimilarity(candidate.getSimilarity() == null ? 0 : candidate.getSimilarity())
                .build();
    }

    private JobAnalysisMajorCandidate jobAnalysisMajorCandidate(
            com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate candidate) {
        return JobAnalysisMajorCandidate.newBuilder()
                .setId(candidate.getId())
                .setMajorId(candidate.getMajorId())
                .setRank(candidate.getRank() == null ? 0 : candidate.getRank())
                .setSimilarity(candidate.getSimilarity() == null ? 0 : candidate.getSimilarity())
                .build();
    }

    private JobAnalysisResult jobAnalysisResult(
            com.baigon.occupation.entity.jobanalysis.JobAnalysisResult result) {
        return JobAnalysisResult.newBuilder()
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
                .build();
    }

    private SkillData skillData(Skill skill) {
        return SkillData.newBuilder()
                .setId(skill.getId())
                .setName(orEmpty(skill.getName()))
                .setIsEmbed(skill.getEmbeddingStatus() == TaskStatus.SUCCESS)
                .build();
    }

    private SkillDetailData skillDetailData(Skill skill) {
        return SkillDetailData.newBuilder()
                .setSkill(skillData(skill))
                .build();
    }

    private GetSkillGraphResponse skillGraphResponse(
            SkillGraphQueryService.SkillGraph graph) {
        return GetSkillGraphResponse.newBuilder()
                .setScopeId(graph.scopeId())
                .addAllDirectSkillIds(graph.directSkillIds())
                .build();
    }

    private JobSkillResolutionTaskSummary skillResolutionSummary(JobSkillResolutionTask task) {
        return JobSkillResolutionTaskSummary.newBuilder()
                .setId(task.getId())
                .setJobSkillId(task.getJobSkillId())
                .setTaskStatus(task.getTaskStatus() == null ? "" : task.getTaskStatus().name())
                .setReviewStatus(task.getReviewStatus() == null ? "" : task.getReviewStatus().name())
                .setResolutionAction(task.getResolutionAction() == null
                        ? "" : task.getResolutionAction().name())
                .setSelectedSkillId(task.getSelectedSkillId() == null
                        ? 0 : task.getSelectedSkillId())
                .setAttempts(task.getAttempts() == null ? 0 : task.getAttempts())
                .setCreatedAt(time(task.getCreatedAt()))
                .setReviewedAt(time(task.getReviewedAt()))
                .setReviewedBy(task.getReviewedBy() == null ? 0 : task.getReviewedBy())
                .build();
    }

    private JobSkillResolutionTaskDetail skillResolutionDetail(
            SkillResolutionQueryService.Detail detail) {
        return JobSkillResolutionTaskDetail.newBuilder()
                .setTask(skillResolutionSummary(detail.task()))
                .addAllCandidateIds(detail.candidateIds())
                .build();
    }

    private com.baigon.occupation.JobSkillResolutionCandidate skillResolutionCandidate(
            com.baigon.occupation.entity.skill.JobSkillResolutionCandidate candidate) {
        return com.baigon.occupation.JobSkillResolutionCandidate.newBuilder()
                .setId(candidate.getId())
                .setSkillId(candidate.getSkillId())
                .setRank(candidate.getRank() == null ? 0 : candidate.getRank())
                .setSimilarity(candidate.getSimilarity() == null ? 0 : candidate.getSimilarity())
                .build();
    }

    private JobData jobData(Job job, List<Long> jobSkillIds) {
        return JobData.newBuilder()
                .setId(job.getId())
                .setName(orEmpty(job.getName()))
                .setOccupationId(job.getOccupationId() == null ? 0 : job.getOccupationId())
                .setMajorId(job.getMajorId() == null ? 0 : job.getMajorId())
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
                .addAllJobSkillIds(jobSkillIds)
                .build();
    }

    private JobSkillData jobSkillData(JobSkill skill) {
        return JobSkillData.newBuilder()
                .setId(skill.getId())
                .setSkillId(skill.getSkillId() == null ? 0 : skill.getSkillId())
                .setSkillName(orEmpty(skill.getSkillName()))
                .setSkillProficiency(orEmpty(skill.getSkillProficiency()))
                .setEvidence(orEmpty(skill.getEvidence()))
                .setJobId(skill.getJobId() == null ? 0 : skill.getJobId())
                .build();
    }

    private AuditLogItem auditLogItem(AuditLogQueryService.AuditLogEntry entry) {
        Log log = entry.log();
        return AuditLogItem.newBuilder()
                .setId(log.getId())
                .setTraceId(log.getTraceId() == null ? 0 : log.getTraceId())
                .setUserId(log.getUserId())
                .setUserName(orEmpty(log.getUserName()))
                .setUserType(orEmpty(entry.userType()))
                .setUserIp(orEmpty(log.getUserIp()))
                .setLevel(log.getLevel() == null ? "" : log.getLevel().name())
                .setRequestMethod(log.getRequestMethod() == null ? "" : log.getRequestMethod().name())
                .setRequestUrl(orEmpty(log.getRequestUrl()))
                .setErrorMsg(orEmpty(log.getErrorMsg()))
                .setDetail(orEmpty(log.getDetail()))
                .setCreatedAt(time(log.getCreatedAt()))
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

    private <E extends Enum<E>> E enumOrNull(Class<E> type, String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("invalid " + fieldName);
        }
    }

    private OffsetDateTime timeOrNull(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("invalid " + fieldName);
        }
    }

    private String time(OffsetDateTime value) {
        return value == null ? "" : value.toString();
    }
}
