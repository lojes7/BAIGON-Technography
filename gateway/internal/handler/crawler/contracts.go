// 百工谱 — 爬虫任务 REST 文档契约
package crawler

// StatusData 是当前进程内爬虫任务状态。
type StatusData struct {
	ID              int64  `json:"id"`
	Status          string `json:"status"`
	Count           string `json:"count"`
	Message         string `json:"message"`
	CurrentCategory string `json:"currentCategory"`
	Progress        int32  `json:"progress"`
	TotalCleaned    int64  `json:"totalCleaned"`
}
