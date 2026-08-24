import type {
  ApiResponse, ResumeData, CreateResumeUploadParams, ResumeUploadUrlResult, CompleteResumeUploadParams, EditMyResumeParams,
  AnalyzeResumeSkillsResult,
} from "../types/api";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/resumes";
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
    // 413 文件超限；其余统一按状态码提示
    const msg = res.status === 413 ? "文件超过 10 MiB 大小限制" : `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// 查询我的简历（仅保留最新一份；无简历时 data 为空对象）
export function getMyResume() {
  return request<ResumeData>(BASE, { headers: hdrs() });
}

// 创建简历直传地址（PDF / DOCX，最大 10 MiB）
export function createResumeUploadUrl(params: CreateResumeUploadParams) {
  return request<ResumeUploadUrlResult>(`${BASE}/upload-url`, {
    method: "POST",
    headers: hdrs(true),
    body: JSON.stringify(params),
  });
}

// 完成上传并结构化分析（前端直传 MinIO 后调用；同步 OCR + 结构化 + 校验五类字段）
export function completeResumeUpload(params: CompleteResumeUploadParams) {
  return request<ResumeData>(`${BASE}/upload-complete`, {
    method: "POST",
    headers: hdrs(true),
    // uploadId 为雪花 ID，必须作为 JSON 数字回传（int64 不接受字符串）
    body: stringifyNumericIdBody(params, ["uploadId"]),
  });
}

// 编辑我的简历
export function editMyResume(params: EditMyResumeParams) {
  return request<ResumeData>(BASE, {
    method: "PUT",
    headers: hdrs(true),
    body: JSON.stringify(params),
  });
}

export function analyzeMyResumeSkills() {
  return request<AnalyzeResumeSkillsResult>(`${BASE}/analyze-skills`, {
    method: "POST",
    headers: hdrs(),
  });
}
