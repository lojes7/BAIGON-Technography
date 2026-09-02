package audit

import (
	"reflect"
	"testing"

	commonpb "baigon-technography/gateway/pb/commonpb"
)

func TestNormalizeAuditBatchIDsDeduplicatesInRequestOrder(t *testing.T) {
	if ids, ok := normalizeAuditBatchIDs([]int64{1}); !ok || !reflect.DeepEqual(ids, []int64{1}) {
		t.Fatalf("单个 ID 必须被接受: ids=%v ok=%v", ids, ok)
	}
	maximum := make([]int64, 200)
	for index := range maximum {
		maximum[index] = int64(index + 1)
	}
	if ids, ok := normalizeAuditBatchIDs(maximum); !ok || len(ids) != 200 {
		t.Fatalf("200 个原始 ID 必须被接受: len=%d ok=%v", len(ids), ok)
	}
	if _, ok := normalizeAuditBatchIDs(nil); ok {
		t.Fatal("空 ID 列表必须拒绝")
	}

	ids, ok := normalizeAuditBatchIDs([]int64{8, 3, 8, 5})
	if !ok {
		t.Fatal("合法批量 ID 被拒绝")
	}
	if want := []int64{8, 3, 5}; !reflect.DeepEqual(ids, want) {
		t.Fatalf("批量 ID 顺序错误: got %v want %v", ids, want)
	}

	tooMany := make([]int64, 201)
	for index := range tooMany {
		tooMany[index] = 1
	}
	if _, ok := normalizeAuditBatchIDs(tooMany); ok {
		t.Fatal("原始请求超过 200 个 ID 时必须拒绝")
	}
}

func TestAuditLogDataUsesCamelCaseAndHonorsInternalErrorFlag(t *testing.T) {
	item := &commonpb.AuditLogItem{Id: 11, TraceId: 12, ErrorMsg: "内部错误"}
	withoutError := auditLogData(item, sourceAI, false)
	if withoutError["traceId"] != int64(12) || withoutError["sourceService"] != "ai" {
		t.Fatalf("审计详情映射错误: %#v", withoutError)
	}
	if withoutError["errorMsg"] != "" {
		t.Fatal("未授权详情不应携带内部错误")
	}
	if _, ok := withoutError["trace_id"]; ok {
		t.Fatal("REST DTO 不应暴露 snake_case 字段")
	}
	if withError := auditLogData(item, sourceAI, true); withError["errorMsg"] != "内部错误" {
		t.Fatal("ADMIN 详情应保留当前来源允许的内部错误")
	}
}

func TestNonNilAuditIDsReturnsEmptySlice(t *testing.T) {
	if ids := nonNilAuditIDs(nil); ids == nil || len(ids) != 0 {
		t.Fatalf("空 ID 列表必须稳定为 []: %#v", ids)
	}
}
