// 百工谱 — 七级目录 REST DTO 契约测试
package catalog

import (
	"reflect"
	"sort"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestDetailDataUsesSemanticParentFields(t *testing.T) {
	major := detailData(&occupationpb.CatalogDetailData{
		Id: 10, Code: "0809", Name: "计算机类", MajorCategoryId: 20, IsEmbed: true,
	}, majors)
	assertKeys(t, major, "code", "id", "isEmbed", "majorCategoryId", "name")

	occupation := detailData(&occupationpb.CatalogDetailData{
		Id: 30, Code: "2-02", Name: "工程技术人员", OccupationCategoryId: 40,
		IsEmbed: true, Description: "从事工程技术工作",
	}, occupations)
	assertKeys(t, occupation,
		"code", "description", "id", "isEmbed", "name", "occupationCategoryId")
}

func TestNormalizeIDsUsesRawLimitAndFirstOccurrenceOrder(t *testing.T) {
	ids, ok := normalizeIDs([]int64{30, 10, 30, 20})
	if !ok || !reflect.DeepEqual(ids, []int64{30, 10, 20}) {
		t.Fatalf("ids = %#v, ok = %v", ids, ok)
	}
	tooManyDuplicates := make([]int64, 201)
	for index := range tooManyDuplicates {
		tooManyDuplicates[index] = 1
	}
	if _, ok := normalizeIDs(tooManyDuplicates); ok {
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
