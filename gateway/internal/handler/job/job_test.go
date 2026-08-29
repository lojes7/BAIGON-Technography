// 百工谱 — 岗位技能 REST DTO 契约测试
package job

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestJobSkillDataDoesNotContainCanonicalHierarchy(t *testing.T) {
	data := jobSkillData(&occupationpb.JobSkillData{
		Id: 10, JobId: 15, SkillId: 20, SkillName: "RAG",
		SkillProficiency: "ADVANCED", Evidence: "负责检索增强链路",
	})

	actual := make([]string, 0, len(data))
	for key := range data {
		actual = append(actual, key)
	}
	expected := []string{"evidence", "id", "jobId", "skillId", "skillName", "skillProficiency"}
	sort.Strings(actual)
	sort.Strings(expected)
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("keys = %v, want %v", actual, expected)
	}
}

func TestJobDataIsFlatAndOnlyReferencesRelatedIDs(t *testing.T) {
	data := jobData(&occupationpb.JobData{
		Id: 10, Name: "大模型应用工程师", MajorId: 20, OccupationId: 30,
		JobSkillIds: []int64{40, 50},
	})
	if !reflect.DeepEqual(data["jobSkillIds"], []int64{40, 50}) {
		t.Fatalf("jobSkillIds = %#v", data["jobSkillIds"])
	}
	for _, forbidden := range []string{"majorDetail", "occupation", "jobSkills"} {
		if _, exists := data[forbidden]; exists {
			t.Fatalf("flat job must not contain %q", forbidden)
		}
	}
}

func TestNormalizeLookupIDsUsesRawLimitAndFirstOccurrenceOrder(t *testing.T) {
	ids, ok := normalizeLookupIDs([]int64{30, 10, 30, 20})
	if !ok || !reflect.DeepEqual(ids, []int64{30, 10, 20}) {
		t.Fatalf("ids = %#v, ok = %v", ids, ok)
	}
	tooManyDuplicates := make([]int64, 201)
	for index := range tooManyDuplicates {
		tooManyDuplicates[index] = 1
	}
	if _, ok := normalizeLookupIDs(tooManyDuplicates); ok {
		t.Fatal("raw request over 200 ids must be rejected before deduplication")
	}
}
