import type {
  ApiResponse,
  CanonicalSkillDetail,
  CanonicalSkillItem,
  CanonicalSkillLookupItem,
  JobSkillData,
  JobSkillResolutionCandidate,
  JobSkillResolutionTaskDetail,
  JobSkillResolutionTaskSummary,
  PaginatedData,
  ReviewJobSkillResolutionParams,
  SkillRelationDirection,
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

interface RawCanonicalSkill {
  id?: JsonId;
  name?: string;
  is_embed?: boolean;
}

interface RawCanonicalSkillDetail {
  skill?: RawCanonicalSkill;
  parentSkillIds?: JsonId[];
  childSkillIds?: JsonId[];
}

interface RawJobSkill {
  id?: JsonId;
  skill_id?: JsonId;
  skill_name?: string;
  skill_proficiency?: string;
  evidence?: string;
  parent_skill_ids?: JsonId[];
  child_skill_ids?: JsonId[];
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

// 所有规范技能 ID 都在 service 边界转为字符串，避免调用方误用 JS Number。
function normalizeCanonicalSkill(raw: RawCanonicalSkill = {}): CanonicalSkillItem {
  return {
    id: String(raw.id ?? ""),
    name: raw.name ?? "",
    is_embed: raw.is_embed ?? false,
  };
}

function normalizeJobSkill(raw: RawJobSkill = {}): JobSkillData {
  return {
    id: String(raw.id ?? ""),
    skillId: nullableId(raw.skill_id),
    skillName: raw.skill_name ?? "",
    skillProficiency: raw.skill_proficiency ?? "",
    evidence: raw.evidence ?? "",
    parentSkillIds: (raw.parent_skill_ids ?? []).map(String),
    childSkillIds: (raw.child_skill_ids ?? []).map(String),
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

export async function listSkillResolutionSimilarSkills(id: string | number) {
  const response = await request<{ items?: RawCandidate[] }>(
    `${BASE}/${id}/similar-skills`,
    { headers: hdrs() },
  );
  return {
    ...response,
    data: {
      items: (response.data.items ?? []).map(normalizeCandidate),
    },
  } as ApiResponse<{ items: JobSkillResolutionCandidate[] }>;
}

export async function reviewSkillResolutionTask(id: string | number, body: ReviewJobSkillResolutionParams) {
  const payload = body.resolutionAction === "CREATE_NEW"
    ? {
        resolutionAction: body.resolutionAction,
        skillId: 0,
        newSkillName: body.newSkillName.trim(),
        parentSkillIds: body.parentSkillIds ?? [],
      }
    : { resolutionAction: body.resolutionAction, skillId: body.skillId, newSkillName: "" };
  const response = await request<{ resolution?: RawTaskDetail }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    // skillId 是 int64，保留字符串精度后再无损转成 JSON 数字字面量。
    body: stringifyNumericIdBody(payload, ["skillId"], ["parentSkillIds"]),
  });
  return {
    ...response,
    data: { resolution: normalizeDetail(response.data.resolution) },
  } as ApiResponse<{ resolution: JobSkillResolutionTaskDetail }>;
}

export async function searchCanonicalSkills(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.keyword?.trim()) query.set("keyword", params.keyword.trim());
  const response = await request<PaginatedData<RawCanonicalSkill>>(
    `${SKILLS_BASE}?${query}`,
    { headers: hdrs() },
  );
  return {
    ...response,
    data: {
      ...response.data,
      items: (response.data.items ?? []).map(normalizeCanonicalSkill),
      total: Number(response.data.total ?? 0),
      page: Number(response.data.page ?? 0),
      pageSize: Number(response.data.pageSize ?? 20),
    },
  } as ApiResponse<PaginatedData<CanonicalSkillItem>>;
}

export async function getCanonicalSkillDetail(id: string | number) {
  const response = await request<RawCanonicalSkillDetail>(`${SKILLS_BASE}/${id}`, { headers: hdrs() });
  return {
    ...response,
    data: {
      skill: normalizeCanonicalSkill(response.data.skill),
      parentSkillIds: (response.data.parentSkillIds ?? []).map(String),
      childSkillIds: (response.data.childSkillIds ?? []).map(String),
    },
  } as ApiResponse<CanonicalSkillDetail>;
}

export async function lookupCanonicalSkills(skillIds: Array<string | number>) {
  const uniqueIds = Array.from(new Map(skillIds.map((id) => [String(id), id])).values());
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [] } } as ApiResponse<{ items: CanonicalSkillLookupItem[] }>;
  }

  // Gateway 单次最多接收 200 个 ID；超出时在客户端分批并合并结果。
  const requests: Array<Promise<ApiResponse<{ items: RawCanonicalSkill[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items: RawCanonicalSkill[] }>(`${SKILLS_BASE}/lookup`, {
      method: "POST",
      headers: hdrs(true),
      body: stringifyNumericIdBody({ skillIds: batch }, [], ["skillIds"]),
    }));
  }
  const responses = await Promise.all(requests);
  return {
    code: 200,
    data: {
      items: responses
        .flatMap((response) => response.data.items ?? [])
        .map((skill) => {
          const normalized = normalizeCanonicalSkill(skill);
          return { id: normalized.id, name: normalized.name };
        }),
    },
  } as ApiResponse<{ items: CanonicalSkillLookupItem[] }>;
}

export function addCanonicalSkillRelation(
  skillId: string | number,
  direction: SkillRelationDirection,
  relatedSkillId: string | number,
) {
  return request<unknown>(`${SKILLS_BASE}/${skillId}/relations/${direction}`, {
    method: "POST",
    headers: hdrs(true),
    body: stringifyNumericIdBody({ relatedSkillId }, ["relatedSkillId"]),
  });
}

export function deleteCanonicalSkillRelation(
  skillId: string | number,
  direction: SkillRelationDirection,
  relatedSkillId: string | number,
) {
  return request<unknown>(`${SKILLS_BASE}/${skillId}/relations/${direction}/${relatedSkillId}`, {
    method: "DELETE",
    headers: hdrs(),
  });
}
