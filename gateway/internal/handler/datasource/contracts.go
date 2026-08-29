// 百工谱 — 数据治理 REST 文档契约
package datasource

// CleanedJobSummaryData 是数据治理列表批量解析所需的精简详情。
type CleanedJobSummaryData struct {
	ID             int64  `json:"id"`
	JobName        string `json:"jobName"`
	CompanyName    string `json:"companyName"`
	SourcePlatform string `json:"sourcePlatform"`
	PublishDate    string `json:"publishDate"`
	CreatedAt      string `json:"createdAt"`
	ReviewStatus   string `json:"reviewStatus"`
}

// CleanedJobLookupData 是清洗岗位批量详情数据。
type CleanedJobLookupData struct {
	Items      []CleanedJobSummaryData `json:"items"`
	MissingIDs []int64                 `json:"missingIds"`
}

// CleanedJobData 是扁平清洗岗位详情。
type CleanedJobData struct {
	ID             int64   `json:"id"`
	PublishDate    string  `json:"publishDate"`
	SourcePlatform string  `json:"sourcePlatform"`
	SourceURL      string  `json:"sourceUrl"`
	City           string  `json:"city"`
	Tags           string  `json:"tags"`
	Major          string  `json:"major"`
	Nature         string  `json:"nature"`
	Salary         string  `json:"salary"`
	JobName        string  `json:"jobName"`
	CompanyName    string  `json:"companyName"`
	CompanySize    string  `json:"companySize"`
	Province       string  `json:"province"`
	Education      string  `json:"education"`
	Experience     string  `json:"experience"`
	JobDescription string  `json:"jobDescription"`
	ReviewStatus   string  `json:"reviewStatus"`
	ReviewedAt     *string `json:"reviewedAt"`
	ReviewedBy     *int64  `json:"reviewedBy"`
	CreatedAt      string  `json:"createdAt"`
}

// SourceJobData 是扁平原始岗位详情。
type SourceJobData struct {
	ID             int64  `json:"id"`
	PublishDate    string `json:"publishDate"`
	SourcePlatform string `json:"sourcePlatform"`
	SourceURL      string `json:"sourceUrl"`
	City           string `json:"city"`
	Tags           string `json:"tags"`
	Major          string `json:"major"`
	Nature         string `json:"nature"`
	Salary         string `json:"salary"`
	JobName        string `json:"jobName"`
	CompanyName    string `json:"companyName"`
	CompanySize    string `json:"companySize"`
	Province       string `json:"province"`
	Education      string `json:"education"`
	Experience     string `json:"experience"`
	JobDescription string `json:"jobDescription"`
}
