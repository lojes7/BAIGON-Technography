import type {
  ApiResponse,
  CanonicalSkillItem,
  JobSkillData,
  JobSkillResolutionCandidate,
  JobSkillResolutionTaskDetail,
  JobSkillResolutionTaskSummary,
  PaginatedData,
  ReviewJobSkillResolutionParams,
} from "../../types/api";
import { HttpError } from "../http-error";
import { parseJson, stringifyNumericIdBody } from "../lossless";

const BASE = "/api/auth/occupation/job-skill-resolution";
const SKILLS_BASE = "/api/auth/occupation/skills";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

type JsonId = string | number;

interface RawTaskSummary {
  id?: JsonId;
  job_skill_id?: JsonId;
  job_id?: JsonId;
  trace_id?: JsonId;
  skill_name?: string;
  task_status?: string;
  review_status?: string;
  resolution_action?: string;
  selected_skill_id?: JsonId;
  model_name?: string;
  error_msg?: string;
  attempts?: number;
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: JsonId;
}

interface RawCandidate {
  skill_id?: JsonId;
  skill_name?: string;
  rank?: number;
  similarity?: number;
}

interface RawJobSkill {
  id?: JsonId;
  skill_id?: JsonId;
  skill_name?: string;
  skill_proficiency?: string;
  evidence?: string;
}

interface RawTaskDetail {
  task?: RawTaskSummary;
  job_skill?: RawJobSkill;
  candidates?: RawCandidate[];
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

// 归一审核接口直接返回 protobuf 对象，统一在 service 边界转换字段命名。
function normalizeTask(raw: RawTaskSummary = {}): JobSkillResolutionTaskSummary {
  return {
    id: String(raw.id ?? ""),
    jobSkillId: String(raw.job_skill_id ?? ""),
    jobId: String(raw.job_id ?? ""),
    traceId: String(raw.trace_id ?? ""),
    skillName: raw.skill_name ?? "",
    taskStatus: raw.task_status ?? "",
    reviewStatus: raw.review_status ?? "",
    resolutionAction: raw.resolution_action ?? "",
    selectedSkillId: nullableId(raw.selected_skill_id),
    modelName: raw.model_name ?? "",
    errorMsg: raw.error_msg ?? "",
    attempts: raw.attempts ?? 0,
    createdAt: raw.created_at ?? "",
    reviewedAt: raw.reviewed_at || null,
    reviewedBy: nullableId(raw.reviewed_by),
  };
}

function normalizeCandidate(raw: RawCandidate): JobSkillResolutionCandidate {
  return {
    skillId: String(raw.skill_id ?? ""),
    skillName: raw.skill_name ?? "",
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeJobSkill(raw: RawJobSkill = {}): JobSkillData {
  return {
    id: String(raw.id ?? ""),
    skillId: nullableId(raw.skill_id),
    skillName: raw.skill_name ?? "",
    skillProficiency: raw.skill_proficiency ?? "",
    evidence: raw.evidence ?? "",
  };
}

function normalizeDetail(raw: RawTaskDetail = {}): JobSkillResolutionTaskDetail {
  return {
    task: normalizeTask(raw.task),
    jobSkill: normalizeJobSkill(raw.job_skill),
    candidates: (raw.candidates ?? []).map(normalizeCandidate),
  };
}

export async function listSkillResolutionTasks(params?: {
  page?: number;
  pageSize?: number;
  taskStatus?: string;
  reviewStatus?: string;
}) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.taskStatus) query.set("taskStatus", params.taskStatus);
  if (params?.reviewStatus) query.set("reviewStatus", params.reviewStatus);

  const response = await request<{
    items?: RawTaskSummary[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(`${BASE}?${query}`, { headers: hdrs() });
  const data = response.data;
  return {
    ...response,
    data: {
      items: (data.items ?? []).map(normalizeTask),
      total: Number(data.total ?? 0),
      page: data.page ?? 0,
      pageSize: data.pageSize ?? 20,
    },
  } as ApiResponse<PaginatedData<JobSkillResolutionTaskSummary>>;
}

export async function getSkillResolutionTask(id: string | number) {
  const response = await request<{ resolution?: RawTaskDetail }>(`${BASE}/${id}`, { headers: hdrs() });
  return {
    ...response,
    data: { resolution: normalizeDetail(response.data.resolution) },
  } as ApiResponse<{ resolution: JobSkillResolutionTaskDetail }>;
}

export async function reviewSkillResolutionTask(id: string | number, body: ReviewJobSkillResolutionParams) {
  const payload = body.resolutionAction === "CREATE_NEW"
    ? { resolutionAction: body.resolutionAction, skillId: 0, newSkillName: body.newSkillName.trim() }
    : { resolutionAction: body.resolutionAction, skillId: body.skillId, newSkillName: "" };
  const response = await request<{ resolution?: RawTaskDetail }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    // skillId 是 int64，保留字符串精度后再无损转成 JSON 数字字面量。
    body: stringifyNumericIdBody(payload, ["skillId"]),
  });
  return {
    ...response,
    data: { resolution: normalizeDetail(response.data.resolution) },
  } as ApiResponse<{ resolution: JobSkillResolutionTaskDetail }>;
}

export function searchCanonicalSkills(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.keyword?.trim()) query.set("keyword", params.keyword.trim());
  return request<PaginatedData<CanonicalSkillItem>>(`${SKILLS_BASE}?${query}`, { headers: hdrs() });
}
