import type { ApiResponse, ImportResult } from "../types/api";

const BASE = "/api/student-affair";

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail?.[0]?.msg || `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function importUsers(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<ImportResult>(`${BASE}/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("baigon_token")}` },
    body: form,
  });
}
