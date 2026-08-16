// 百工谱 — UserService gRPC 实现
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.error.ApiException;
import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.occupation.service.user.UserService;
import com.baigon.occupation.service.user.admin.AdminUserService;
import com.baigon.user.BlockUserRequest;
import com.baigon.user.BlockUserResponse;
import com.baigon.user.GetUserRequest;
import com.baigon.user.GetUserResponse;
import com.baigon.user.ListUsersRequest;
import com.baigon.user.ListUsersResponse;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import com.baigon.user.OrganizationData;
import com.baigon.user.OrganizationListRequest;
import com.baigon.user.OrganizationListResponse;
import com.baigon.user.UserData;
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
    private final LogService logService;

    public UserGrpcService(AuthService authService,
                           UserService userService,
                           AdminUserService adminUserService,
                           LogService logService) {
        this.authService = authService;
        this.userService = userService;
        this.adminUserService = adminUserService;
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

    private UserData userData(AdminUserService.UserSummary user) {
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
