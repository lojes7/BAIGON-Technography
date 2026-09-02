import type {
  ApiResponse,
  CanonicalSkillItem,
  CanonicalSkillLookupData,
  CanonicalSkillRelations,
  JobSkillData,
  JobSkillResolutionCandidate,
  JobSkillResolutionSimilarSkill,
  JobSkillResolutionTaskDetail,
  JobSkillResolutionTaskSummary,
  PaginatedData,
  PaginatedIds,
  ReviewJobSkillResolutionParams,
  SkillRelationDirection,
} from "../../types/api";
import { HttpError } from "../http-error";
import { lookupJobSkills } from "../jobs";
import { parseJson, stringifyNumericIdBody } from "../lossless";

const BASE = "/api/auth/occupation/job-skill-resolution";
const SKILLS_BASE = "/api/auth/occupation/skills";
const hdrs = (hasBody = false) => ({
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

type JsonId = string | number;

export type SkillResolutionTaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type SkillResolutionReviewStatus = "PENDING" | "PASSED";

const SKILL_RESOLUTION_TASK_STATUSES = new Set<SkillResolutionTaskStatus>([
  "PENDING", "RUNNING", "SUCCESS", "FAILED",
]);
const SKILL_RESOLUTION_REVIEW_STATUSES = new Set<SkillResolutionReviewStatus>(["PENDING", "PASSED"]);

interface RawTaskSummary {
  id?: JsonId;
  jobSkillId?: JsonId;
  taskStatus?: string;
  reviewStatus?: string;
  resolutionAction?: string;
  selectedSkillId?: JsonId | null;
  attempts?: number;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: JsonId | null;
}

interface RawCandidate {
  id?: JsonId;
  skillId?: JsonId;
  rank?: number;
  similarity?: number;
}

interface RawSimilarSkill {
  skillId?: JsonId;
  rank?: number;
  similarity?: number;
}

interface RawCanonicalSkill {
  id?: JsonId;
  name?: string;
  isEmbed?: boolean;
}

interface RawCanonicalSkillRelations {
  skillIds?: JsonId[];
}

interface RawTaskDetail extends RawTaskSummary {
  candidateIds?: JsonId[];
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

function nullableStringId(value: JsonId | null | undefined): string | null {
  // Gateway 的可空 ID 会返回 JSON null，不能把它转成会被再次提交的字符串 "null"。
  return value == null || value === 0 || value === "0" || value === "" ? null : String(value);
}

function uniqueIds(ids: Array<string | number>) {
  return Array.from(new Set(ids.map(String).filter(Boolean)));
}

// 任务摘要只保留任务自身字段与岗位技能引用，不再复制岗位技能正文。
function normalizeTask(raw: RawTaskSummary = {}): JobSkillResolutionTaskSummary {
  return {
    id: String(raw.id ?? ""),
    jobSkillId: String(raw.jobSkillId ?? ""),
    taskStatus: raw.taskStatus ?? "",
    reviewStatus: raw.reviewStatus ?? "",
    resolutionAction: raw.resolutionAction ?? "",
    selectedSkillId: nullableStringId(raw.selectedSkillId),
    attempts: raw.attempts ?? 0,
    createdAt: raw.createdAt ?? "",
    reviewedAt: raw.reviewedAt || null,
    reviewedBy: nullableStringId(raw.reviewedBy),
  };
}

function normalizeCandidate(raw: RawCandidate): JobSkillResolutionCandidate {
  return {
    id: String(raw.id ?? ""),
    skillId: String(raw.skillId ?? ""),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

function normalizeSimilarSkill(raw: RawSimilarSkill): JobSkillResolutionSimilarSkill {
  return {
    skillId: String(raw.skillId ?? ""),
    rank: raw.rank ?? 0,
    similarity: raw.similarity ?? 0,
  };
}

// 所有规范技能 ID 都在 service 边界转为字符串，避免调用方误用 JS Number。
function normalizeCanonicalSkill(raw: RawCanonicalSkill = {}): CanonicalSkillItem {
  return {
    id: String(raw.id ?? ""),
    name: raw.name ?? "",
    isEmbed: raw.isEmbed ?? false,
  };
}

async function lookupTaskSummaries(ids: Array<string | number>) {
  const requestedIds = uniqueIds(ids);
  if (requestedIds.length === 0) return [];
  const response = await request<{ items?: RawTaskSummary[]; missingIds?: JsonId[] }>(`${BASE}/lookup`, {
    method: "POST",
    headers: hdrs(true),
    body: stringifyNumericIdBody({ ids: requestedIds }, [], ["ids"]),
  });
  const items = (response.data.items ?? []).map(normalizeTask);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return requestedIds.flatMap((id) => itemById.get(id) ?? []);
}

export async function lookupSkillResolutionCandidates(ids: Array<string | number>) {
  const requestedIds = uniqueIds(ids);
  if (requestedIds.length === 0) return [];
  const response = await request<{ items?: RawCandidate[]; missingIds?: JsonId[] }>(`${BASE}/candidates/lookup`, {
    method: "POST",
    headers: hdrs(true),
    body: stringifyNumericIdBody({ ids: requestedIds }, [], ["ids"]),
  });
  const items = (response.data.items ?? []).map(normalizeCandidate);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return requestedIds.flatMap((id) => itemById.get(id) ?? []);
}

export async function listSkillResolutionTasks(params?: {
  page?: number;
  pageSize?: number;
  taskStatus?: SkillResolutionTaskStatus;
  reviewStatus?: SkillResolutionReviewStatus;
}) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.taskStatus) {
    if (!SKILL_RESOLUTION_TASK_STATUSES.has(params.taskStatus)) {
      throw new Error(`不支持的技能归一任务状态：${params.taskStatus}`);
    }
    query.set("taskStatus", params.taskStatus);
  }
  if (params?.reviewStatus) {
    // 技能归一只有待审核和已通过，不支持岗位分析域的 REJECTED。
    if (!SKILL_RESOLUTION_REVIEW_STATUSES.has(params.reviewStatus)) {
      throw new Error(`不支持的技能归一审核状态：${params.reviewStatus}`);
    }
    query.set("reviewStatus", params.reviewStatus);
  }

  const index = await request<{
    ids?: JsonId[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(`${BASE}?${query}`, { headers: hdrs() });
  const ids = (index.data.ids ?? []).map(String);
  const items = await lookupTaskSummaries(ids);
  // 岗位技能原始文本统一从公开岗位技能批量详情获取，不由归一任务复制。
  const jobSkills = await lookupJobSkills(items.map((item) => item.jobSkillId));
  return {
    code: index.code,
    data: {
      items,
      jobSkills: jobSkills.data.items,
      total: Number(index.data.total ?? 0),
      page: Number(index.data.page ?? 0),
      pageSize: Number(index.data.pageSize ?? 20),
    },
  } as ApiResponse<PaginatedData<JobSkillResolutionTaskSummary> & { jobSkills: JobSkillData[] }>;
}

export async function getSkillResolutionTask(id: string | number) {
  const response = await request<RawTaskDetail>(`${BASE}/${id}`, { headers: hdrs() });
  const task = normalizeTask(response.data);
  const [candidates, jobSkills] = await Promise.all([
    lookupSkillResolutionCandidates((response.data.candidateIds ?? []).map(String)),
    lookupJobSkills([task.jobSkillId]),
  ]);
  const canonicalSkills = await lookupCanonicalSkills([
    ...candidates.map((candidate) => candidate.skillId),
    ...(task.selectedSkillId ? [task.selectedSkillId] : []),
  ]);
  const jobSkill = jobSkills.data.items[0] ?? {
    id: task.jobSkillId,
    jobId: "",
    skillId: null,
    skillName: "",
    skillProficiency: "",
    evidence: "",
  };
  return {
    ...response,
    data: {
      task,
      jobSkill,
      candidates,
      canonicalSkills: canonicalSkills.data.items,
    },
  } as ApiResponse<JobSkillResolutionTaskDetail>;
}

export async function listSkillResolutionSimilarSkills(id: string | number) {
  const response = await request<{ items?: RawSimilarSkill[] }>(
    `${BASE}/${id}/similar-skills`,
    { headers: hdrs() },
  );
  return {
    ...response,
    data: {
      items: (response.data.items ?? []).map(normalizeSimilarSkill),
    },
  } as ApiResponse<{ items: JobSkillResolutionSimilarSkill[] }>;
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
  const response = await request<{ id?: JsonId }>(`${BASE}/${id}/review`, {
    method: "PUT",
    headers: hdrs(true),
    // skillId 是 int64，保留字符串精度后再无损转成 JSON 数字字面量。
    body: stringifyNumericIdBody(payload, ["skillId"], ["parentSkillIds"]),
  });
  return { ...response, data: { id: String(response.data.id ?? "") } } as ApiResponse<{ id: string }>;
}

export async function listCanonicalSkillIds(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const query = new URLSearchParams({
    page: String(params?.page ?? 0),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.keyword?.trim()) query.set("keyword", params.keyword.trim());
  const response = await request<{
    ids?: JsonId[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(
    `${SKILLS_BASE}?${query}`,
    { headers: hdrs() },
  );
  return {
    ...response,
    data: {
      ids: (response.data.ids ?? []).map(String),
      total: Number(response.data.total ?? 0),
      page: Number(response.data.page ?? 0),
      pageSize: Number(response.data.pageSize ?? 20),
    },
  } as ApiResponse<PaginatedIds>;
}

export async function getCanonicalSkillDetail(id: string | number) {
  const response = await request<RawCanonicalSkill>(`${SKILLS_BASE}/${id}`, { headers: hdrs() });
  return {
    ...response,
    data: normalizeCanonicalSkill(response.data),
  } as ApiResponse<CanonicalSkillItem>;
}

export async function lookupCanonicalSkills(skillIds: Array<string | number>) {
  const uniqueIds = Array.from(new Map(skillIds.map((id) => [String(id), id])).values());
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [], missingIds: [] } } as ApiResponse<CanonicalSkillLookupData>;
  }

  // Gateway 单次最多接收 200 个 ID；超出时在客户端分批并合并结果。
  const requests: Array<Promise<ApiResponse<{ items?: RawCanonicalSkill[]; missingIds?: JsonId[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items?: RawCanonicalSkill[]; missingIds?: JsonId[] }>(`${SKILLS_BASE}/lookup`, {
      method: "POST",
      headers: hdrs(true),
      body: stringifyNumericIdBody({ skillIds: batch }, [], ["skillIds"]),
    }));
  }
  const responses = await Promise.all(requests);
  const items = responses
    .flatMap((response) => response.data.items ?? [])
    .map(normalizeCanonicalSkill);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const responseMissingIds = responses.flatMap((response) => response.data.missingIds ?? []).map(String);
  const inferredMissingIds = uniqueIds.map(String).filter((id) => !itemById.has(id));
  return {
    code: 200,
    data: {
      // 按请求 ID 顺序重排，保证 ID 索引分页的稳定顺序不会被批量详情响应打乱。
      items: uniqueIds.map(String).flatMap((id) => itemById.get(id) ?? []),
      missingIds: Array.from(new Set([...responseMissingIds, ...inferredMissingIds])),
    },
  } as ApiResponse<CanonicalSkillLookupData>;
}

export async function loadCanonicalSkillPage(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const index = await listCanonicalSkillIds(params);
  const details = await lookupCanonicalSkills(index.data.ids);
  return {
    code: index.code,
    data: {
      items: details.data.items,
      total: index.data.total,
      page: index.data.page,
      pageSize: index.data.pageSize,
    },
  } as ApiResponse<PaginatedData<CanonicalSkillItem>>;
}

export async function listCanonicalSkillRelations(
  skillId: string | number,
  direction: SkillRelationDirection,
) {
  const query = new URLSearchParams({ direction });
  const response = await request<RawCanonicalSkillRelations>(
    `${SKILLS_BASE}/${skillId}/relations?${query}`,
    { headers: hdrs() },
  );
  return {
    ...response,
    data: { skillIds: (response.data.skillIds ?? []).map(String) },
  } as ApiResponse<CanonicalSkillRelations>;
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
