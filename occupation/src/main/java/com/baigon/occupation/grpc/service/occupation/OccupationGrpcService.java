// 百工谱 — OccupationService gRPC 实现
package com.baigon.occupation.grpc.service.occupation;

import com.baigon.common.AuditLogItem;
import com.baigon.common.PagedSearchAuditLogsRequest;
import com.baigon.common.PagedSearchAuditLogsResponse;
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
import com.baigon.occupation.GetJobSkillResolutionTaskRequest;
import com.baigon.occupation.GetJobSkillResolutionTaskResponse;
import com.baigon.occupation.GetSkillRequest;
import com.baigon.occupation.GetSkillResponse;
import com.baigon.occupation.GetSkillGraphRequest;
import com.baigon.occupation.GetSkillGraphResponse;
import com.baigon.occupation.JobData;
import com.baigon.occupation.JobAnalysisCandidate;
import com.baigon.occupation.JobAnalysisMajorCandidate;
import com.baigon.occupation.JobAnalysisResult;
import com.baigon.occupation.JobAnalysisTaskDetail;
import com.baigon.occupation.JobAnalysisTaskSummary;
import com.baigon.occupation.JobMajorData;
import com.baigon.occupation.JobOccupationData;
import com.baigon.occupation.JobSkillData;
import com.baigon.occupation.JobSkillResolutionTaskDetail;
import com.baigon.occupation.JobSkillResolutionTaskSummary;
import com.baigon.occupation.ListJobAnalysisTasksRequest;
import com.baigon.occupation.ListJobAnalysisTasksResponse;
import com.baigon.occupation.ListJobSkillResolutionTasksRequest;
import com.baigon.occupation.ListJobSkillResolutionTasksResponse;
import com.baigon.occupation.ListJobSkillResolutionSimilarSkillsResponse;
import com.baigon.occupation.ListJobsRequest;
import com.baigon.occupation.ListJobsResponse;
import com.baigon.occupation.ListSkillsRequest;
import com.baigon.occupation.ListSkillsResponse;
import com.baigon.occupation.LookupSkillsRequest;
import com.baigon.occupation.LookupSkillsResponse;
import com.baigon.occupation.OccupationServiceGrpc;
import com.baigon.occupation.ReviewJobAnalysisTaskRequest;
import com.baigon.occupation.ReviewJobSkillResolutionTaskRequest;
import com.baigon.occupation.SkillData;
import com.baigon.occupation.SkillDetailData;
import com.baigon.occupation.SkillGraphEvidenceJob;
import com.baigon.occupation.SkillGraphNode;
import com.baigon.occupation.SkillGraphParent;
import com.baigon.occupation.SkillGraphScope;
import com.baigon.occupation.SkillGraphTimeline;
import com.baigon.occupation.SkillLookupData;
import com.baigon.occupation.SkillRelationMutationRequest;
import com.baigon.occupation.SkillRelationMutationResponse;
import com.baigon.occupation.entity.TaskStatus;
import com.baigon.occupation.entity.Log;
import com.baigon.occupation.entity.job.Job;
import com.baigon.occupation.entity.job.JobSkill;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisReviewAction;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
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
import java.util.List;
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
                    .addAllItems(page.getContent().stream().map(this::auditLogItem).toList())
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
            Page<JobAnalysisQueryService.JobAnalysisTaskView> page = jobAnalysisQueryService.list(
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
    public void listSkills(ListSkillsRequest request,
                           StreamObserver<ListSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            Page<Skill> page = skillResolutionQueryService.listSkills(
                    request.getPage(), request.getPageSize(), request.getKeyword());
            respond(observer, ListSkillsResponse.newBuilder()
                    .addAllItems(page.getContent().stream().map(this::skillData).toList())
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
            var detail = skillHierarchyService.getDetail(request.getId());
            if (detail.isEmpty()) {
                throw new ApiException(ApiException.ErrorCode.NOT_FOUND, "skill not found");
            }
            respond(observer, GetSkillResponse.newBuilder()
                    .setSkill(skillDetailData(detail.get()))
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
            List<Skill> skills = skillHierarchyService.lookupSkills(request.getSkillIdsList());
            respond(observer, LookupSkillsResponse.newBuilder()
                    .addAllItems(skills.stream().map(skill -> SkillLookupData.newBuilder()
                            .setId(skill.getId())
                            .setName(orEmpty(skill.getName()))
                            .build()).toList())
                    .build());
            logService.info(audit, "lookup canonical skills: total=" + skills.size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "lookup canonical skills failed");
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
                    request.getFromMonth(), request.getToMonth(), request.getEvidenceLimit());
            respond(observer, skillGraphResponse(graph));
            logService.info(audit,
                    "get skill graph: scope_type=" + graph.scope().type()
                            + ", scope_id=" + graph.scope().id()
                            + ", skills=" + graph.skills().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get skill graph failed");
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
            Page<SkillResolutionQueryService.ResolutionTaskListItem> page =
                    skillResolutionQueryService.listTasks(
                            request.getPage(), request.getPageSize(),
                            request.getTaskStatus(), request.getReviewStatus());
            respond(observer, ListJobSkillResolutionTasksResponse.newBuilder()
                    .addAllItems(page.getContent().stream()
                            .map(item -> skillResolutionSummary(item.task(), item.jobId()))
                            .toList())
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
                        .setSkillName(orEmpty(candidate.getName()))
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
            StreamObserver<GetJobSkillResolutionTaskResponse> observer) {
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
            SkillResolutionQueryService.Detail detail = skillResolutionQueryService
                    .getDetail(request.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "reviewed job skill resolution task not found"));
            respond(observer, GetJobSkillResolutionTaskResponse.newBuilder()
                    .setResolution(skillResolutionDetail(detail))
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
            if (detail.get().major() != null) {
                response.setMajor(jobMajorData(detail.get().major()));
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

    private JobAnalysisTaskSummary jobAnalysisSummary(
            JobAnalysisQueryService.JobAnalysisTaskView summary) {
        JobAnalysisTask task = summary.task();
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
                .setJobMajor(orEmpty(task.getJobMajor()))
                .setSelectedMajorId(task.getSelectedMajorId() == null ? 0 : task.getSelectedMajorId())
                .setMajorAnalysisStatus(task.getMajorAnalysisStatus() == null
                        ? "" : task.getMajorAnalysisStatus().name())
                .setSelectedOccupationName(orEmpty(summary.selectedOccupationName()))
                .setSelectedMajorName(orEmpty(summary.selectedMajorName()))
                .build();
    }

    private JobAnalysisTaskDetail jobAnalysisDetail(JobAnalysisQueryService.JobAnalysisDetail detail) {
        return JobAnalysisTaskDetail.newBuilder()
                .setTask(jobAnalysisSummary(detail.summary()))
                .addAllCandidates(detail.candidates().stream().map(candidate ->
                        JobAnalysisCandidate.newBuilder()
                                .setOccupationId(candidate.getOccupationId())
                                .setOccupationName(orEmpty(candidate.getOccupationName()))
                                .setRank(candidate.getRank())
                                .setSimilarity(candidate.getSimilarity())
                                .build()).toList())
                .addAllMajorCandidates(detail.majorCandidates().stream().map(candidate ->
                        JobAnalysisMajorCandidate.newBuilder()
                                .setMajorId(candidate.getMajorId())
                                .setMajorName(orEmpty(candidate.getMajorName()))
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

    private SkillData skillData(Skill skill) {
        return SkillData.newBuilder()
                .setId(skill.getId())
                .setName(orEmpty(skill.getName()))
                .setIsEmbed(skill.getEmbeddingStatus() == TaskStatus.SUCCESS)
                .build();
    }

    private SkillDetailData skillDetailData(SkillHierarchyService.SkillDetail detail) {
        return SkillDetailData.newBuilder()
                .setSkill(skillData(detail.skill()))
                .addAllParentSkillIds(detail.relations().parentSkillIds())
                .addAllChildSkillIds(detail.relations().childSkillIds())
                .build();
    }

    private GetSkillGraphResponse skillGraphResponse(
            SkillGraphQueryService.SkillGraph graph) {
        SkillGraphScope scope = SkillGraphScope.newBuilder()
                .setType(graph.scope().type())
                .setId(graph.scope().id())
                .setCode(orEmpty(graph.scope().code()))
                .setName(orEmpty(graph.scope().name()))
                .build();
        SkillGraphTimeline timeline = SkillGraphTimeline.newBuilder()
                .setFromMonth(graph.timeline().fromMonth())
                .setToMonth(graph.timeline().toMonth())
                .setTimezone(graph.timeline().timezone())
                .build();
        return GetSkillGraphResponse.newBuilder()
                .setScope(scope)
                .setTimeline(timeline)
                .setTotalJobCount(graph.totalJobCount())
                .addAllSkills(graph.skills().stream().map(node ->
                        SkillGraphNode.newBuilder()
                                .setSkillId(node.id())
                                .setSkillName(orEmpty(node.name()))
                                .setJobCount(node.jobCount())
                                .setCoverage(node.coverage())
                                .addAllParents(node.parents().stream().map(parent ->
                                        SkillGraphParent.newBuilder()
                                                .setId(parent.id())
                                                .setName(orEmpty(parent.name()))
                                                .build()).toList())
                                .addAllEvidenceJobs(node.evidenceJobs().stream().map(evidence ->
                                        SkillGraphEvidenceJob.newBuilder()
                                                .setJobId(evidence.jobId())
                                                .setJobName(orEmpty(evidence.jobName()))
                                                .setCompanyName(orEmpty(evidence.companyName()))
                                                .setSourcePlatform(orEmpty(evidence.sourcePlatform()))
                                                .setSourceUrl(orEmpty(evidence.sourceUrl()))
                                                .setPublishDate(time(evidence.publishDate()))
                                                .build()).toList())
                                .build()).toList())
                .build();
    }

    private JobSkillResolutionTaskSummary skillResolutionSummary(
            JobSkillResolutionTask task,
            Long jobId) {
        return JobSkillResolutionTaskSummary.newBuilder()
                .setId(task.getId())
                .setJobSkillId(task.getJobSkillId())
                .setJobId(jobId == null ? 0 : jobId)
                .setTraceId(task.getTraceId() == null ? 0 : task.getTraceId())
                .setSkillName(orEmpty(task.getSkillName()))
                .setTaskStatus(task.getTaskStatus() == null ? "" : task.getTaskStatus().name())
                .setReviewStatus(task.getReviewStatus() == null ? "" : task.getReviewStatus().name())
                .setResolutionAction(task.getResolutionAction() == null
                        ? "" : task.getResolutionAction().name())
                .setSelectedSkillId(task.getSelectedSkillId() == null
                        ? 0 : task.getSelectedSkillId())
                .setModelName(orEmpty(task.getModelName()))
                .setErrorMsg(orEmpty(task.getErrorMsg()))
                .setAttempts(task.getAttempts() == null ? 0 : task.getAttempts())
                .setCreatedAt(time(task.getCreatedAt()))
                .setReviewedAt(time(task.getReviewedAt()))
                .setReviewedBy(task.getReviewedBy() == null ? 0 : task.getReviewedBy())
                .build();
    }

    private JobSkillResolutionTaskDetail skillResolutionDetail(
            SkillResolutionQueryService.Detail detail) {
        return JobSkillResolutionTaskDetail.newBuilder()
                .setTask(skillResolutionSummary(
                        detail.task(), detail.jobSkill().getJobId()))
                .setJobSkill(jobSkillData(detail.jobSkill()))
                .addAllCandidates(detail.candidates().stream().map(candidate ->
                        com.baigon.occupation.JobSkillResolutionCandidate.newBuilder()
                                .setSkillId(candidate.getSkillId())
                                .setSkillName(orEmpty(candidate.getSkillName()))
                                .setRank(candidate.getRank() == null ? 0 : candidate.getRank())
                                .setSimilarity(candidate.getSimilarity() == null
                                        ? 0 : candidate.getSimilarity())
                                .build()).toList())
                .build();
    }

    private JobData jobData(Job job) {
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
                .build();
    }

    private JobMajorData jobMajorData(Major major) {
        return JobMajorData.newBuilder()
                .setId(major.getId())
                .setCode(orEmpty(major.getCode()))
                .setName(orEmpty(major.getName()))
                .setMajorCategoryId(major.getMajorCategoryId())
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
        return jobSkillData(skill, List.of(), List.of());
    }

    private JobSkillData jobSkillData(JobQueryService.JobSkillDetail detail) {
        return jobSkillData(
                detail.skill(), detail.parentSkillIds(), detail.childSkillIds());
    }

    private JobSkillData jobSkillData(JobSkill skill,
                                      List<Long> parentSkillIds,
                                      List<Long> childSkillIds) {
        return JobSkillData.newBuilder()
                .setId(skill.getId())
                .setSkillId(skill.getSkillId() == null ? 0 : skill.getSkillId())
                .setSkillName(orEmpty(skill.getSkillName()))
                .setSkillProficiency(orEmpty(skill.getSkillProficiency()))
                .setEvidence(orEmpty(skill.getEvidence()))
                .addAllParentSkillIds(parentSkillIds)
                .addAllChildSkillIds(childSkillIds)
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
