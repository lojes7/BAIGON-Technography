// 百工谱 — gRPC 业务错误码传递测试

package com.baigon.occupation.service.datasource;

import com.baigon.occupation.error.ApiException;
import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ApiExceptionTest {

    @Test
    void alreadyReviewedShouldUseFailedPreconditionAnd40301Trailer() {
        ApiException exception = new ApiException(
                ApiException.ErrorCode.ALREADY_REVIEWED, "already reviewed");

        StatusRuntimeException grpcException = exception.asGrpcException();
        Metadata.Key<String> errorCodeKey = Metadata.Key.of(
                ApiException.ERROR_CODE_TRAILER, Metadata.ASCII_STRING_MARSHALLER);

        assertEquals(Status.Code.FAILED_PRECONDITION, grpcException.getStatus().getCode());
        assertNotNull(grpcException.getTrailers());
        assertEquals("40301", grpcException.getTrailers().get(errorCodeKey));
    }
}
