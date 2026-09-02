// 百工谱 — 用户、组织与简历 REST 文档契约
package user

// LoginData 是登录成功后返回的最小会话数据。
type LoginData struct {
	Token  string `json:"token"`
	UserID int64  `json:"userId"`
}

// UserData 是用户本体；组织引用只返回 ID。
type UserData struct {
	ID           int64  `json:"id"`
	UID          string `json:"uid"`
	Name         string `json:"name"`
	Role         string `json:"role"`
	Status       string `json:"status"`
	UniversityID int64  `json:"universityId"`
	SchoolID     int64  `json:"schoolId"`
	DepartmentID int64  `json:"departmentId"`
}

type UserLookupData struct {
	Items      []UserData `json:"items"`
	MissingIDs []int64    `json:"missingIds"`
}

// OrganizationData 是组织本体与直接父级 ID。
type OrganizationData struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	ParentID int64  `json:"parentId"`
}

type OrganizationLookupData struct {
	Items      []OrganizationData `json:"items"`
	MissingIDs []int64            `json:"missingIds"`
}

// ResumeUploadData 是预签名上传所需的能力数据。
type ResumeUploadData struct {
	UploadID    int64  `json:"uploadId"`
	UploadURL   string `json:"uploadUrl"`
	Method      string `json:"method"`
	ContentType string `json:"contentType"`
	ExpiresAt   string `json:"expiresAt"`
}

// ResumeData 是当前简历本体。
type ResumeData struct {
	ID        int64          `json:"id"`
	FileName  *string        `json:"fileName"`
	FileSize  *int64         `json:"fileSize"`
	Content   *string        `json:"content"`
	CreatedAt string         `json:"createdAt"`
	Fields    map[string]any `json:"fields"`
	Source    string         `json:"source"`
}

// ResumeAnalysisData 是技能分析命令创建的资源 ID 集合。
type ResumeAnalysisData struct {
	ResumeID           int64   `json:"resumeId"`
	UserSkillRecordIDs []int64 `json:"userSkillRecordIds"`
}

// UserSkillData 是当前用户拥有的简历技能记录。
type UserSkillData struct {
	ID          int64  `json:"id"`
	ResumeID    int64  `json:"resumeId"`
	SkillName   string `json:"skillName"`
	Proficiency string `json:"proficiency"`
	Evidence    string `json:"evidence"`
	CreatedAt   string `json:"createdAt"`
}

type UserSkillLookupData struct {
	Items      []UserSkillData `json:"items"`
	MissingIDs []int64         `json:"missingIds"`
}
