import type {
  ApiResponse,
  JobAnalysisCandidate,
  JobAnalysisMajorCandidate,
  JobAnalysisResult,
  JobAnalysisTaskDetail,
  JobAnalysisTaskSummary,
  PaginatedData,
  ReviewJobAnalysisParams,
} from "../types/api";
import { HttpError } from "./http-error";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/occupation/job-analysis";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

type JsonId = string | number;

interface RawTaskSummary {
  id?: JsonId;
  job_id?: JsonId;
  trace_id?: JsonId;
  job_name?: string;
  task_status?: string;
  review_status?: string;
  selected_occupation_id?: JsonId;
  selected_occupation_name?: string;
  model_name?: string;
  error_msg?: string;
  attempts?: number;
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: JsonId;
  occupation_analysis_status?: string;
  jd_analysis_status?: string;
  job_major?: string;
  selected_major_id?: JsonId;
  selected_major_name?: string;
  major_analysis_status?: string;
}

interface RawCandidate {
  occupation_id?: JsonId;
  occupation_name?: string;
  rank?: number;
  similarity?: number;
}

interface RawMajorCandidate {
  major_id?: JsonId;
  major_name?: string;
  rank?: number;
  similarity?: number;
}

interface RawResult {
  id?: JsonId;
  job_id?: JsonId;
  skill_name?: string;
  skill_proficiency?: string;
  evidence?: string;
  rank?: number;
  review_status?: string;
  review_action?: string;
  reviewed_skill_name?: string;
  reviewed_skill_proficiency?: string;
  reviewed_evidence?: string;
  reviewed_at?: string;
  reviewed_by?: JsonId;
}

interface RawTaskDetail {
  task?: RawTaskSummary;
  candidates?: RawCandidate[];
  major_candidates?: RawMajorCandidate[];
  results?: RawResult[];
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }
  if (!res.ok) {
    throw new HttpError(res.status);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

function nullableId(value: JsonId | undefined): JsonId | null {
  return value === undefined || value === 0 || value === "0" ? null : value;
}

function nullableText(value: string | undefined): string | null {
  return value ? value : null;
}

// Gateway 当前直接序列化 protobuf 详情，内部字段为 snake_case；在 service 边界统一转为页面使用的 camelCase。
function normalizeTask(raw: RawTaskSummary = {}): JobAnalysisTaskSummary {
  return {
    id: String(raw.id ?? ""),
    jobId: String(raw.job_id ?? ""),
    traceId: String(raw.trace_id ?? ""),
    jobName: raw.job_name ?? "",
    taskStatus: raw.task_status ?? "",
    reviewStatus: raw.review_status ?? "",
    selectedOccupationId: nullableId(raw.selected_occupation_id),
    selectedOccupationName: raw.selected_occupation_name ?? "",
    modelName: raw.model_name ?? "",
    errorMsg: raw.error_msg ?? "",
    attempts: raw.attempts ?? 0,
    createdAt: raw.created_at ?? "",
    reviewedAt: nullableText(raw.reviewed_at),
    reviewedBy: nullableId(raw.reviewed_by),
    occupationAnalysisStatus: raw.occupation_analysis_status ?? "",
    jdAnalysisStatus: raw.jd_analysis_status ?? "",
    jobMajor: raw.job_major ?? "",
    selectedMajorId: nullableId(raw.selected_major_id),
    selectedMajorName: raw.selected_major_name ?? "",
    majorAnalysisStatus: raw.major_analysis_status ?? "",
  };
}

function normalizeCandidate(raw: RawCandidate): JobAnalysisCandidate {
  return {
    occupationId: String(raw.occupation_id ?? ""),
    occupationName: raw.occupation_name ?? "",
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeMajorCandidate(raw: RawMajorCandidate): JobAnalysisMajorCandidate {
  return {
    majorId: String(raw.major_id ?? ""),
    majorName: raw.major_name ?? "",
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeResult(raw: RawResult): JobAnalysisResult {
  return {
    id: String(raw.id ?? ""),
    jobId: String(raw.job_id ?? ""),
    skillName: raw.skill_name ?? "",
    skillProficiency: raw.skill_proficiency ?? "",
    evidence: raw.evidence ?? "",
    rank: raw.rank ?? 0,
    reviewStatus: raw.review_status ?? "",
    reviewAction: raw.review_action ?? "",
    reviewedSkillName: raw.reviewed_skill_name ?? "",
    reviewedSkillProficiency: raw.reviewed_skill_proficiency ?? "",
    reviewedEvidence: raw.reviewed_evidence ?? "",
    reviewedAt: nullableText(raw.reviewed_at),
    reviewedBy: nullableId(raw.reviewed_by),
  };
}

function normalizeDetail(raw: RawTaskDetail = {}): JobAnalysisTaskDetail {
  return {
    task: normalizeTask(raw.task),
    candidates: (raw.candidates ?? []).map(normalizeCandidate),
    majorCandidates: (raw.major_candidates ?? []).map(normalizeMajorCandidate),
    results: (raw.results ?? []).map(normalizeResult),
  };
}

// 分页查询岗位分析任务（page 从 0 开始；reviewStatus 可选 PENDING / PASSED / REJECTED）。
export async function listJobAnalysisTasks(params?: { page?: number; pageSize?: number; reviewStatus?: string }) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 0));
  q.set("pageSize", String(params?.pageSize ?? 20));
  if (params?.reviewStatus) q.set("reviewStatus", params.reviewStatus);

  const response = await request<{
    items?: RawTaskSummary[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(`${BASE}?${q}`, { headers: hdrs() });
  const data = response.data;
  return {
    ...response,
    data: {
      items: (data.items ?? []).map(normalizeTask),
      total: Number(data.total ?? 0),
      page: data.page ?? 0,
      pageSize: data.pageSize ?? 20,
    },
  } as ApiResponse<PaginatedData<JobAnalysisTaskSummary>>;
}

// 查询岗位分析任务详情（任务 + 专业候选 + 职业候选 + 技能结果）。
export async function getJobAnalysisTask(id: string | number) {
  const response = await request<{ analysis?: RawTaskDetail }>(`${BASE}/${id}`, { headers: hdrs() });
  return {
    ...response,
    data: { analysis: normalizeDetail(response.data.analysis) },
  } as ApiResponse<{ analysis: JobAnalysisTaskDetail }>;
}

// 审核岗位专业、职业与技能分析。
export async function reviewJobAnalysisTask(id: string | number, body: ReviewJobAnalysisParams) {
  const response = await request<{ analysis?: RawTaskDetail }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    // 雪花 ID 必须作为 JSON 数字回传，不能直接用 Number 转换。
    body: stringifyNumericIdBody(body, ["majorId", "occupationId", "resultId"]),
  });
  return {
    ...response,
    data: { analysis: normalizeDetail(response.data.analysis) },
  } as ApiResponse<{ analysis: JobAnalysisTaskDetail }>;
}
