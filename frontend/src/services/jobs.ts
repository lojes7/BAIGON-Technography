import type { ApiResponse, PaginatedData, JobItem, JobAbilities } from "../types/api";

import { parseJson } from "./lossless";

const BASE = "/api/jobs";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail?.[0]?.msg || `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

export async function getJobList(major_id: string, city_id?: string, page = 1, page_size = 20) {
  const params = new URLSearchParams({ major_id, page: String(page), page_size: String(page_size) });
  if (city_id) params.set("city_id", city_id);
  return request<PaginatedData<JobItem>>(`${BASE}?${params}`, { headers: hdrs() });
}

export async function getJobAbilities(job_id: string) {
  return request<JobAbilities>(`${BASE}/${job_id}/abilities`, { headers: hdrs() });
}
