// 百工谱 — 岗位 handler 请求校验与响应字段测试
package job

import (
	"encoding/json"
	"testing"

	occupationpb "baigon-technography/gateway/pb/occupationpb"
)

func TestValidListRequest(t *testing.T) {
	validOccupationID := int64(10)
	invalidOccupationID := int64(0)
	if !validListRequest(listJobsRequest{Page: 0, PageSize: 20, OccupationID: &validOccupationID}) {
		t.Fatal("合法分页和 occupationId 不应被拒绝")
	}
	if validListRequest(listJobsRequest{Page: -1}) {
		t.Fatal("负数页码应被拒绝")
	}
	if validListRequest(listJobsRequest{PageSize: 101}) {
		t.Fatal("超过 100 的 pageSize 应被拒绝")
	}
	if validListRequest(listJobsRequest{OccupationID: &invalidOccupationID}) {
		t.Fatal("显式传入非正 occupationId 应被拒绝")
	}
}

func TestJobDataKeepsCamelCaseAndNullableOccupationID(t *testing.T) {
	payload, err := json.Marshal(jobData(&occupationpb.JobData{
		Id: 10, Name: "Java开发工程师", CompanyName: "百工科技",
	}))
	if err != nil {
		t.Fatalf("序列化岗位失败：%v", err)
	}
	var result map[string]any
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatalf("解析岗位 JSON 失败：%v", err)
	}
	if result["companyName"] != "百工科技" {
		t.Fatalf("companyName 字段错误：%v", result["companyName"])
	}
	if result["occupationId"] != nil {
		t.Fatalf("空 occupationId 应返回 null：%v", result["occupationId"])
	}
}
