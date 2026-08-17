import type { ApiResponse, PaginatedData, TeacherStudentItem } from "../types/api";

import { parseJson } from "./lossless";

const BASE = "/api/teacher";
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

export async function getTeacherStudents(page = 1, page_size = 20) {
  return request<PaginatedData<TeacherStudentItem>>(`${BASE}/students?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}
