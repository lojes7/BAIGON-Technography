// 百工谱 — 技能图谱 REST 文档契约
package skillgraph

// GraphData 是 scope 与岗位直接贡献技能的最小图谱。
type GraphData struct {
	ScopeID        int64   `json:"scopeId"`
	DirectSkillIDs []int64 `json:"directSkillIds"`
}

// MetricData 是 scope-skill 关系自身的统计属性。
type MetricData struct {
	SkillID  int64   `json:"skillId"`
	JobCount int64   `json:"jobCount"`
	Coverage float64 `json:"coverage"`
}

// MetricLookupData 是图谱指标批量查询数据。
type MetricLookupData struct {
	Items      []MetricData `json:"items"`
	MissingIDs []int64      `json:"missingIds"`
}

// EvidencePageData 是图谱证据岗位 ID 页。
type EvidencePageData struct {
	JobIDs   []int64 `json:"jobIds"`
	Total    int64   `json:"total"`
	Page     int32   `json:"page"`
	PageSize int32   `json:"pageSize"`
}
