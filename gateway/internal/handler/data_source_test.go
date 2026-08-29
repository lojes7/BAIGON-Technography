package handler

import (
	"reflect"
	"testing"

	datasourcepb "baigon-technography/gateway/pb/datasourcepb"
)

func TestCleanedJobDataUsesFlatCamelCaseContract(t *testing.T) {
	data := cleanedJobData(&datasourcepb.CleanedJobDetail{
		Id: 11, TraceId: 22, JobName: "后端工程师", SourcePlatform: "测试平台",
		ReviewStatus: "PENDING",
	})

	for _, key := range []string{"id", "jobName", "sourcePlatform", "reviewStatus"} {
		if _, ok := data[key]; !ok {
			t.Fatalf("详情缺少 camelCase 字段 %q", key)
		}
	}
	for _, key := range []string{"job", "traceId", "trace_id", "job_name", "source_platform", "review_status"} {
		if _, ok := data[key]; ok {
			t.Fatalf("详情不应暴露旧包装或 snake_case 字段 %q", key)
		}
	}
}

func TestCleanedJobSummaryDataOnlyContainsListFields(t *testing.T) {
	data := cleanedJobSummaryData(&datasourcepb.CleanedJobDetail{Id: 11, JobDescription: "很长的详情"})
	want := []string{
		"id", "jobName", "companyName", "sourcePlatform", "publishDate", "createdAt", "reviewStatus",
	}
	if len(data) != len(want) {
		t.Fatalf("批量摘要字段数量错误: got %v", data)
	}
	for _, key := range want {
		if _, ok := data[key]; !ok {
			t.Fatalf("批量摘要缺少字段 %q", key)
		}
	}
	if _, ok := data["jobDescription"]; ok {
		t.Fatal("批量摘要不应携带岗位长描述")
	}
}

func TestNormalizeDataSourceBatchIDsDeduplicatesInRequestOrder(t *testing.T) {
	if ids, ok := normalizeDataSourceBatchIDs([]int64{1}); !ok || !reflect.DeepEqual(ids, []int64{1}) {
		t.Fatalf("单个 ID 必须被接受: ids=%v ok=%v", ids, ok)
	}
	maximum := make([]int64, 200)
	for index := range maximum {
		maximum[index] = int64(index + 1)
	}
	if ids, ok := normalizeDataSourceBatchIDs(maximum); !ok || len(ids) != 200 {
		t.Fatalf("200 个原始 ID 必须被接受: len=%d ok=%v", len(ids), ok)
	}
	if _, ok := normalizeDataSourceBatchIDs(nil); ok {
		t.Fatal("空 ID 列表必须拒绝")
	}

	ids, ok := normalizeDataSourceBatchIDs([]int64{9, 3, 9, 5})
	if !ok {
		t.Fatal("合法批量 ID 被拒绝")
	}
	if want := []int64{9, 3, 5}; !reflect.DeepEqual(ids, want) {
		t.Fatalf("批量 ID 顺序错误: got %v want %v", ids, want)
	}

	tooMany := make([]int64, 201)
	for index := range tooMany {
		tooMany[index] = 1
	}
	if _, ok := normalizeDataSourceBatchIDs(tooMany); ok {
		t.Fatal("原始请求超过 200 个 ID 时必须拒绝，即使内容重复")
	}
}

func TestNonNilDataSourceIDsReturnsEmptySlice(t *testing.T) {
	if ids := nonNilDataSourceIDs(nil); ids == nil || len(ids) != 0 {
		t.Fatalf("空 ID 列表必须稳定为 []: %#v", ids)
	}
}
