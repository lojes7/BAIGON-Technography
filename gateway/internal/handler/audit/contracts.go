// 百工谱 — 审计日志 REST 文档契约
package audit

// LogData 是来源隔离的审计日志详情，仅 ADMIN 可读。
type LogData struct {
	ID            int64  `json:"id"`
	TraceID       string `json:"traceId"`
	UserID        int64  `json:"userId"`
	UserName      string `json:"userName"`
	UserType      string `json:"userType"`
	UserIP        string `json:"userIp"`
	Level         string `json:"level"`
	RequestMethod string `json:"requestMethod"`
	RequestURL    string `json:"requestUrl"`
	ErrorMsg      string `json:"errorMsg"`
	Detail        string `json:"detail"`
	CreatedAt     string `json:"createdAt"`
	SourceService string `json:"sourceService"`
}

// LogLookupData 是单一日志来源的批量详情数据。
type LogLookupData struct {
	Items      []LogData `json:"items"`
	MissingIDs []int64   `json:"missingIds"`
}
