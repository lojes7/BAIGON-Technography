// 百工谱 — Gateway 公共契约映射测试
package handler

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestCanonicalSkillIDPageOnlyContainsIDsAndPagination(t *testing.T) {
	data := canonicalSkillIDPage(&occupationpb.ListSkillsResponse{
		Ids: []int64{100, 200}, Total: 3, Page: 1, PageSize: 2,
	})

	assertMapKeys(t, data, "ids", "page", "pageSize", "total")
	if !reflect.DeepEqual(data["ids"], []int64{100, 200}) {
		t.Fatalf("ids = %#v", data["ids"])
	}
}

func TestEmbeddingCommandAndStatusDoNotExposeTraceIDName(t *testing.T) {
	status := &occupationpb.EmbeddingTaskStatus{TraceId: "trace-100", Status: "running"}

	command := embeddingCommandData(status)
	assertMapKeys(t, command, "id")
	if command["id"] != "trace-100" {
		t.Fatalf("command id = %#v", command["id"])
	}

	detail := embeddingTaskData(status)
	assertMapKeys(t, detail,
		"failed", "finishedAt", "id", "message", "processed",
		"startedAt", "status", "succeeded", "total")
	if _, exists := detail["traceId"]; exists {
		t.Fatal("status response must not expose traceId")
	}
}

func assertMapKeys(t *testing.T, data map[string]any, expected ...string) {
	t.Helper()
	actual := make([]string, 0, len(data))
	for key := range data {
		actual = append(actual, key)
	}
	sort.Strings(actual)
	sort.Strings(expected)
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("keys = %v, want %v", actual, expected)
	}
}
