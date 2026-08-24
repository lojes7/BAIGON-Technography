import type {
  ApiResponse, PaginatedData, JobData, JobDetail, ListJobsParams, JobItem, JobAbilities, JobMatchResult,
} from "../types/api";
import { HttpError } from "./http-error";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/jobs";
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
    throw new HttpError(res.status);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// 分页查询岗位（POST + body，文本字段包含匹配，majorId / occupationId 精确匹配）
export function listJobs(params?: ListJobsParams) {
  const body = {
    page: params?.page ?? 0,
    pageSize: params?.pageSize ?? 20,
    name: params?.name ?? "",
    majorId: params?.majorId,
    occupationId: params?.occupationId,
    major: params?.major ?? "",
    city: params?.city ?? "",
    province: params?.province ?? "",
    salary: params?.salary ?? "",
    company: params?.company ?? "",
    education: params?.education ?? "",
    nature: params?.nature ?? "",
    companySize: params?.companySize ?? "",
  };
  return request<PaginatedData<JobData>>(BASE, {
    method: "POST",
    headers: hdrs(true),
    // 雪花 ID 不能经 Number 转换，否则可能在浏览器端丢失精度。
    body: stringifyNumericIdBody(body, ["majorId", "occupationId"]),
  });
}

// 查询岗位详情（job + occupation + jobSkills）
export function getJobDetail(id: string | number) {
  return request<JobDetail>(`${BASE}/${id}`, { headers: hdrs() });
}

// 人岗匹配（使用当前用户最新简历匹配指定岗位）
export function matchMyResumeToJob(id: string | number) {
  return request<JobMatchResult>(`${BASE}/${id}/match`, { method: "POST", headers: hdrs() });
}

// 查询当前用户针对该岗位最近一次已持久化的匹配结果；404 由页面解释为“尚未匹配”。
export function getLatestMyJobMatch(id: string | number) {
  return request<JobMatchResult>(`${BASE}/${id}/match`, { headers: hdrs() });
}

export async function getJobList(major_id: string, city_id?: string, page = 1, page_size = 20) {
  const params = new URLSearchParams({ major_id, page: String(page), page_size: String(page_size) });
  if (city_id) params.set("city_id", city_id);
  return request<PaginatedData<JobItem>>(`${BASE}?${params}`, { headers: hdrs() });
}

export async function getJobAbilities(job_id: string) {
  return request<JobAbilities>(`${BASE}/${job_id}/abilities`, { headers: hdrs() });
}
