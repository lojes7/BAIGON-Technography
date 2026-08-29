// 百工谱 — 岗位技能归一 REST 瘦身契约测试
package skillresolution

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestTaskDataDoesNotCopyJobSkillOrInternalFields(t *testing.T) {
	data := taskData(&occupationpb.JobSkillResolutionTaskSummary{
		Id: 10, JobSkillId: 100, TaskStatus: "SUCCESS", ReviewStatus: "PENDING",
		SelectedSkillId: 300,
	})
	assertKeys(t, data,
		"attempts", "createdAt", "id", "jobSkillId", "resolutionAction",
		"reviewStatus", "reviewedAt", "reviewedBy", "selectedSkillId", "taskStatus")
	for _, forbidden := range []string{
		"jobId", "skillName", "traceId", "modelName", "errorMsg", "jobSkill",
	} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("归一任务不应暴露字段 %q", forbidden)
		}
	}
}

func TestTaskDetailOnlyAddsCandidateIDs(t *testing.T) {
	data := taskDetailData(&occupationpb.JobSkillResolutionTaskDetail{
		Task:         &occupationpb.JobSkillResolutionTaskSummary{Id: 10, JobSkillId: 100},
		CandidateIds: []int64{50, 60},
	})
	if !reflect.DeepEqual(data["candidateIds"], []int64{50, 60}) {
		t.Fatalf("候选 ID 映射错误: %#v", data["candidateIds"])
	}
	for _, forbidden := range []string{"candidates", "jobSkill"} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("任务详情不应嵌套关联对象 %q", forbidden)
		}
	}
}

func TestPersistedAndLiveCandidatesUseDifferentResourceShapes(t *testing.T) {
	item := &occupationpb.JobSkillResolutionCandidate{
		Id: 50, SkillId: 300, Rank: 1, Similarity: 0.9,
	}
	assertKeys(t, candidateData(item), "id", "rank", "similarity", "skillId")
	assertKeys(t, similarSkillData(item), "rank", "similarity", "skillId")
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
