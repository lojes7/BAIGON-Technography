// 百工谱 — 用户服务层
// 覆盖 8.1 当前用户资料 + 8.2 用户管理（仅 ADMIN）+ 组织目录查询。
import type {
  ApiResponse, PaginatedData, CurrentUser, ListUsersParams, OrganizationItem, MySkillsResult,
} from "../types/api";
import { parseJson } from "./lossless";

const BASE = "/api/auth";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
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
    throw new Error(`请求失败 (${res.status})`);
  }
  // 用 lossless 解析，避免雪花 ID（int64）被 JSON.parse 丢精度
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

function qs(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// ═══════════════ 8.1 当前用户资料 ═══════════════

// 查询当前用户资料（JWT 对应账号与校园归属）
export function getMe() {
  return request<CurrentUser>(`${BASE}/me`, { headers: hdrs() });
}

// 查询我的能力时间线（按识别时间返回全部历史技能记录，无记录时 items 为空数组）
export function listMySkills() {
  return request<MySkillsResult>(`${BASE}/me/skills`, { headers: hdrs() });
}

// ═══════════════ 8.2 用户管理（仅 ADMIN） ═══════════════

// 分页查询用户（POST + body）
export function listUsers(params?: ListUsersParams) {
  return request<PaginatedData<CurrentUser>>(`${BASE}/users`, {
    method: "POST",
    headers: hdrs(true),
    body: JSON.stringify({
      page: params?.page ?? 0,
      pageSize: params?.pageSize ?? 20,
      name: params?.name ?? "",
      role: params?.role ?? "",
      universityId: params?.universityId ?? 0,
      schoolId: params?.schoolId ?? 0,
      departmentId: params?.departmentId ?? 0,
    }),
  });
}

// 查询用户详情
export function getUserDetail(id: string | number) {
  return request<CurrentUser>(`${BASE}/users/${id}`, { headers: hdrs() });
}

// 封禁用户（幂等，重复封禁仍返回 200）
export function blockUser(id: string | number) {
  return request<CurrentUser>(`${BASE}/users/${id}/block`, { method: "POST", headers: hdrs() });
}

// 解封用户（幂等，重复解封仍返回 200）
export function unlockUser(id: string | number) {
  return request<CurrentUser>(`${BASE}/users/${id}/unlock`, { method: "POST", headers: hdrs() });
}

// ═══════════════ 组织目录查询 ═══════════════

// 高校列表（page/pageSize/keyword）
export function getUniversities(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return request<PaginatedData<OrganizationItem>>(`${BASE}/users/universities${qs(params ?? {})}`, { headers: hdrs() });
}

// 学院列表（可选 universityId 级联筛选）
export function getSchools(params?: { page?: number; pageSize?: number; keyword?: string; universityId?: number }) {
  return request<PaginatedData<OrganizationItem>>(`${BASE}/users/schools${qs(params ?? {})}`, { headers: hdrs() });
}

// 系部列表（可选 schoolId 级联筛选）
export function getDepartments(params?: { page?: number; pageSize?: number; keyword?: string; schoolId?: number }) {
  return request<PaginatedData<OrganizationItem>>(`${BASE}/users/departments${qs(params ?? {})}`, { headers: hdrs() });
}
