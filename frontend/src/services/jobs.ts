import type {
  ApiResponse, PaginatedData, PaginatedIds, JobData, JobDetail, JobLookupData,
  JobSkillData, JobSkillLookupData, JobMatchMutationResult, ListJobsParams,
  JobItem, JobAbilities, JobMatchResult,
} from "../types/api";
import { HttpError } from "./http-error";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/jobs";
const JOB_SKILLS_BASE = "/api/job-skills";
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
    throw new HttpError(res.status);
  }
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

type JsonId = string | number;

interface RawJobData extends Omit<JobData, "id" | "majorId" | "occupationId" | "jobSkillIds"> {
  id: JsonId;
  majorId?: JsonId | null;
  occupationId?: JsonId | null;
  jobSkillIds?: JsonId[];
}

interface RawJobSkillData extends Omit<JobSkillData, "id" | "jobId" | "skillId"> {
  id: JsonId;
  jobId: JsonId;
  skillId?: JsonId | null;
}

function nullableId(value: JsonId | null | undefined): string | null {
  return value === undefined || value === null || value === 0 || value === "0" ? null : String(value);
}

function normalizeJob(raw: RawJobData): JobData {
  return {
    ...raw,
    id: String(raw.id),
    majorId: nullableId(raw.majorId),
    occupationId: nullableId(raw.occupationId),
    jobSkillIds: (raw.jobSkillIds ?? []).map(String),
  };
}

function normalizeJobSkill(raw: RawJobSkillData): JobSkillData {
  return {
    ...raw,
    id: String(raw.id),
    jobId: String(raw.jobId),
    skillId: nullableId(raw.skillId),
  };
}

// 分页查询岗位（POST + body，文本字段包含匹配，majorId / occupationId 精确匹配）
export async function listJobs(params?: ListJobsParams) {
  const body = {
    page: params?.page ?? 0,
    pageSize: params?.pageSize ?? 20,
    name: params?.name ?? "",
    majorId: params?.majorId,
    occupationId: params?.occupationId,
    major: params?.major ?? "",
    city: params?.city ?? "",
    province: params?.province ?? "",
    salary: params?.salary ?? "",
    company: params?.company ?? "",
    education: params?.education ?? "",
    nature: params?.nature ?? "",
    companySize: params?.companySize ?? "",
  };
  const response = await request<{
    ids?: JsonId[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(BASE, {
    method: "POST",
    headers: hdrs(true),
    // 雪花 ID 不能经 Number 转换，否则可能在浏览器端丢失精度。
    body: stringifyNumericIdBody(body, ["majorId", "occupationId"]),
  });
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

// 查询岗位自身详情；目录与技能关系均只保留 ID 引用。
export async function getJobDetail(id: string | number) {
  const response = await request<RawJobData>(`${BASE}/${id}`, { headers: hdrs() });
  return { ...response, data: normalizeJob(response.data) } as ApiResponse<JobDetail>;
}

// 图谱证据只拿到 jobIds；每页统一批量补齐岗位详情，禁止逐 ID 查询。
export async function lookupJobs(ids: Array<string | number>) {
  const uniqueIds = Array.from(new Set(ids.map(String)));
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [], missingIds: [] } } as ApiResponse<JobLookupData>;
  }

  const requests: Array<Promise<ApiResponse<{ items?: RawJobData[]; missingIds?: JsonId[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items?: RawJobData[]; missingIds?: JsonId[] }>(`${BASE}/lookup`, {
      method: "POST",
      headers: hdrs(true),
      // Gateway 按 []int64 绑定；避免 JS Number，直接生成无损数字字面量。
      body: stringifyNumericIdBody({ ids: batch }, [], ["ids"]),
    }));
  }
  const responses = await Promise.all(requests);
  const items = responses.flatMap((response) => response.data.items ?? []).map(normalizeJob);
  const itemById = new Map(items.map((job) => [job.id, job]));
  const responseMissingIds = responses.flatMap((response) => response.data.missingIds ?? []).map(String);
  const inferredMissingIds = uniqueIds.filter((id) => !itemById.has(id));
  return {
    code: 200,
    data: {
      items: uniqueIds.flatMap((id) => itemById.get(id) ?? []),
      missingIds: Array.from(new Set([...responseMissingIds, ...inferredMissingIds])),
    },
  } as ApiResponse<JobLookupData>;
}

export async function loadJobsPage(params?: ListJobsParams) {
  const index = await listJobs(params);
  const details = await lookupJobs(index.data.ids);
  return {
    code: index.code,
    data: {
      items: details.data.items,
      total: index.data.total,
      page: index.data.page,
      pageSize: index.data.pageSize,
    },
  } as ApiResponse<PaginatedData<JobData>>;
}

export async function getJobSkill(id: string | number) {
  const response = await request<RawJobSkillData>(`${JOB_SKILLS_BASE}/${id}`, { headers: hdrs() });
  return { ...response, data: normalizeJobSkill(response.data) } as ApiResponse<JobSkillData>;
}

export async function lookupJobSkills(ids: Array<string | number>) {
  const uniqueIds = Array.from(new Set(ids.map(String)));
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [], missingIds: [] } } as ApiResponse<JobSkillLookupData>;
  }
  const requests: Array<Promise<ApiResponse<{ items?: RawJobSkillData[]; missingIds?: JsonId[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items?: RawJobSkillData[]; missingIds?: JsonId[] }>(`${JOB_SKILLS_BASE}/lookup`, {
      method: "POST",
      headers: hdrs(true),
      body: stringifyNumericIdBody({ ids: batch }, [], ["ids"]),
    }));
  }
  const responses = await Promise.all(requests);
  const items = responses.flatMap((response) => response.data.items ?? []).map(normalizeJobSkill);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const responseMissingIds = responses.flatMap((response) => response.data.missingIds ?? []).map(String);
  const inferredMissingIds = uniqueIds.filter((id) => !itemById.has(id));
  return {
    code: 200,
    data: {
      items: uniqueIds.flatMap((id) => itemById.get(id) ?? []),
      missingIds: Array.from(new Set([...responseMissingIds, ...inferredMissingIds])),
    },
  } as ApiResponse<JobSkillLookupData>;
}

// 人岗匹配（使用当前用户最新简历匹配指定岗位）
export async function matchMyResumeToJob(id: string | number) {
  const response = await request<{ id?: JsonId }>(`${BASE}/${id}/match`, { method: "POST", headers: hdrs() });
  return {
    ...response,
    data: { id: String(response.data.id ?? "") },
  } as ApiResponse<JobMatchMutationResult>;
}

// 查询当前用户针对该岗位最近一次已持久化的匹配结果；404 由页面解释为“尚未匹配”。
export function getLatestMyJobMatch(id: string | number) {
  return request<JobMatchResult>(`${BASE}/${id}/match`, { headers: hdrs() });
}

export async function getJobList(major_id: string, city_id?: string, page = 1, page_size = 20) {
  const params = new URLSearchParams({ major_id, page: String(page), page_size: String(page_size) });
  if (city_id) params.set("city_id", city_id);
  return request<PaginatedData<JobItem>>(`${BASE}?${params}`, { headers: hdrs() });
}

export async function getJobAbilities(job_id: string) {
  return request<JobAbilities>(`${BASE}/${job_id}/abilities`, { headers: hdrs() });
}
