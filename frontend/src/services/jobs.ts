import type {
  ApiResponse, PaginatedData, JobData, JobDetail, ListJobsParams, JobItem, JobAbilities, JobMatchResult,
} from "../types/api";
import { parseJson } from "./lossless";

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
    throw new Error(`请求失败 (${res.status})`);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// 分页查询岗位（POST + body，文本字段包含匹配，occupationId 精确匹配）
export function listJobs(params?: ListJobsParams) {
  return request<PaginatedData<JobData>>(BASE, {
    method: "POST",
    headers: hdrs(true),
    body: JSON.stringify({
      page: params?.page ?? 0,
      pageSize: params?.pageSize ?? 20,
      name: params?.name ?? "",
      occupationId: params?.occupationId,
      major: params?.major ?? "",
      city: params?.city ?? "",
      province: params?.province ?? "",
      salary: params?.salary ?? "",
      company: params?.company ?? "",
      education: params?.education ?? "",
      nature: params?.nature ?? "",
      companySize: params?.companySize ?? "",
    }),
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

export async function getJobList(major_id: string, city_id?: string, page = 1, page_size = 20) {
  const params = new URLSearchParams({ major_id, page: String(page), page_size: String(page_size) });
  if (city_id) params.set("city_id", city_id);
  return request<PaginatedData<JobItem>>(`${BASE}?${params}`, { headers: hdrs() });
}

export async function getJobAbilities(job_id: string) {
  return request<JobAbilities>(`${BASE}/${job_id}/abilities`, { headers: hdrs() });
}
