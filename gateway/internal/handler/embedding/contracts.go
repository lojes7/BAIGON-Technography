// 百工谱 — 向量化任务 REST 文档契约
package embedding

// CountData 是一种目录的向量化完成计数。
type CountData struct {
	Embedded int64 `json:"embedded"`
	Total    int64 `json:"total"`
}

// ProgressData 是三类目录的整体向量化进度。
type ProgressData struct {
	Majors      CountData `json:"majors"`
	Occupations CountData `json:"occupations"`
	Skills      CountData `json:"skills"`
}

// CommandData 是向量化启动或停止命令关联的追踪 ID。
type CommandData struct {
	ID string `json:"id"`
}

// TaskData 是单类向量化任务状态。
type TaskData struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	Total      int64  `json:"total"`
	Processed  int64  `json:"processed"`
	Succeeded  int64  `json:"succeeded"`
	Failed     int64  `json:"failed"`
	Message    string `json:"message"`
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt"`
}
