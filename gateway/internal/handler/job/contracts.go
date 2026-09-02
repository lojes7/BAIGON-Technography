// 百工谱 — 岗位 REST 文档契约
package job

// JobData 是扁平岗位详情；关联对象只用 ID 表示。
type JobData struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	OccupationID   *int64  `json:"occupationId"`
	MajorID        *int64  `json:"majorId"`
	PublishDate    string  `json:"publishDate"`
	SourcePlatform string  `json:"sourcePlatform"`
	SourceURL      string  `json:"sourceUrl"`
	City           string  `json:"city"`
	Tags           string  `json:"tags"`
	Major          string  `json:"major"`
	Nature         string  `json:"nature"`
	Salary         string  `json:"salary"`
	CompanyName    string  `json:"companyName"`
	CompanySize    string  `json:"companySize"`
	Province       string  `json:"province"`
	Education      string  `json:"education"`
	Experience     string  `json:"experience"`
	JobDescription string  `json:"jobDescription"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	JobSkillIDs    []int64 `json:"jobSkillIds"`
}

// JobLookupData 是岗位批量详情数据。
type JobLookupData struct {
	Items      []JobData `json:"items"`
	MissingIDs []int64   `json:"missingIds"`
}

// JobSkillData 是岗位技能关系详情。
type JobSkillData struct {
	ID               int64  `json:"id"`
	JobID            int64  `json:"jobId"`
	SkillID          *int64 `json:"skillId"`
	SkillName        string `json:"skillName"`
	SkillProficiency string `json:"skillProficiency"`
	Evidence         string `json:"evidence"`
}

// JobSkillLookupData 是岗位技能批量详情数据。
type JobSkillLookupData struct {
	Items      []JobSkillData `json:"items"`
	MissingIDs []int64        `json:"missingIds"`
}

// MatchSkillData 是尚未归一的匹配建议文本。
type MatchSkillData struct {
	SkillName  string `json:"skillName"`
	Reason     string `json:"reason"`
	Suggestion string `json:"suggestion"`
}

// MatchResultData 是当前用户与岗位的最新匹配结果。
type MatchResultData struct {
	ID                int64            `json:"id"`
	ResumeID          int64            `json:"resumeId"`
	JobID             int64            `json:"jobId"`
	Score             float64          `json:"score"`
	Summary           string           `json:"summary"`
	SkillsToLearn     []MatchSkillData `json:"skillsToLearn"`
	ActionSuggestions []string         `json:"actionSuggestions"`
	CreatedAt         string           `json:"createdAt"`
}
