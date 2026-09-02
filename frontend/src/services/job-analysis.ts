import type {
  ApiResponse,
  JobAnalysisCandidate,
  JobAnalysisMajorCandidate,
  JobAnalysisResult,
  JobAnalysisTaskDetail,
  JobAnalysisTaskSummary,
  JobData,
  PaginatedData,
  ReviewJobAnalysisParams,
} from "../types/api";
import { HttpError } from "./http-error";
import { lookupJobs } from "./jobs";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/occupation/job-analysis";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

type JsonId = string | number;

export type JobAnalysisTaskStatus = "PENDING" | "SUCCESS" | "FAILED";
export type JobAnalysisReviewStatus = "PENDING" | "PASSED" | "REJECTED";

const JOB_ANALYSIS_TASK_STATUSES = new Set<JobAnalysisTaskStatus>(["PENDING", "SUCCESS", "FAILED"]);
const JOB_ANALYSIS_REVIEW_STATUSES = new Set<JobAnalysisReviewStatus>(["PENDING", "PASSED", "REJECTED"]);

interface RawTaskSummary {
  id?: JsonId;
  jobId?: JsonId;
  taskStatus?: string;
  reviewStatus?: string;
  selectedOccupationId?: JsonId;
  attempts?: number;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: JsonId;
  occupationAnalysisStatus?: string;
  jdAnalysisStatus?: string;
  selectedMajorId?: JsonId;
  majorAnalysisStatus?: string;
}

interface RawTaskDetail extends RawTaskSummary {
  candidateIds?: JsonId[];
  majorCandidateIds?: JsonId[];
  resultIds?: JsonId[];
}

interface RawCandidate {
  id?: JsonId;
  occupationId?: JsonId;
  rank?: number;
  similarity?: number;
}

interface RawMajorCandidate {
  id?: JsonId;
  majorId?: JsonId;
  rank?: number;
  similarity?: number;
}

interface RawResult {
  id?: JsonId;
  jobId?: JsonId;
  skillName?: string;
  skillProficiency?: string;
  evidence?: string;
  rank?: number;
  reviewStatus?: string;
  reviewAction?: string;
  reviewedSkillName?: string;
  reviewedSkillProficiency?: string;
  reviewedEvidence?: string;
  reviewedAt?: string;
  reviewedBy?: JsonId;
}

interface RawLookupData<T> {
  items?: T[];
  missingIds?: JsonId[];
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }
  if (!res.ok) throw new HttpError(res.status);
  return parseJson(await res.text()) as ApiResponse<T>;
}

function nullableId(value: JsonId | undefined): string | null {
  return value === undefined || value === 0 || value === "0" ? null : String(value);
}

function nullableText(value: string | undefined): string | null {
  return value || null;
}

function uniqueIds(ids: Array<string | number>) {
  return Array.from(new Set(ids.map(String).filter(Boolean)));
}

function normalizeTask(raw: RawTaskSummary = {}): JobAnalysisTaskSummary {
  return {
    id: String(raw.id ?? ""),
    jobId: String(raw.jobId ?? ""),
    taskStatus: raw.taskStatus ?? "",
    reviewStatus: raw.reviewStatus ?? "",
    selectedOccupationId: nullableId(raw.selectedOccupationId),
    attempts: raw.attempts ?? 0,
    createdAt: raw.createdAt ?? "",
    reviewedAt: nullableText(raw.reviewedAt),
    reviewedBy: nullableId(raw.reviewedBy),
    occupationAnalysisStatus: raw.occupationAnalysisStatus ?? "",
    jdAnalysisStatus: raw.jdAnalysisStatus ?? "",
    selectedMajorId: nullableId(raw.selectedMajorId),
    majorAnalysisStatus: raw.majorAnalysisStatus ?? "",
  };
}

function normalizeCandidate(raw: RawCandidate): JobAnalysisCandidate {
  return {
    id: String(raw.id ?? ""),
    occupationId: String(raw.occupationId ?? ""),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeMajorCandidate(raw: RawMajorCandidate): JobAnalysisMajorCandidate {
  return {
    id: String(raw.id ?? ""),
    majorId: String(raw.majorId ?? ""),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeResult(raw: RawResult): JobAnalysisResult {
  return {
    id: String(raw.id ?? ""),
    jobId: String(raw.jobId ?? ""),
    skillName: raw.skillName ?? "",
    skillProficiency: raw.skillProficiency ?? "",
    evidence: raw.evidence ?? "",
    rank: raw.rank ?? 0,
    reviewStatus: raw.reviewStatus ?? "",
    reviewAction: raw.reviewAction ?? "",
    reviewedSkillName: raw.reviewedSkillName ?? "",
    reviewedSkillProficiency: raw.reviewedSkillProficiency ?? "",
    reviewedEvidence: raw.reviewedEvidence ?? "",
    reviewedAt: nullableText(raw.reviewedAt),
    reviewedBy: nullableId(raw.reviewedBy),
  };
}

async function lookupResource<R, T extends { id: string }>(
  path: string,
  ids: Array<string | number>,
  normalize: (raw: R) => T,
) {
  const requestedIds = uniqueIds(ids);
  if (requestedIds.length === 0) return [];
  const suffix = path ? `/${path}` : "";
  const response = await request<RawLookupData<R>>(`${BASE}${suffix}/lookup`, {
    method: "POST",
    headers: hdrs(true),
    body: stringifyNumericIdBody({ ids: requestedIds }, [], ["ids"]),
  });
  const items = (response.data.items ?? []).map(normalize);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return requestedIds.flatMap((id) => itemById.get(id) ?? []);
}

export async function lookupJobAnalysisTasks(ids: Array<string | number>) {
  return lookupResource("", ids, normalizeTask);
}

export async function lookupJobAnalysisOccupationCandidates(ids: Array<string | number>) {
  return lookupResource("occupation-candidates", ids, normalizeCandidate);
}

export async function lookupJobAnalysisMajorCandidates(ids: Array<string | number>) {
  return lookupResource("major-candidates", ids, normalizeMajorCandidate);
}

export async function lookupJobAnalysisResults(ids: Array<string | number>) {
  return lookupResource("results", ids, normalizeResult);
}

// 列表只取当前服务端页，再按 ID 批量补齐任务摘要，禁止前端扫描全部分页。
export async function listJobAnalysisTasks(params?: {
  page?: number;
  pageSize?: number;
  taskStatus?: JobAnalysisTaskStatus;
  reviewStatus?: JobAnalysisReviewStatus;
}) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.taskStatus) {
    // 岗位分析使用通用 TaskStatus，后端没有 RUNNING；前端不得发送跨域枚举。
    if (!JOB_ANALYSIS_TASK_STATUSES.has(params.taskStatus)) {
      throw new Error(`不支持的岗位分析任务状态：${params.taskStatus}`);
    }
    query.set("taskStatus", params.taskStatus);
  }
  if (params?.reviewStatus) {
    if (!JOB_ANALYSIS_REVIEW_STATUSES.has(params.reviewStatus)) {
      throw new Error(`不支持的岗位分析审核状态：${params.reviewStatus}`);
    }
    query.set("reviewStatus", params.reviewStatus);
  }

  const index = await request<{ ids?: JsonId[]; total?: number; page?: number; pageSize?: number }>(
    `${BASE}?${query}`,
    { headers: hdrs() },
  );
  const ids = (index.data.ids ?? []).map(String);
  const items = await lookupJobAnalysisTasks(ids);
  const jobs = await lookupJobs(items.map((item) => item.jobId));
  return {
    code: index.code,
    data: {
      items,
      jobs: jobs.data.items,
      total: Number(index.data.total ?? 0),
      page: Number(index.data.page ?? 0),
      pageSize: Number(index.data.pageSize ?? 20),
    },
  } as ApiResponse<PaginatedData<JobAnalysisTaskSummary> & { jobs: JobData[] }>;
}

// 任务详情只携带资源 ID；候选与结果分别通过批量详情接口解析。
export async function getJobAnalysisTask(id: string | number) {
  const response = await request<RawTaskDetail>(`${BASE}/${id}`, { headers: hdrs() });
  const raw = response.data;
  const [candidates, majorCandidates, results, jobs] = await Promise.all([
    lookupJobAnalysisOccupationCandidates((raw.candidateIds ?? []).map(String)),
    lookupJobAnalysisMajorCandidates((raw.majorCandidateIds ?? []).map(String)),
    lookupJobAnalysisResults((raw.resultIds ?? []).map(String)),
    lookupJobs(raw.jobId ? [raw.jobId] : []),
  ]);
  return {
    ...response,
    data: {
      task: normalizeTask(raw),
      job: jobs.data.items[0] ?? null,
      candidates,
      majorCandidates,
      results,
    },
  } as ApiResponse<JobAnalysisTaskDetail>;
}

// 写接口只返回任务引用；页面在成功后显式刷新所需详情或当前列表页。
export async function reviewJobAnalysisTask(id: string | number, body: ReviewJobAnalysisParams) {
  const response = await request<{ id?: JsonId }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    body: stringifyNumericIdBody(body, ["majorId", "occupationId", "resultId"]),
  });
  return { ...response, data: { id: String(response.data.id ?? "") } } as ApiResponse<{ id: string }>;
}
