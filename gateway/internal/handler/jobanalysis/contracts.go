// 百工谱 — 岗位分析审核 REST 文档契约
package jobanalysis

// TaskData 是岗位分析任务本体；关联资源只返回 ID。
type TaskData struct {
	ID                       int64   `json:"id"`
	JobID                    int64   `json:"jobId"`
	TaskStatus               string  `json:"taskStatus"`
	ReviewStatus             string  `json:"reviewStatus"`
	SelectedOccupationID     *int64  `json:"selectedOccupationId"`
	Attempts                 int32   `json:"attempts"`
	CreatedAt                string  `json:"createdAt"`
	ReviewedAt               *string `json:"reviewedAt"`
	ReviewedBy               *int64  `json:"reviewedBy"`
	OccupationAnalysisStatus string  `json:"occupationAnalysisStatus"`
	JDAnalysisStatus         string  `json:"jdAnalysisStatus"`
	SelectedMajorID          *int64  `json:"selectedMajorId"`
	MajorAnalysisStatus      string  `json:"majorAnalysisStatus"`
}

// TaskDetailData 是任务详情与其直接子资源 ID。
type TaskDetailData struct {
	TaskData
	CandidateIDs      []int64 `json:"candidateIds"`
	MajorCandidateIDs []int64 `json:"majorCandidateIds"`
	ResultIDs         []int64 `json:"resultIds"`
}

// OccupationCandidateData 是职业候选关系自身属性。
type OccupationCandidateData struct {
	ID           int64   `json:"id"`
	OccupationID int64   `json:"occupationId"`
	Rank         int32   `json:"rank"`
	Similarity   float64 `json:"similarity"`
}

// MajorCandidateData 是专业候选关系自身属性。
type MajorCandidateData struct {
	ID         int64   `json:"id"`
	MajorID    int64   `json:"majorId"`
	Rank       int32   `json:"rank"`
	Similarity float64 `json:"similarity"`
}

// ResultData 是尚未归一的岗位分析结果本体。
type ResultData struct {
	ID                       int64   `json:"id"`
	JobID                    int64   `json:"jobId"`
	SkillName                string  `json:"skillName"`
	SkillProficiency         string  `json:"skillProficiency"`
	Evidence                 string  `json:"evidence"`
	Rank                     int32   `json:"rank"`
	ReviewStatus             string  `json:"reviewStatus"`
	ReviewAction             string  `json:"reviewAction"`
	ReviewedSkillName        string  `json:"reviewedSkillName"`
	ReviewedSkillProficiency string  `json:"reviewedSkillProficiency"`
	ReviewedEvidence         string  `json:"reviewedEvidence"`
	ReviewedAt               *string `json:"reviewedAt"`
	ReviewedBy               *int64  `json:"reviewedBy"`
}

type TaskLookupData struct {
	Items      []TaskData `json:"items"`
	MissingIDs []int64    `json:"missingIds"`
}

type OccupationCandidateLookupData struct {
	Items      []OccupationCandidateData `json:"items"`
	MissingIDs []int64                   `json:"missingIds"`
}

type MajorCandidateLookupData struct {
	Items      []MajorCandidateData `json:"items"`
	MissingIDs []int64              `json:"missingIds"`
}

type ResultLookupData struct {
	Items      []ResultData `json:"items"`
	MissingIDs []int64      `json:"missingIds"`
}
