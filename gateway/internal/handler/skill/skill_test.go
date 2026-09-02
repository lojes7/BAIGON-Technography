// 百工谱 — 规范技能 REST DTO 契约测试
package skill

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestSkillLookupItemsContainBatchDetailFieldsOnly(t *testing.T) {
	items := skillLookupItems([]*occupationpb.SkillLookupData{{
		Id: 100, Name: "RAG", IsEmbed: true,
	}})

	if len(items) != 1 {
		t.Fatalf("items length = %d", len(items))
	}
	assertKeys(t, items[0], "id", "isEmbed", "name")
}

func TestSkillDetailDoesNotContainRelations(t *testing.T) {
	data := skillDetailData(&occupationpb.SkillDetailData{
		Skill: &occupationpb.SkillData{Id: 100, Name: "RAG", IsEmbed: true},
	})

	assertKeys(t, data, "id", "isEmbed", "name")
}

func TestNonNilIDsKeepsEmptyArray(t *testing.T) {
	if ids := nonNilIDs(nil); ids == nil || len(ids) != 0 {
		t.Fatalf("ids = %#v", ids)
	}
}

func TestNormalizeLookupSkillIDsUsesFirstOccurrenceOrder(t *testing.T) {
	ids, ok := normalizeLookupSkillIDs([]int64{30, 10, 30, 20})
	if !ok || !reflect.DeepEqual(ids, []int64{30, 10, 20}) {
		t.Fatalf("ids = %#v, ok = %v", ids, ok)
	}
	tooManyDuplicates := make([]int64, 201)
	for index := range tooManyDuplicates {
		tooManyDuplicates[index] = 1
	}
	if _, ok := normalizeLookupSkillIDs(tooManyDuplicates); ok {
		t.Fatal("raw request over 200 ids must be rejected before deduplication")
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
