import type { ApiResponse, PaginatedData, AiAnalysisItem } from "../types/api";

const BASE = "/api/reviewer";
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
  return res.json();
}

export async function getAiAnalyses(page = 1, page_size = 20) {
  return request<PaginatedData<AiAnalysisItem>>(
    `${BASE}/ai-analyses?page=${page}&page_size=${page_size}`,
    { headers: hdrs() },
  );
}
