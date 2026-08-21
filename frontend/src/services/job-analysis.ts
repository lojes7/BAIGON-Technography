import type {
  ApiResponse, PaginatedData, JobAnalysisTaskSummary, JobAnalysisTaskDetail, ReviewJobAnalysisParams,
} from "../types/api";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/occupation/job-analysis";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }
  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// 分页查询岗位分析任务（page 从 0 开始；reviewStatus 可选 PENDING / PASSED / REJECTED）
export function listJobAnalysisTasks(params?: { page?: number; pageSize?: number; reviewStatus?: string }) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 0));
  q.set("pageSize", String(params?.pageSize ?? 20));
  if (params?.reviewStatus) q.set("reviewStatus", params.reviewStatus);
  return request<PaginatedData<JobAnalysisTaskSummary>>(`${BASE}?${q}`, { headers: hdrs() });
}

// 查询岗位分析任务详情（任务 + 职业候选 + 技能结果）
export function getJobAnalysisTask(id: string | number) {
  return request<{ analysis: JobAnalysisTaskDetail }>(`${BASE}/${id}`, { headers: hdrs() });
}

// 审核岗位职业与技能分析（确认职业并逐条审核全部技能）
export function reviewJobAnalysisTask(id: string | number, body: ReviewJobAnalysisParams) {
  return request<{ analysis: JobAnalysisTaskDetail }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    // occupationId / resultId 均为雪花 ID，必须作为 JSON 数字回传（int64 不接受字符串）
    body: stringifyNumericIdBody(body, ["occupationId", "resultId"]),
  });
}
