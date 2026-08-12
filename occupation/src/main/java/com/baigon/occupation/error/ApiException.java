// 百工谱 — occupation gRPC 统一错误定义
package com.baigon.occupation.error;

import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;

/** gRPC 状态表达 HTTP 类别，trailer 透传 gateway 最终响应码。 */
public class ApiException extends RuntimeException {

    private static final Metadata.Key<String> ERROR_CODE_KEY = Metadata.Key.of(
            "baigon-error-code", Metadata.ASCII_STRING_MARSHALLER);

    public enum ErrorCode {
        BAD_REQUEST(400, Status.Code.INVALID_ARGUMENT),
        FORBIDDEN(403, Status.Code.PERMISSION_DENIED),
        TASK_ALREADY_RUNNING(403, Status.Code.FAILED_PRECONDITION),
        NOT_FOUND(404, Status.Code.NOT_FOUND),
        INTERNAL_ERROR(500, Status.Code.INTERNAL),
        SERVICE_UNAVAILABLE(503, Status.Code.UNAVAILABLE);

        private final int responseCode;
        private final Status.Code grpcCode;

        ErrorCode(int responseCode, Status.Code grpcCode) {
            this.responseCode = responseCode;
            this.grpcCode = grpcCode;
        }
    }

    private ApiException() {
    }

    public static StatusRuntimeException grpcException(ErrorCode errorCode, String description) {
        Metadata trailers = new Metadata();
        trailers.put(ERROR_CODE_KEY, String.valueOf(errorCode.responseCode));
        return Status.fromCode(errorCode.grpcCode)
                .withDescription(description)
                .asRuntimeException(trailers);
    }
}
