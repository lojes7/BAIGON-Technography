// 百工谱 — data-source 统一错误定义
// 标准错误码默认与 HTTP 状态码一致；业务错误可使用独立响应码。

package com.baigon.datasource.error;

import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;

/**
 * data-source 服务统一业务异常。
 *
 * <p>gRPC 状态负责表达错误类别，响应码通过 trailer 传给 gateway，
 * gateway 最终仍使用统一的 {@code response.Error(httpCode, errorCode)} 输出。</p>
 */
public class ApiException extends RuntimeException {

    /** gateway 与后端约定的业务错误码 trailer。 */
    public static final String ERROR_CODE_TRAILER = "baigon-error-code";

    private static final Metadata.Key<String> ERROR_CODE_KEY = Metadata.Key.of(
            ERROR_CODE_TRAILER, Metadata.ASCII_STRING_MARSHALLER);

    /** 所有标准错误码与业务错误码集中定义在此处。 */
    public enum ErrorCode {
        BAD_REQUEST(400, Status.Code.INVALID_ARGUMENT),
        UNAUTHORIZED(401, Status.Code.UNAUTHENTICATED),
        FORBIDDEN(403, Status.Code.PERMISSION_DENIED),
        NOT_FOUND(404, Status.Code.NOT_FOUND),
        INTERNAL_ERROR(500, Status.Code.INTERNAL),
        SERVICE_UNAVAILABLE(503, Status.Code.UNAVAILABLE),
        ALREADY_REVIEWED(40301, Status.Code.FAILED_PRECONDITION);

        private final int responseCode;
        private final Status.Code grpcCode;

        ErrorCode(int responseCode, Status.Code grpcCode) {
            this.responseCode = responseCode;
            this.grpcCode = grpcCode;
        }

        public int getResponseCode() {
            return responseCode;
        }

        public Status.Code getGrpcCode() {
            return grpcCode;
        }
    }

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    /** 转成携带业务错误码 trailer 的 gRPC 异常。 */
    public StatusRuntimeException asGrpcException() {
        return grpcException(errorCode, getMessage());
    }

    /** gRPC 层直接返回标准错误时使用同一套集中定义。 */
    public static StatusRuntimeException grpcException(ErrorCode errorCode, String description) {
        Metadata trailers = new Metadata();
        trailers.put(ERROR_CODE_KEY, String.valueOf(errorCode.getResponseCode()));
        return Status.fromCode(errorCode.getGrpcCode())
                .withDescription(description)
                .asRuntimeException(trailers);
    }
}
