// 百工谱 — UserService gRPC 契约测试
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserGrpcServiceTest {

    private AuthService authService;
    private LogService logService;
    private UserGrpcService service;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        logService = mock(LogService.class);
        service = new UserGrpcService(authService, logService);
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

    private LoginRequest request() {
        return LoginRequest.newBuilder()
                .setUid("admin")
                .setPassword("123456")
                .build();
    }
}
