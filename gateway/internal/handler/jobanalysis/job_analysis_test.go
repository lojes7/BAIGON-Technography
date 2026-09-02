// 百工谱 — 岗位分析 REST 瘦身契约测试
package jobanalysis

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestTaskDataDoesNotExposeNamesOrInternalFields(t *testing.T) {
	data := taskData(&occupationpb.JobAnalysisTaskSummary{
		Id: 20, JobId: 10, TaskStatus: "SUCCESS", ReviewStatus: "PENDING",
		SelectedOccupationId: 44, SelectedMajorId: 55,
	})
	assertKeys(t, data,
		"attempts", "createdAt", "id", "jdAnalysisStatus", "jobId",
		"majorAnalysisStatus", "occupationAnalysisStatus", "reviewStatus",
		"reviewedAt", "reviewedBy", "selectedMajorId", "selectedOccupationId",
		"taskStatus")
	for _, forbidden := range []string{
		"jobName", "jobMajor", "traceId", "modelName", "errorMsg",
		"selectedOccupationName", "selectedMajorName",
	} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("任务本体不应暴露字段 %q", forbidden)
		}
	}
}

func TestTaskDetailOnlyAddsChildResourceIDs(t *testing.T) {
	data := taskDetailData(&occupationpb.JobAnalysisTaskDetail{
		Task:         &occupationpb.JobAnalysisTaskSummary{Id: 20, JobId: 10},
		CandidateIds: []int64{30}, MajorCandidateIds: []int64{35},
		ResultIds: []int64{40},
	})

	if !reflect.DeepEqual(data["candidateIds"], []int64{30}) ||
		!reflect.DeepEqual(data["majorCandidateIds"], []int64{35}) ||
		!reflect.DeepEqual(data["resultIds"], []int64{40}) {
		t.Fatalf("子资源 ID 映射错误: %#v", data)
	}
	for _, forbidden := range []string{"candidates", "majorCandidates", "results"} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("任务详情不应嵌套子资源对象 %q", forbidden)
		}
	}
}

func TestCandidateAndResultAreFlatResources(t *testing.T) {
	assertKeys(t, occupationCandidateData(&occupationpb.JobAnalysisCandidate{}),
		"id", "occupationId", "rank", "similarity")
	assertKeys(t, majorCandidateData(&occupationpb.JobAnalysisMajorCandidate{}),
		"id", "majorId", "rank", "similarity")
	assertKeys(t, resultData(&occupationpb.JobAnalysisResult{}),
		"evidence", "id", "jobId", "rank", "reviewAction", "reviewStatus",
		"reviewedAt", "reviewedBy", "reviewedEvidence", "reviewedSkillName",
		"reviewedSkillProficiency", "skillName", "skillProficiency")
}

func TestNormalizeIDsUsesRawLimitAndFirstRequestOrder(t *testing.T) {
	ids, ok := normalizeIDs([]int64{9, 3, 9, 5})
	if !ok || !reflect.DeepEqual(ids, []int64{9, 3, 5}) {
		t.Fatalf("去重顺序错误: ids=%v ok=%v", ids, ok)
	}
	tooMany := make([]int64, 201)
	for index := range tooMany {
		tooMany[index] = 1
	}
	if _, ok := normalizeIDs(tooMany); ok {
		t.Fatal("原始输入超过 200 条时必须拒绝")
	}
}

func assertKeys(t *testing.T, data map[string]any, expected ...string) {
	t.Helper()
	actual := make([]string, 0, len(data))
	for key := range data {
		actual = append(actual, key)
	}
	sort.Strings(actual)
	sort.Strings(expected)
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("字段集合错误: got=%v want=%v", actual, expected)
	}
}
