// 百工谱 — handler 公共错误转换测试

package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestGRPCErrorCodesReturnsDynamicBusinessCode(t *testing.T) {
	trailers := metadata.Pairs(grpcErrorCodeTrailer, "40301")

	httpCode, errorCode := GRPCErrorCodes(
		status.Error(codes.FailedPrecondition, "already reviewed"), trailers)

	if httpCode != http.StatusForbidden {
		t.Fatalf("HTTP 状态码错误：got %d, want %d", httpCode, http.StatusForbidden)
	}
	if errorCode != 40301 {
		t.Fatalf("业务错误码错误：got %d, want 40301", errorCode)
	}
}

func TestGRPCErrorCodesDefaultsToHTTPCode(t *testing.T) {
	httpCode, errorCode := GRPCErrorCodes(status.Error(codes.NotFound, "not found"))

	if httpCode != http.StatusNotFound || errorCode != http.StatusNotFound {
		t.Fatalf("标准错误码映射错误：http=%d, code=%d", httpCode, errorCode)
	}
}

func TestParseCatalogPageQueryDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodGet, "/?keyword=计算机", nil)

	query, err := parseCatalogPageQuery(context)
	if err != nil {
		t.Fatalf("解析默认分页参数失败：%v", err)
	}
	if query.Page != 0 || query.PageSize != 20 || query.Keyword != "计算机" {
		t.Fatalf("默认分页参数错误：%+v", query)
	}
}

func TestEmbeddableCatalogItemsKeepsFalseField(t *testing.T) {
	items := embeddableCatalogItems([]*occupationpb.EmbeddableCatalogItem{{
		Id: 1, Code: "010101", Name: "哲学", IsEmbed: false,
	}})
	payload, err := json.Marshal(items)
	if err != nil {
		t.Fatalf("序列化目录条目失败：%v", err)
	}
	if string(payload) != `[{"code":"010101","id":1,"is_embed":false,"name":"哲学"}]` {
		t.Fatalf("is_embed=false 不应被省略：%s", payload)
	}
}
