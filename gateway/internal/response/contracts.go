package response

// IDData 是资源创建、更新或命令接口的最小成功数据。
type IDData struct {
	ID int64 `json:"id"`
}

// IDPageData 是列表与搜索接口统一使用的 ID 分页数据。
type IDPageData struct {
	IDs      []int64 `json:"ids"`
	Total    int64   `json:"total"`
	Page     int32   `json:"page"`
	PageSize int32   `json:"pageSize"`
}

// SkillIDsData 是一跳技能关系查询数据。
type SkillIDsData struct {
	SkillIDs []int64 `json:"skillIds"`
}

// RelationIDsData 是技能关系变更后返回的关系两端 ID。
type RelationIDsData struct {
	ParentSkillID int64 `json:"parentSkillId"`
	ChildSkillID  int64 `json:"childSkillId"`
}

// PingData 是网关连通性检查数据。
type PingData struct {
	Message string `json:"message"`
	TraceID string `json:"traceId"`
}
