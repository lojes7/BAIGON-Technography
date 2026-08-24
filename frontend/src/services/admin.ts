import type {
  ApiResponse, PaginatedData,
  CreateStudentAffairBody, CreateStudentAffairResult, StudentAffairItem,
} from "../types/api";

import { parseJson } from "./lossless";

const BASE = "/api/admin";
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

export async function getStudentAffairList(page = 1, page_size = 20) {
  return request<PaginatedData<StudentAffairItem>>(`${BASE}/student-affairs?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}

export async function createStudentAffair(body: CreateStudentAffairBody) {
  return request<CreateStudentAffairResult>(`${BASE}/student-affairs`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}

export async function deleteStudentAffair(sa_id: string) {
  return request<string>(`${BASE}/student-affairs/${sa_id}`, { method: "DELETE", headers: hdrs() });
}
import type { SchoolItem, CreateSchoolBody, SchoolMutationResult, DepartmentItem, CreateDepartmentBody, DepartmentMutationResult } from "../types/api";

// ═══════ 学校管理 ═══════
export async function getSchoolList() {
  return request<SchoolItem[]>(`${BASE}/schools`, { headers: hdrs() });
}
export async function createSchool(body: CreateSchoolBody) {
  return request<SchoolMutationResult>(`${BASE}/schools`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}

// ═══════ 院系管理 ═══════
export async function getDepartmentList(school_id?: string) {
  const q = school_id ? `?school_id=${school_id}` : "";
  return request<DepartmentItem[]>(`${BASE}/departments${q}`, { headers: hdrs() });
}
export async function createDepartment(body: CreateDepartmentBody) {
  return request<DepartmentMutationResult>(`${BASE}/departments`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
import type { CreateDataStaffBody, DataStaffResult } from "../types/api";

export async function createDataStaff(body: CreateDataStaffBody) {
  return request<DataStaffResult>(`${BASE}/data-staff`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}

export async function toggleUserStatus(target_user_id: string, status: "NORMAL" | "LOCKED") {
  return request<{ user_id: string; uid: string; name: string; status: string }>(`${BASE}/users/${target_user_id}/status`, { method: "PUT", headers: hdrs(), body: JSON.stringify({ status }) });
}
import type { UserItem } from "../types/api";

export async function getUserList(params?: {
  page?: number; page_size?: number; role?: string; school_id?: string; department_id?: string;
}) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("page_size", String(params?.page_size ?? 100));
  if (params?.role) q.set("role", params.role);
  if (params?.school_id) q.set("school_id", params.school_id);
  if (params?.department_id) q.set("department_id", params.department_id);
  return request<PaginatedData<UserItem>>(`${BASE}/users?${q}`, { headers: hdrs() });
}
