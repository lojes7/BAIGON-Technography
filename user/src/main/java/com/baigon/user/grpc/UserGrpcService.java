// 百工谱 — UserService gRPC 实现
// user 服务不暴露 HTTP 业务接口，所有业务通过 gRPC 提供

package com.baigon.user.grpc;

import com.baigon.user.LoginRequest;
import com.baigon.user.LoginResponse;
import com.baigon.user.UserServiceGrpc;
import com.baigon.user.service.AuthService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(UserGrpcService.class);

    private final AuthService authService;

    public UserGrpcService(AuthService authService) {
        this.authService = authService;
        log.info("UserGrpcService 初始化完成");
    }

    /** 登录：校验账号密码，签发 JWT */
    @Override
    public void login(LoginRequest request, StreamObserver<LoginResponse> responseObserver) {
        try {
            AuthService.AuthResult result = authService.login(request.getUid(), request.getPassword());
            responseObserver.onNext(LoginResponse.newBuilder()
                    .setToken(result.token())
                    .setUserId(result.userId())
                    .setUid(result.uid())
                    .setName(result.name())
                    .setRole(result.role())
                    .build());
            responseObserver.onCompleted();
        } catch (AuthService.AuthException e) {
            // 业务异常 → gRPC 状态码
            Status status = switch (e.getStatus()) {
                case 401 -> Status.UNAUTHENTICATED;
                case 403 -> Status.PERMISSION_DENIED;
                default -> Status.INTERNAL;
            };
            responseObserver.onError(status.withDescription(e.getMessage()).asRuntimeException());
        } catch (Exception e) {
            log.error("登录处理异常", e);
            responseObserver.onError(Status.INTERNAL.withDescription("server error").asRuntimeException());
        }
    }

    // TODO: 以下接口待数据库表设计确定后实现:
    // - Register()                → 用户注册
    // - GetProfile()             → 获取用户资料
    // - UpdateProfile()          → 更新用户资料
    // - UploadResume()           → 上传简历
    // - ParseResume()            → 解析简历（异步任务）
    // - MatchJob()               → 人岗匹配诊断
}
