package user

import (
	"reflect"
	"testing"

	"baigon-technography/gateway/pb/userpb"
)

func TestNormalizeBatchIDsDeduplicatesInRequestOrder(t *testing.T) {
	if ids, ok := normalizeBatchIDs([]int64{1}); !ok || !reflect.DeepEqual(ids, []int64{1}) {
		t.Fatalf("单个 ID 必须被接受: ids=%v ok=%v", ids, ok)
	}
	maximum := make([]int64, 200)
	for index := range maximum {
		maximum[index] = int64(index + 1)
	}
	if ids, ok := normalizeBatchIDs(maximum); !ok || len(ids) != 200 {
		t.Fatalf("200 个原始 ID 必须被接受: len=%d ok=%v", len(ids), ok)
	}
	if _, ok := normalizeBatchIDs(nil); ok {
		t.Fatal("空 ID 列表必须拒绝")
	}

	ids, ok := normalizeBatchIDs([]int64{7, 2, 7, 4})
	if !ok {
		t.Fatal("合法批量 ID 被拒绝")
	}
	if want := []int64{7, 2, 4}; !reflect.DeepEqual(ids, want) {
		t.Fatalf("批量 ID 顺序错误: got %v want %v", ids, want)
	}

	tooMany := make([]int64, 201)
	for index := range tooMany {
		tooMany[index] = 1
	}
	if _, ok := normalizeBatchIDs(tooMany); ok {
		t.Fatal("原始请求超过 200 个 ID 时必须拒绝")
	}
}

func TestUserDataContainsOnlyOrganizationIDs(t *testing.T) {
	data := userData(&userpb.UserData{
		Id: 1, Uid: "student", Name: "学生", Role: "STUDENT", Status: "NORMAL",
		UniversityId: 2, SchoolId: 3, DepartmentId: 4,
	})
	want := []string{"id", "uid", "name", "role", "status", "universityId", "schoolId", "departmentId"}
	if len(data) != len(want) {
		t.Fatalf("用户详情字段数量错误: %#v", data)
	}
	for _, key := range want {
		if _, ok := data[key]; !ok {
			t.Fatalf("用户详情缺少字段 %q", key)
		}
	}
	for _, key := range []string{"university", "school", "department", "universityName", "schoolName", "departmentName"} {
		if _, ok := data[key]; ok {
			t.Fatalf("用户详情不应嵌入组织详情字段 %q", key)
		}
	}
}

func TestNonNilBatchIDsReturnsEmptySlice(t *testing.T) {
	if ids := nonNilBatchIDs(nil); ids == nil || len(ids) != 0 {
		t.Fatalf("空 ID 列表必须稳定为 []: %#v", ids)
	}
}

func TestOrganizationDataIncludesDirectParentID(t *testing.T) {
	data := organizationData(&userpb.OrganizationData{
		Id: 9, Name: "计算机学院", ParentId: 2,
	})
	if data["parentId"] != int64(2) {
		t.Fatalf("组织详情必须保留直接父级 ID: %#v", data)
	}
}
