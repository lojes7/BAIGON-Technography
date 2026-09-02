// 百工谱 — 直接技能图谱 REST DTO 契约测试
package skillgraph

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestSkillGraphDataContainsOnlyScopeAndDirectIDs(t *testing.T) {
	data := skillGraphData(&occupationpb.GetSkillGraphResponse{
		ScopeId: 100, DirectSkillIds: []int64{200, 300},
	})

	assertKeys(t, data, "directSkillIds", "scopeId")
	if !reflect.DeepEqual(data["directSkillIds"], []int64{200, 300}) {
		t.Fatalf("directSkillIds = %#v", data["directSkillIds"])
	}
}

func TestSkillGraphMetricItemsContainNoSkillOrEvidenceDetail(t *testing.T) {
	items := skillGraphMetricItems([]*occupationpb.SkillGraphMetric{{
		SkillId: 200, JobCount: 3, Coverage: 0.75,
	}})

	if len(items) != 1 {
		t.Fatalf("items length = %d", len(items))
	}
	assertKeys(t, items[0], "coverage", "jobCount", "skillId")
}

func TestSkillGraphEvidenceDataContainsOnlyPagedJobIDs(t *testing.T) {
	data := skillGraphEvidenceData(&occupationpb.ListSkillGraphEvidenceJobsResponse{
		JobIds: []int64{500, 400}, Total: 3, Page: 1, PageSize: 2,
	})

	assertKeys(t, data, "jobIds", "page", "pageSize", "total")
}

func TestNormalizeSkillIDsDeduplicatesAndCapsBatch(t *testing.T) {
	ids, ok := normalizeSkillIDs([]int64{200, 100, 200})
	if !ok || !reflect.DeepEqual(ids, []int64{200, 100}) {
		t.Fatalf("ids = %#v, ok = %v", ids, ok)
	}

	tooMany := make([]int64, 201)
	for index := range tooMany {
		tooMany[index] = int64(index + 1)
	}
	if _, ok := normalizeSkillIDs(tooMany); ok {
		t.Fatal("201 unique ids must be rejected")
	}

	tooManyDuplicates := make([]int64, 201)
	for index := range tooManyDuplicates {
		tooManyDuplicates[index] = 1
	}
	if _, ok := normalizeSkillIDs(tooManyDuplicates); ok {
		t.Fatal("raw request over 200 ids must be rejected before deduplication")
	}
}

func TestValidMonthWindowUsesHalfOpenNaturalMonths(t *testing.T) {
	if !validMonthWindow("2026-05", "2026-06") {
		t.Fatal("valid month window was rejected")
	}
	if validMonthWindow("2026-06", "2026-06") || validMonthWindow("2026/05", "") {
		t.Fatal("invalid month window was accepted")
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
		t.Fatalf("keys = %v, want %v", actual, expected)
	}
}
