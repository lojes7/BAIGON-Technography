// 百工谱 — UserService gRPC 实现
package com.baigon.occupation.grpc.service.user;

import com.baigon.occupation.service.AuditContext;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.user.AuthService;
import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
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
    private final LogService logService;

    public UserGrpcService(AuthService authService, LogService logService) {
        this.authService = authService;
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
}
