// 百工谱 — 岗位技能归一 REST 文档契约
package skillresolution

// TaskData 是归一任务本体。
type TaskData struct {
	ID               int64   `json:"id"`
	JobSkillID       int64   `json:"jobSkillId"`
	TaskStatus       string  `json:"taskStatus"`
	ReviewStatus     string  `json:"reviewStatus"`
	ResolutionAction string  `json:"resolutionAction"`
	SelectedSkillID  *int64  `json:"selectedSkillId"`
	Attempts         int32   `json:"attempts"`
	CreatedAt        string  `json:"createdAt"`
	ReviewedAt       *string `json:"reviewedAt"`
	ReviewedBy       *int64  `json:"reviewedBy"`
}

// TaskDetailData 是归一任务详情与候选资源 ID。
type TaskDetailData struct {
	TaskData
	CandidateIDs []int64 `json:"candidateIds"`
}

// CandidateData 是持久化候选关系自身属性。
type CandidateData struct {
	ID         int64   `json:"id"`
	SkillID    int64   `json:"skillId"`
	Rank       int32   `json:"rank"`
	Similarity float64 `json:"similarity"`
}

// SimilarSkillData 是实时 Top 5 相似技能计算结果。
type SimilarSkillData struct {
	SkillID    int64   `json:"skillId"`
	Rank       int32   `json:"rank"`
	Similarity float64 `json:"similarity"`
}

type TaskLookupData struct {
	Items      []TaskData `json:"items"`
	MissingIDs []int64    `json:"missingIds"`
}

type CandidateLookupData struct {
	Items      []CandidateData `json:"items"`
	MissingIDs []int64         `json:"missingIds"`
}

type SimilarSkillListData struct {
	Items []SimilarSkillData `json:"items"`
}
