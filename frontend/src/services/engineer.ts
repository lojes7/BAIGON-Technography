// 新版 API：爬虫与数据治理
// 爬虫：POST/GET/DELETE /api/auth/crawl
// 数据源：POST /api/auth/data-source（列表）, GET /api/auth/data-source/{id}（详情）,
//         GET /api/auth/data-source/{id}/source（原始记录追溯）,
//         POST/DELETE/PUT /api/auth/data-source/{id}/review（复核通过/拒绝/修改后通过）

import type {
  ApiResponse, PaginatedData,
  CrawlerResult, CrawlerStatus,
  DataSourceItem, DataSourceDetail, SourceJobDetail,
  DataSourceListParams,
} from "../types/api";

const BASE = "/api/auth";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 新版错误响应仅含 { code: <httpStatus> }，不携带消息
    const msg = `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

// ═══════════════════ 爬虫操作 ═══════════════════

// 启动采集
export async function startCrawler() {
  return request<CrawlerResult>(`${BASE}/crawl`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({ type: "JOB" }),
  });
}

// 查询采集状态
export async function getCrawlerStatus() {
  return request<CrawlerStatus>(`${BASE}/crawl`, { headers: hdrs() });
}

// 停止采集
export async function stopCrawler() {
  return request<{ status: string }>(`${BASE}/crawl`, {
    method: "DELETE",
    headers: hdrs(),
  });
}

// ═══════════════════ 数据治理 ═══════════════════

// 分页查询清洗后岗位列表（POST + body）
export async function getDataSourceList(params?: DataSourceListParams) {
  return request<PaginatedData<DataSourceItem>>(`${BASE}/data-source`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({
      page: params?.page ?? 0,
      pageSize: params?.pageSize ?? 20,
      reviewStatus: params?.reviewStatus ?? "",
      publishDateFrom: params?.publishDateFrom ?? "",
      publishDateTo: params?.publishDateTo ?? "",
    }),
  });
}

// 查看清洗后岗位详情
export async function getDataSourceDetail(id: string) {
  return request<{ job: DataSourceDetail }>(`${BASE}/data-source/${id}`, {
    headers: hdrs(),
  });
}

// 查看原始记录追溯
export async function getSourceRecord(id: string) {
  return request<{ source: SourceJobDetail }>(`${BASE}/data-source/${id}/source`, {
    headers: hdrs(),
  });
}

// 复核通过
export async function approveReview(id: string) {
  return request<{ job: DataSourceDetail }>(`${BASE}/data-source/${id}/review`, {
    method: "POST",
    headers: hdrs(),
  });
}

// 复核拒绝
export async function rejectReview(id: string) {
  return request<{ job: DataSourceDetail }>(`${BASE}/data-source/${id}/review`, {
    method: "DELETE",
    headers: hdrs(),
  });
}

// 修改后通过复核
export async function editAndApproveReview(id: string, edits: {
  jobName?: string;
  companyName?: string;
  salary?: string;
  city?: string;
  education?: string;
  experience?: string;
  jobDescription?: string;
}) {
  return request<{ job: DataSourceDetail }>(`${BASE}/data-source/${id}/review`, {
    method: "PUT",
    headers: hdrs(),
    body: JSON.stringify(edits),
  });
}

// ═══════════════════ 向后兼容（旧页面使用的导出） ═══════════════════

// 旧版统一的审核接口 → 新版拆分后的映射
export async function reviewDataSource(dsId: string, reviewStatus: string) {
  if (reviewStatus === "REVIEW_PASSED" || reviewStatus === "PASSED") {
    return approveReview(dsId);
  }
  return rejectReview(dsId);
}

// 旧版批量清洗接口 → 新版不再支持，返回提示
export async function cleanDataSources(ids: string[]) {
  console.warn("批量清洗接口在新版后端中已移除，ids:", ids);
  throw new Error("批量清洗功能在新版中暂不可用");
}
