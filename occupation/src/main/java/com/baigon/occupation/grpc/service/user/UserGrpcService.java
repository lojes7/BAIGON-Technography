// 百工谱 — UserService gRPC 实现
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.occupation.service.user.UserService;
import com.baigon.occupation.service.user.admin.AdminUserService;
import com.baigon.occupation.service.user.analysis.UserAnalysisService;
import com.baigon.occupation.service.user.resume.ResumeService;
import com.baigon.user.AnalyzeMyResumeSkillsRequest;
import com.baigon.user.AnalyzeMyResumeSkillsResponse;
import com.baigon.user.BlockUserRequest;
import com.baigon.user.BlockUserResponse;
import com.baigon.user.CompleteResumeUploadRequest;
import com.baigon.user.CompleteResumeUploadResponse;
import com.baigon.user.CreateResumeUploadRequest;
import com.baigon.user.CreateResumeUploadResponse;
import com.baigon.user.EditMyResumeRequest;
import com.baigon.user.EditMyResumeResponse;
import com.baigon.user.GetLatestMyJobMatchRequest;
import com.baigon.user.GetUserRequest;
import com.baigon.user.GetUserResponse;
import com.baigon.user.ListUsersRequest;
import com.baigon.user.ListUsersResponse;
import com.baigon.user.ListMySkillsRequest;
import com.baigon.user.ListMySkillsResponse;
import com.baigon.user.GetMyResumeRequest;
import com.baigon.user.GetMyResumeResponse;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import com.baigon.user.OrganizationData;
import com.baigon.user.OrganizationListRequest;
import com.baigon.user.OrganizationListResponse;
import com.baigon.user.MatchMyResumeToJobRequest;
import com.baigon.user.MatchMyResumeToJobResponse;
import com.baigon.user.ResumeData;
import com.baigon.user.SkillLearningSuggestion;
import com.baigon.user.UnlockUserRequest;
import com.baigon.user.UnlockUserResponse;
import com.baigon.user.UserData;
import com.baigon.user.UserSkillData;
import com.baigon.user.UserServiceGrpc;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(UserGrpcService.class);

    private final AuthService authService;
    private final UserService userService;
    private final AdminUserService adminUserService;
    private final ResumeService resumeService;
    private final UserAnalysisService userAnalysisService;
    private final LogService logService;

    public UserGrpcService(AuthService authService,
                           UserService userService,
                           AdminUserService adminUserService,
                           ResumeService resumeService,
                           UserAnalysisService userAnalysisService,
                           LogService logService) {
        this.authService = authService;
        this.userService = userService;
        this.adminUserService = adminUserService;
        this.resumeService = resumeService;
        this.userAnalysisService = userAnalysisService;
        this.logService = logService;
        logger.info("UserGrpcService 初始化完成");
    }

    /** 登录接口保持既有 protobuf 契约不变。 */
    @Override
    public void login(LoginRequest request, StreamObserver<LoginResponse> responseObserver) {
        AuditContext audit = AuditContext.from(
                (Long) null, 0L, request.getUid(), "", "", "/api/login");
        try {
            AuthService.AuthResult result = authService.login(
                    request.getUid(), request.getPassword());
            logService.info(audit, "login success");
            responseObserver.onNext(LoginResponse.newBuilder()
                    .setToken(result.token())
                    .setUserId(result.userId())
                    .setUid(result.uid())
                    .setName(result.name())
                    .setRole(result.role())
                    .build());
            responseObserver.onCompleted();
        } catch (AuthService.AuthException exception) {
            logService.error(audit, exception.getMessage(), "login failed");
            Status status = switch (exception.getStatus()) {
                case 401 -> Status.UNAUTHENTICATED;
                case 403 -> Status.PERMISSION_DENIED;
                default -> Status.INTERNAL;
            };
            responseObserver.onError(status.withDescription(exception.getMessage())
                    .asRuntimeException());
        } catch (Exception exception) {
            logger.error("登录处理异常", exception);
            logService.error(audit, exception.getMessage(), "login failed");
            responseObserver.onError(Status.INTERNAL.withDescription("server error")
                    .asRuntimeException());
        }
    }

    @Override
    public void listUsers(ListUsersRequest request, StreamObserver<ListUsersResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            int pageSize = adminUserService.normalizedPageSize(request.getPageSize());
            var page = adminUserService.listUsers(
                    request.getPage(), pageSize,
                    new AdminUserService.UserSearchCriteria(
                            request.getName(), request.getRole(), request.getUniversityId(),
                            request.getSchoolId(), request.getDepartmentId()));
            ListUsersResponse response = ListUsersResponse.newBuilder()
                    .addAllItems(page.getContent().stream().map(this::userData).toList())
                    .setTotal(page.getTotalElements())
                    .setPage(request.getPage())
                    .setPageSize(pageSize)
                    .build();
            respond(observer, response);
            logService.info(audit, "list users: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list users failed");
        }
    }

    @Override
    public void getUser(GetUserRequest request,
                        StreamObserver<GetUserResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var user = userService.getUser(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "user not found"));
            respond(observer, GetUserResponse.newBuilder()
                    .setUser(userData(user))
                    .build());
            logService.info(audit, "get user: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get user failed");
        }
    }

    @Override
    public void blockUser(BlockUserRequest request,
                          StreamObserver<BlockUserResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var user = adminUserService.blockUser(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "user not found"));
            respond(observer, BlockUserResponse.newBuilder()
                    .setUser(userData(user))
                    .build());
            logService.info(audit, "block user: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "block user failed");
        }
    }

    @Override
    public void unlockUser(UnlockUserRequest request,
                           StreamObserver<UnlockUserResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var user = adminUserService.unlockUser(request.getId())
                    .orElseThrow(() -> new ApiException(
                            ApiException.ErrorCode.NOT_FOUND, "user not found"));
            respond(observer, UnlockUserResponse.newBuilder()
                    .setUser(userData(user))
                    .build());
            logService.info(audit, "unlock user: id=" + request.getId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "unlock user failed");
        }
    }

    @Override
    public void listUniversities(OrganizationListRequest request,
                                 StreamObserver<OrganizationListResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            int pageSize = adminUserService.normalizedPageSize(request.getPageSize());
            var page = adminUserService.listUniversities(
                    request.getPage(), pageSize, request.getKeyword());
            respond(observer, organizationResponse(page.getContent().stream()
                    .map(this::organizationData).toList(), page.getTotalElements(),
                    request.getPage(), pageSize));
            logService.info(audit, "list universities: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list universities failed");
        }
    }

    @Override
    public void listSchools(OrganizationListRequest request,
                            StreamObserver<OrganizationListResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            int pageSize = adminUserService.normalizedPageSize(request.getPageSize());
            var page = adminUserService.listSchools(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, organizationResponse(page.getContent().stream()
                    .map(this::organizationData).toList(), page.getTotalElements(),
                    request.getPage(), pageSize));
            logService.info(audit, "list schools: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list schools failed");
        }
    }

    @Override
    public void listDepartments(OrganizationListRequest request,
                                StreamObserver<OrganizationListResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            int pageSize = adminUserService.normalizedPageSize(request.getPageSize());
            var page = adminUserService.listDepartments(
                    request.getParentId(), request.getPage(), pageSize, request.getKeyword());
            respond(observer, organizationResponse(page.getContent().stream()
                    .map(this::organizationData).toList(), page.getTotalElements(),
                    request.getPage(), pageSize));
            logService.info(audit, "list departments: total=" + page.getTotalElements());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list departments failed");
        }
    }

    @Override
    public void createResumeUpload(CreateResumeUploadRequest request,
                                   StreamObserver<CreateResumeUploadResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            ResumeService.ResumeUploadData upload = resumeService.createUpload(
                    request.getUserId(),
                    request.getFileName(),
                    request.getFileSize());
            respond(observer, CreateResumeUploadResponse.newBuilder()
                    .setUploadId(upload.uploadId())
                    .setUploadUrl(upload.uploadUrl())
                    .setMethod(upload.method())
                    .setContentType(upload.contentType())
                    .setExpiresAt(upload.expiresAt().toString())
                    .build());
            logService.info(audit, "create resume upload: id=" + upload.uploadId());
        } catch (Exception exception) {
            fail(observer, audit, exception, "create resume upload failed");
        }
    }

    @Override
    public void completeResumeUpload(CompleteResumeUploadRequest request,
                                     StreamObserver<CompleteResumeUploadResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            ResumeService.ResumeData resume = resumeService.completeUpload(
                    request.getUserId(), request.getUploadId(), request.getFileName(), audit);
            respond(observer, CompleteResumeUploadResponse.newBuilder()
                    .setResume(resumeData(resume))
                    .build());
            logService.info(audit,
                    "complete resume upload and analyze content: id=" + resume.id());
        } catch (Exception exception) {
            fail(observer, audit, exception, "complete resume upload failed");
        }
    }

    @Override
    public void getMyResume(GetMyResumeRequest request,
                            StreamObserver<GetMyResumeResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var resume = resumeService.getMyResume(request.getUserId());
            GetMyResumeResponse.Builder builder = GetMyResumeResponse.newBuilder();
            resume.ifPresent(data -> builder.setResume(resumeData(data)));
            respond(observer, builder.build());
            logService.info(audit, "get my resume: present=" + resume.isPresent());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get my resume failed");
        }
    }

    @Override
    public void editMyResume(EditMyResumeRequest request,
                             StreamObserver<EditMyResumeResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            ResumeService.ResumeData resume = resumeService.editMyResume(
                    request.getUserId(),
                    request.hasContent() ? request.getContent() : null,
                    request.getFieldsJson());
            respond(observer, EditMyResumeResponse.newBuilder()
                    .setResume(resumeData(resume))
                    .build());
            logService.info(audit, "edit my resume: id=" + resume.id());
        } catch (Exception exception) {
            fail(observer, audit, exception, "edit my resume failed");
        }
    }

    @Override
    public void analyzeMyResumeSkills(
            AnalyzeMyResumeSkillsRequest request,
            StreamObserver<AnalyzeMyResumeSkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            UserAnalysisService.SkillAnalysisData result =
                    userAnalysisService.analyzeMyResumeSkills(request.getUserId(), audit);
            respond(observer, AnalyzeMyResumeSkillsResponse.newBuilder()
                    .setResumeId(result.resumeId())
                    .addAllSkills(result.skills().stream().map(this::userSkillData).toList())
                    .build());
            logService.info(audit, "analyze my resume skills: resume_id=" + result.resumeId()
                    + ", skills=" + result.skills().size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "analyze my resume skills failed");
        }
    }

    @Override
    public void listMySkills(
            ListMySkillsRequest request,
            StreamObserver<ListMySkillsResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            var items = userAnalysisService.listMySkills(request.getUserId());
            respond(observer, ListMySkillsResponse.newBuilder()
                    .addAllItems(items.stream().map(this::userSkillData).toList())
                    .build());
            logService.info(audit, "list my skills: total=" + items.size());
        } catch (Exception exception) {
            fail(observer, audit, exception, "list my skills failed");
        }
    }

    @Override
    public void matchMyResumeToJob(
            MatchMyResumeToJobRequest request,
            StreamObserver<MatchMyResumeToJobResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            UserAnalysisService.JobMatchData result = userAnalysisService.matchMyResumeToJob(
                    request.getUserId(), request.getJobId(), audit);
            respond(observer, jobMatchResponse(result));
            logService.info(audit, "match my resume to job: resume_id=" + result.resumeId()
                    + ", job_id=" + result.jobId() + ", score=" + result.score());
        } catch (Exception exception) {
            fail(observer, audit, exception, "match my resume to job failed");
        }
    }

    @Override
    public void getLatestMyJobMatch(
            GetLatestMyJobMatchRequest request,
            StreamObserver<MatchMyResumeToJobResponse> observer) {
        AuditContext audit = AuditContext.from(
                request.getTraceId(), request.getUserId(), request.getUserName(), request.getUserIp(),
                request.getRequestMethod(), request.getRequestUrl());
        try {
            UserAnalysisService.JobMatchData result = userAnalysisService.getLatestMyJobMatch(
                    request.getUserId(), request.getJobId());
            respond(observer, jobMatchResponse(result));
            logService.info(audit, "get latest my job match: job_id=" + result.jobId()
                    + ", result_id=" + result.id());
        } catch (Exception exception) {
            fail(observer, audit, exception, "get latest my job match failed");
        }
    }

    /** 两个人岗匹配 RPC 共享同一份公开响应映射，避免字段契约产生偏差。 */
    private MatchMyResumeToJobResponse jobMatchResponse(
            UserAnalysisService.JobMatchData result) {
        return MatchMyResumeToJobResponse.newBuilder()
                .setId(result.id())
                .setResumeId(result.resumeId())
                .setJobId(result.jobId())
                .setScore(result.score())
                .setSummary(result.summary())
                .addAllSkillsToLearn(result.skillsToLearn().stream()
                        .map(item -> SkillLearningSuggestion.newBuilder()
                                .setSkillName(item.skillName())
                                .setReason(item.reason())
                                .setSuggestion(item.suggestion())
                                .build())
                        .toList())
                .addAllActionSuggestions(result.actionSuggestions())
                .setCreatedAt(result.createdAt() == null ? "" : result.createdAt().toString())
                .build();
    }

    private UserData userData(AdminUserService.UserData user) {
        return UserData.newBuilder()
                .setId(user.id())
                .setUid(orEmpty(user.uid()))
                .setName(orEmpty(user.name()))
                .setRole(orEmpty(user.role()))
                .setStatus(orEmpty(user.status()))
                .setUniversityId(orZero(user.universityId()))
                .setSchoolId(orZero(user.schoolId()))
                .setDepartmentId(orZero(user.departmentId()))
                .setUniversityName(orEmpty(user.universityName()))
                .setSchoolName(orEmpty(user.schoolName()))
                .setDepartmentName(orEmpty(user.departmentName()))
                .build();
    }

    private UserData userData(UserService.UserData user) {
        return UserData.newBuilder()
                .setId(user.id())
                .setUid(orEmpty(user.uid()))
                .setName(orEmpty(user.name()))
                .setRole(user.role().name())
                .setStatus(user.status().name())
                .setUniversityId(orZero(user.universityId()))
                .setSchoolId(orZero(user.schoolId()))
                .setDepartmentId(orZero(user.departmentId()))
                .setUniversityName(orEmpty(user.universityName()))
                .setSchoolName(orEmpty(user.schoolName()))
                .setDepartmentName(orEmpty(user.departmentName()))
                .build();
    }

    private OrganizationData organizationData(AdminUserService.OrganizationSummary item) {
        return OrganizationData.newBuilder()
                .setId(item.id())
                .setName(orEmpty(item.name()))
                .build();
    }

    private ResumeData resumeData(ResumeService.ResumeData resume) {
        ResumeData.Builder builder = ResumeData.newBuilder()
                .setId(resume.id())
                .setCreatedAt(resume.createdAt() == null ? "" : resume.createdAt().toString())
                .setFieldsJson(resume.fieldsJson())
                .setSource(resume.source().name());
        if (resume.fileName() != null) {
            builder.setFileName(resume.fileName());
        }
        if (resume.fileSize() != null) {
            builder.setFileSize(resume.fileSize());
        }
        if (resume.content() != null) {
            builder.setContent(resume.content());
        }
        return builder.build();
    }

    private UserSkillData userSkillData(UserAnalysisService.UserSkillData skill) {
        return UserSkillData.newBuilder()
                .setId(skill.id())
                .setResumeId(skill.resumeId())
                .setSkillName(orEmpty(skill.skillName()))
                .setProficiency(orEmpty(skill.proficiency()))
                .setEvidence(orEmpty(skill.evidence()))
                .setCreatedAt(skill.createdAt() == null ? "" : skill.createdAt().toString())
                .build();
    }

    private OrganizationListResponse organizationResponse(
            java.util.List<OrganizationData> items,
            long total,
            int page,
            int pageSize) {
        return OrganizationListResponse.newBuilder()
                .addAllItems(items)
                .setTotal(total)
                .setPage(page)
                .setPageSize(pageSize)
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
            observer.onError(ApiException.grpcException(
                    ApiException.ErrorCode.BAD_REQUEST, exception.getMessage()));
        } else {
            observer.onError(ApiException.grpcException(
                    ApiException.ErrorCode.INTERNAL_ERROR, "server error"));
        }
    }

    private String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private long orZero(Long value) {
        return value == null ? 0L : value;
    }
}
