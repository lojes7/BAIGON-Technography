// 百工谱 — occupation gRPC 统一错误定义
package com.baigon.occupation.error;

import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;

/** gRPC 状态表达 HTTP 类别，trailer 透传 gateway 最终响应码。 */
public class ApiException extends RuntimeException {

    public static final String ERROR_CODE_TRAILER = "baigon-error-code";

    private static final Metadata.Key<String> ERROR_CODE_KEY = Metadata.Key.of(
            ERROR_CODE_TRAILER, Metadata.ASCII_STRING_MARSHALLER);

    public enum ErrorCode {
        BAD_REQUEST(400, Status.Code.INVALID_ARGUMENT),
        UNAUTHORIZED(401, Status.Code.UNAUTHENTICATED),
        FORBIDDEN(403, Status.Code.PERMISSION_DENIED),
        TASK_ALREADY_RUNNING(403, Status.Code.FAILED_PRECONDITION),
        ALREADY_REVIEWED(40301, Status.Code.FAILED_PRECONDITION),
        JOB_ANALYSIS_ALREADY_REVIEWED(40302, Status.Code.FAILED_PRECONDITION),
        NOT_FOUND(404, Status.Code.NOT_FOUND),
        INTERNAL_ERROR(500, Status.Code.INTERNAL),
        SERVICE_UNAVAILABLE(503, Status.Code.UNAVAILABLE);

        private final int responseCode;
        private final Status.Code grpcCode;

        ErrorCode(int responseCode, Status.Code grpcCode) {
            this.responseCode = responseCode;
            this.grpcCode = grpcCode;
        }

        public int getResponseCode() { return responseCode; }
        public Status.Code getGrpcCode() { return grpcCode; }
    }

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public StatusRuntimeException asGrpcException() {
        return grpcException(errorCode, getMessage());
    }

    public static StatusRuntimeException grpcException(ErrorCode errorCode, String description) {
        Metadata trailers = new Metadata();
        trailers.put(ERROR_CODE_KEY, String.valueOf(errorCode.responseCode));
        return Status.fromCode(errorCode.grpcCode)
                .withDescription(description)
                .asRuntimeException(trailers);
    }
}
