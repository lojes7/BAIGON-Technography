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

function positiveId(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${label}不是有效的正整数 ID`);
  }
  return normalized;
}

function nullableId(value: JsonId | null | undefined): string | null {
  return value === undefined || value === null || value === 0 || value === "0"
    ? null
    : positiveId(value, "可选资源 ID");
}

function nullableText(value: string | undefined): string | null {
  return value || null;
}

function uniqueIds(ids: Array<string | number>, label: string) {
  return Array.from(new Set(ids.map((id) => positiveId(id, label))));
}

function normalizeTask(raw: RawTaskSummary = {}): JobAnalysisTaskSummary {
  return {
    id: positiveId(raw.id, "岗位分析任务 ID"),
    jobId: positiveId(raw.jobId, "岗位 ID"),
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
    id: positiveId(raw.id, "职业候选 ID"),
    occupationId: positiveId(raw.occupationId, "职业 ID"),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeMajorCandidate(raw: RawMajorCandidate): JobAnalysisMajorCandidate {
  return {
    id: positiveId(raw.id, "专业候选 ID"),
    majorId: positiveId(raw.majorId, "专业 ID"),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeResult(raw: RawResult): JobAnalysisResult {
  return {
    id: positiveId(raw.id, "岗位分析结果 ID"),
    jobId: positiveId(raw.jobId, "岗位 ID"),
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
  label: string,
) {
  // Gateway 的 lookup 契约只接受 1 至 200 个正 int64；无效引用必须在浏览器端拦截，
  // 不能继续发出一个必然返回 400 的请求并掩盖真正的数据契约问题。
  const requestedIds = uniqueIds(ids, label);
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
  return lookupResource("", ids, normalizeTask, "岗位分析任务 ID");
}

export async function lookupJobAnalysisOccupationCandidates(ids: Array<string | number>) {
  return lookupResource("occupation-candidates", ids, normalizeCandidate, "职业候选 ID");
}

export async function lookupJobAnalysisMajorCandidates(ids: Array<string | number>) {
  return lookupResource("major-candidates", ids, normalizeMajorCandidate, "专业候选 ID");
}

export async function lookupJobAnalysisResults(ids: Array<string | number>) {
  return lookupResource("results", ids, normalizeResult, "岗位分析结果 ID");
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
  const ids = uniqueIds(index.data.ids ?? [], "岗位分析任务 ID");
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
  const taskId = positiveId(id, "岗位分析任务 ID");
  const response = await request<RawTaskDetail>(`${BASE}/${taskId}`, { headers: hdrs() });
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
  const taskId = positiveId(id, "岗位分析任务 ID");
  const normalizedBody = {
    ...body,
    majorId: positiveId(body.majorId, "专业 ID"),
    occupationId: positiveId(body.occupationId, "职业 ID"),
    skillReviews: body.skillReviews.map((item) => ({
      ...item,
      resultId: positiveId(item.resultId, "岗位分析结果 ID"),
    })),
  };
  const response = await request<{ id?: JsonId }>(`${BASE}/${taskId}/review`, {
    method: "PUT",
    headers: hdrs(true),
    body: stringifyNumericIdBody(normalizedBody, ["majorId", "occupationId", "resultId"]),
  });
  return {
    ...response,
    data: { id: positiveId(response.data.id, "岗位分析任务 ID") },
  } as ApiResponse<{ id: string }>;
}
