// 新版 API：爬虫与数据治理
// 爬虫：POST/GET/DELETE /api/auth/crawl
// 数据源：POST /api/auth/data-source（列表）, GET /api/auth/data-source/{id}（详情）,
//         GET /api/auth/data-source/{id}/source（原始记录追溯）,
//         POST/DELETE/PUT /api/auth/data-source/{id}/review（复核通过/拒绝/修改后通过）

import type {
  ApiResponse, PaginatedData,
  CrawlerResult, CrawlerStatus,
  DataSourceItem, DataSourceDetail, SourceJobDetail,
  DataSourceListParams, IngestJob, IngestResult,
} from "../types/api";
import { parseJson } from "./lossless";

const BASE = "/api/auth";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  // 与 request.ts 拦截器行为一致：401 时清除会话并跳转登录页
  if (res.status === 401) {
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }
  if (!res.ok) {
    // 新版错误响应仅含 { code: <httpStatus> }，不携带消息
    const msg = `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  // 用 lossless 解析，避免雪花 ID（int64）被 JSON.parse 丢精度
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// ═══════════════════ 爬虫操作 ═══════════════════

// 启动采集参数
export interface StartCrawlParams {
  categories?: string[];
  maxDocuments?: number;
}

// 启动采集
export async function startCrawler(params?: StartCrawlParams) {
  return request<CrawlerResult>(`${BASE}/crawl`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({
      type: "JOB",
      categories: params?.categories ?? [],
      maxDocuments: params?.maxDocuments ?? 1000,
    }),
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

// 模拟采集：注入配置好的岗位数据（走完整落库/清洗/Kafka 流程，不真爬）
export async function ingestData(jobs: IngestJob[]) {
  // 网关 ingestedJob 结构体用 camelCase json tag（见 gateway/internal/handler/crawler.go），
  // 而 IngestJob 类型为 snake_case，提交前做一次字段名转换，否则多词字段（如 job_name）会丢失。
  const payload = jobs.map((j) => ({
    publishDate: j.publish_date,
    sourcePlatform: j.source_platform,
    sourceUrl: j.source_url,
    city: j.city,
    tags: j.tags,
    major: j.major,
    nature: j.nature,
    salary: j.salary,
    jobName: j.job_name,
    companyName: j.company_name,
    companySize: j.company_size,
    province: j.province,
    education: j.education,
    experience: j.experience,
    jobDescription: j.job_description,
  }));
  return request<IngestResult>(`${BASE}/crawl/ingest`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({ jobs: payload }),
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

export async function reviewDataSource(dsId: string, reviewStatus: string) {
  if (reviewStatus === "REVIEW_PASSED" || reviewStatus === "PASSED") {
    return approveReview(dsId);
  }
  return rejectReview(dsId);
}

