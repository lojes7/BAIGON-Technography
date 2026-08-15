// 百工谱 — UserService gRPC 契约测试
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.occupation.service.user.admin.AdminUserService;
import com.baigon.user.ListUsersRequest;
import com.baigon.user.ListUsersResponse;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import com.baigon.user.OrganizationListRequest;
import com.baigon.user.OrganizationListResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserGrpcServiceTest {

    private AuthService authService;
    private AdminUserService adminUserService;
    private LogService logService;
    private UserGrpcService service;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        adminUserService = mock(AdminUserService.class);
        logService = mock(LogService.class);
        service = new UserGrpcService(authService, adminUserService, logService);
    }

    @Test
    void loginShouldPreserveResponseContract() {
        when(authService.login("admin", "123456")).thenReturn(
                new AuthService.AuthResult(7L, "admin", "管理员", "ADMIN", "jwt-token"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<LoginResponse> response = ArgumentCaptor.forClass(LoginResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        verify(observer, never()).onError(any());
        assertEquals("jwt-token", response.getValue().getToken());
        assertEquals(7L, response.getValue().getUserId());
        assertEquals("admin", response.getValue().getUid());
        assertEquals("管理员", response.getValue().getName());
        assertEquals("ADMIN", response.getValue().getRole());
        verify(logService).info(any(), eq("login success"));
    }

    @Test
    void loginShouldMapAuthFailureToUnauthenticated() {
        when(authService.login("admin", "123456"))
                .thenThrow(new AuthService.AuthException(401, "uid or password error"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        verify(observer, never()).onCompleted();
        assertEquals(Status.Code.UNAUTHENTICATED,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("uid or password error"), eq("login failed"));
    }

    @Test
    void loginShouldMapLockedUserToPermissionDenied() {
        when(authService.login("admin", "123456"))
                .thenThrow(new AuthService.AuthException(403, "your are locked!"));
        @SuppressWarnings("unchecked")
        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);

        service.login(request(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.PERMISSION_DENIED,
                Status.fromThrowable(error.getValue()).getCode());
    }

    @Test
    void listUsersShouldReturnBaseFieldsAndPagination() {
        var summary = new AdminUserService.UserSummary(
                8L, "student01", "张三", "STUDENT", "NORMAL");
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listUsers(eq(0), eq(20), any()))
                .thenReturn(new PageImpl<>(List.of(summary)));
        @SuppressWarnings("unchecked")
        StreamObserver<ListUsersResponse> observer = mock(StreamObserver.class);

        service.listUsers(ListUsersRequest.newBuilder()
                .setPage(0)
                .setPageSize(20)
                .setName("张")
                .setUniversityId(1L)
                .setSchoolId(2L)
                .setDepartmentId(3L)
                .setUserId(1L)
                .setUserName("admin")
                .setRequestMethod("POST")
                .setRequestUrl("/api/auth/users")
                .build(), observer);

        ArgumentCaptor<ListUsersResponse> response = ArgumentCaptor.forClass(ListUsersResponse.class);
        verify(observer).onNext(response.capture());
        verify(observer).onCompleted();
        assertEquals(1, response.getValue().getItemsCount());
        assertEquals("student01", response.getValue().getItems(0).getUid());
        assertEquals(20, response.getValue().getPageSize());
        verify(logService).info(any(), eq("list users: total=1"));
    }

    @Test
    void listUsersShouldMapInvalidFilterToInvalidArgument() {
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listUsers(eq(0), eq(20), any()))
                .thenThrow(new IllegalArgumentException("invalid role"));
        @SuppressWarnings("unchecked")
        StreamObserver<ListUsersResponse> observer = mock(StreamObserver.class);

        service.listUsers(ListUsersRequest.newBuilder()
                .setPageSize(20)
                .setRole("ROOT")
                .build(), observer);

        ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(error.capture());
        assertEquals(Status.Code.INVALID_ARGUMENT,
                Status.fromThrowable(error.getValue()).getCode());
        verify(logService).error(any(), eq("invalid role"), eq("list users failed"));
    }

    @Test
    void listSchoolsShouldForwardOptionalParentAndReturnCatalog() {
        var school = new AdminUserService.OrganizationSummary(2L, "计算机信息工程学院");
        when(adminUserService.normalizedPageSize(20)).thenReturn(20);
        when(adminUserService.listSchools(1L, 0, 20, "计算机"))
                .thenReturn(new PageImpl<>(List.of(school)));
        @SuppressWarnings("unchecked")
        StreamObserver<OrganizationListResponse> observer = mock(StreamObserver.class);

        service.listSchools(OrganizationListRequest.newBuilder()
                .setPageSize(20)
                .setParentId(1L)
                .setKeyword("计算机")
                .build(), observer);

        ArgumentCaptor<OrganizationListResponse> response =
                ArgumentCaptor.forClass(OrganizationListResponse.class);
        verify(observer).onNext(response.capture());
        assertEquals(1, response.getValue().getItemsCount());
        assertEquals("计算机信息工程学院", response.getValue().getItems(0).getName());
        verify(logService).info(any(), eq("list schools: total=1"));
    }

    private LoginRequest request() {
        return LoginRequest.newBuilder()
                .setUid("admin")
                .setPassword("123456")
                .build();
    }
}
