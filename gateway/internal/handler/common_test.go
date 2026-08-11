// 百工谱 — handler 公共错误转换测试

package handler

import (
	"net/http"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestGRPCErrorCodesReturnsDynamicBusinessCode(t *testing.T) {
	trailers := metadata.Pairs(grpcErrorCodeTrailer, "40301")

	httpCode, errorCode := grpcErrorCodes(
		status.Error(codes.FailedPrecondition, "already reviewed"), trailers)

	if httpCode != http.StatusForbidden {
		t.Fatalf("HTTP 状态码错误：got %d, want %d", httpCode, http.StatusForbidden)
	}
	if errorCode != 40301 {
		t.Fatalf("业务错误码错误：got %d, want 40301", errorCode)
	}
}

func TestGRPCErrorCodesDefaultsToHTTPCode(t *testing.T) {
	httpCode, errorCode := grpcErrorCodes(status.Error(codes.NotFound, "not found"))

	if httpCode != http.StatusNotFound || errorCode != http.StatusNotFound {
		t.Fatalf("标准错误码映射错误：http=%d, code=%d", httpCode, errorCode)
	}
}
