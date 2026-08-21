import type { ApiResponse, AnalysisRequest, AnalysisResult } from "../types/api";

import { parseJson } from "./lossless";

const BASE = "/api/student";
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("baigon_token")}` });

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

// 学生能力分析（旧端点；简历相关接口已迁移至 services/resume.ts 对接 /api/auth/resumes）
export async function runAnalysis(body: AnalysisRequest) {
  return request<AnalysisResult>(`${BASE}/analysis`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
