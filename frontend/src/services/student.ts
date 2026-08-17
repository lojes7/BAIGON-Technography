import type { ApiResponse, ResumeItem, ResumeUploadResult, ResumeDetail, UpdateResumeBody, AnalysisRequest, AnalysisResult } from "../types/api";

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

export async function getResumeList() {
  return request<ResumeItem[]>(`${BASE}/resume`, { headers: authHeader() });
}

export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<ResumeUploadResult>(`${BASE}/resume`, { method: "POST", headers: authHeader(), body: form });
}

export async function getResumeDetail(resumeId: string) {
  return request<ResumeDetail>(`${BASE}/resume/${resumeId}`, { headers: authHeader() });
}

export async function updateResume(resumeId: string, body: UpdateResumeBody) {
  return request<ResumeDetail>(`${BASE}/resume/${resumeId}`, { method: "PUT", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function confirmResume(resumeId: string) {
  return request<ResumeDetail>(`${BASE}/resume/${resumeId}/confirm`, { method: "POST", headers: authHeader() });
}

export async function runAnalysis(body: AnalysisRequest) {
  return request<AnalysisResult>(`${BASE}/analysis`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
