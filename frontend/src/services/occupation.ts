// 百工谱 — 专业职业管理（occupation）服务层
// 目录查询（学科门类/专业类/专业/职业大类/中类/小类/职业）+ 名称向量化任务。
import type {
  ApiResponse, CatalogItem, CatalogLookupData, CatalogPage,
  MajorCatalogItem, MajorCategoryItem,
  OccupationCatalogItem, OccupationCategoryItem, OccupationSubCategoryItem,
  EmbeddingProgressResponse, EmbeddingTaskStatus, SkillGraphData,
  PaginatedIds, ResourceIdData, SkillGraphEvidencePage, SkillGraphMetricsData, SkillGraphScopeType,
} from "../types/api";
import { mergeSkillGraphMetricBatches } from "../utils/skill-graph";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/occupation";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

type JsonId = string | number;

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`);
  }
  // 用 lossless 解析，避免目录 id（雪花 ID int64）被 JSON.parse 丢精度
  const text = await res.text();
  return parseJson(text) as ApiResponse<T>;
}

// 分页/筛选查询参数（额外参数如 parentId 由调用方通过交叉类型传入）
export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

function qs(params: object): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// ==================== 目录列表 ====================

interface RawCatalogItem {
  id?: JsonId;
  code?: string;
  name?: string;
  disciplineCategoryId?: JsonId;
  majorCategoryId?: JsonId;
  occupationMajorCategoryId?: JsonId;
  occupationSubCategoryId?: JsonId;
  occupationCategoryId?: JsonId;
  isEmbed?: boolean;
  description?: string;
}

interface CatalogDefinition<T extends CatalogItem> {
  collection: string;
  normalize: (raw: RawCatalogItem) => T;
}

function normalizeCatalogBase(raw: RawCatalogItem = {}): CatalogItem {
  return { id: String(raw.id ?? ""), code: raw.code ?? "", name: raw.name ?? "" };
}

const disciplineCategoryDefinition: CatalogDefinition<CatalogItem> = {
  collection: "discipline-categories",
  normalize: normalizeCatalogBase,
};
const majorCategoryDefinition: CatalogDefinition<MajorCategoryItem> = {
  collection: "major-categories",
  normalize: (raw) => ({
    ...normalizeCatalogBase(raw),
    disciplineCategoryId: String(raw.disciplineCategoryId ?? ""),
  }),
};
const majorDefinition: CatalogDefinition<MajorCatalogItem> = {
  collection: "majors",
  normalize: (raw) => ({
    ...normalizeCatalogBase(raw),
    majorCategoryId: String(raw.majorCategoryId ?? ""),
    isEmbed: raw.isEmbed ?? false,
  }),
};
const occupationMajorCategoryDefinition: CatalogDefinition<CatalogItem> = {
  collection: "occupation-major-categories",
  normalize: normalizeCatalogBase,
};
const occupationSubCategoryDefinition: CatalogDefinition<OccupationSubCategoryItem> = {
  collection: "occupation-sub-categories",
  normalize: (raw) => ({
    ...normalizeCatalogBase(raw),
    occupationMajorCategoryId: String(raw.occupationMajorCategoryId ?? ""),
  }),
};
const occupationCategoryDefinition: CatalogDefinition<OccupationCategoryItem> = {
  collection: "occupation-categories",
  normalize: (raw) => ({
    ...normalizeCatalogBase(raw),
    occupationSubCategoryId: String(raw.occupationSubCategoryId ?? ""),
  }),
};
const occupationDefinition: CatalogDefinition<OccupationCatalogItem> = {
  collection: "occupations",
  normalize: (raw) => ({
    ...normalizeCatalogBase(raw),
    occupationCategoryId: String(raw.occupationCategoryId ?? ""),
    isEmbed: raw.isEmbed ?? false,
    description: raw.description ?? "",
  }),
};

async function listCatalogIds(collection: string, params: object): Promise<ApiResponse<PaginatedIds>> {
  const response = await request<{
    ids?: JsonId[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(`${BASE}/${collection}${qs(params)}`, { headers: hdrs() });
  return {
    ...response,
    data: {
      ids: (response.data.ids ?? []).map(String),
      total: Number(response.data.total ?? 0),
      page: Number(response.data.page ?? 0),
      pageSize: Number(response.data.pageSize ?? 20),
    },
  };
}

async function getCatalogDetail<T extends CatalogItem>(definition: CatalogDefinition<T>, id: string | number) {
  const response = await request<RawCatalogItem>(
    `${BASE}/${definition.collection}/${encodeURIComponent(String(id))}`,
    { headers: hdrs() },
  );
  return { ...response, data: definition.normalize(response.data) } as ApiResponse<T>;
}

async function lookupCatalogDetails<T extends CatalogItem>(
  definition: CatalogDefinition<T>,
  ids: Array<string | number>,
) {
  const uniqueIds = Array.from(new Set(ids.map(String)));
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [], missingIds: [] } } as ApiResponse<CatalogLookupData<T>>;
  }
  const requests: Array<Promise<ApiResponse<{ items?: RawCatalogItem[]; missingIds?: JsonId[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items?: RawCatalogItem[]; missingIds?: JsonId[] }>(
      `${BASE}/${definition.collection}/lookup`,
      {
        method: "POST",
        headers: hdrs(),
        // Gateway 按 []int64 绑定；以无损 JSON 数字字面量发送 Snowflake ID。
        body: stringifyNumericIdBody({ ids: batch }, [], ["ids"]),
      },
    ));
  }
  const responses = await Promise.all(requests);
  const items = responses.flatMap((response) => response.data.items ?? []).map(definition.normalize);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const responseMissingIds = responses.flatMap((response) => response.data.missingIds ?? []).map(String);
  const inferredMissingIds = uniqueIds.filter((id) => !itemById.has(id));
  return {
    code: 200,
    data: {
      items: uniqueIds.flatMap((id) => itemById.get(id) ?? []),
      missingIds: Array.from(new Set([...responseMissingIds, ...inferredMissingIds])),
    },
  } as ApiResponse<CatalogLookupData<T>>;
}

async function loadCatalogPage<T extends CatalogItem>(definition: CatalogDefinition<T>, params: object) {
  const index = await listCatalogIds(definition.collection, params);
  const details = await lookupCatalogDetails(definition, index.data.ids);
  return {
    code: index.code,
    data: {
      items: details.data.items,
      total: index.data.total,
      page: index.data.page,
      pageSize: index.data.pageSize,
    },
  } as ApiResponse<CatalogPage<T>>;
}

export const listDisciplineCategoryIds = (params: PageQuery = {}) => listCatalogIds("discipline-categories", params);
export const getDisciplineCategory = (id: string | number) => getCatalogDetail(disciplineCategoryDefinition, id);
export const lookupDisciplineCategories = (ids: Array<string | number>) => lookupCatalogDetails(disciplineCategoryDefinition, ids);
export const getDisciplineCategories = (params: PageQuery = {}) => loadCatalogPage(disciplineCategoryDefinition, params);

export const listMajorCategoryIds = (params: PageQuery & { disciplineCategoryId?: string }) => listCatalogIds("major-categories", params);
export const getMajorCategory = (id: string | number) => getCatalogDetail(majorCategoryDefinition, id);
export const lookupMajorCategories = (ids: Array<string | number>) => lookupCatalogDetails(majorCategoryDefinition, ids);
export const getMajorCategories = (params: PageQuery & { disciplineCategoryId?: string }) => loadCatalogPage(majorCategoryDefinition, params);

export const listMajorIds = (params: PageQuery & { majorCategoryId?: string }) => listCatalogIds("majors", params);
export const getMajor = (id: string | number) => getCatalogDetail(majorDefinition, id);
export const lookupMajors = (ids: Array<string | number>) => lookupCatalogDetails(majorDefinition, ids);
export const getMajors = (params: PageQuery & { majorCategoryId?: string }) => loadCatalogPage(majorDefinition, params);

export const listOccupationMajorCategoryIds = (params: PageQuery = {}) => listCatalogIds("occupation-major-categories", params);
export const getOccupationMajorCategory = (id: string | number) => getCatalogDetail(occupationMajorCategoryDefinition, id);
export const lookupOccupationMajorCategories = (ids: Array<string | number>) => lookupCatalogDetails(occupationMajorCategoryDefinition, ids);
export const getOccupationMajorCategories = (params: PageQuery = {}) => loadCatalogPage(occupationMajorCategoryDefinition, params);

export const listOccupationSubCategoryIds = (params: PageQuery & { occupationMajorCategoryId?: string }) => listCatalogIds("occupation-sub-categories", params);
export const getOccupationSubCategory = (id: string | number) => getCatalogDetail(occupationSubCategoryDefinition, id);
export const lookupOccupationSubCategories = (ids: Array<string | number>) => lookupCatalogDetails(occupationSubCategoryDefinition, ids);
export const getOccupationSubCategories = (params: PageQuery & { occupationMajorCategoryId?: string }) => loadCatalogPage(occupationSubCategoryDefinition, params);

export const listOccupationCategoryIds = (params: PageQuery & { occupationSubCategoryId?: string }) => listCatalogIds("occupation-categories", params);
export const getOccupationCategory = (id: string | number) => getCatalogDetail(occupationCategoryDefinition, id);
export const lookupOccupationCategories = (ids: Array<string | number>) => lookupCatalogDetails(occupationCategoryDefinition, ids);
export const getOccupationCategories = (params: PageQuery & { occupationSubCategoryId?: string }) => loadCatalogPage(occupationCategoryDefinition, params);

export const listOccupationIds = (params: PageQuery & { occupationCategoryId?: string }) => listCatalogIds("occupations", params);
export const getOccupation = (id: string | number) => getCatalogDetail(occupationDefinition, id);
export const lookupOccupations = (ids: Array<string | number>) => lookupCatalogDetails(occupationDefinition, ids);
export const getOccupations = (params: PageQuery & { occupationCategoryId?: string }) => loadCatalogPage(occupationDefinition, params);

// ==================== 职业/专业技能时间图谱 ====================

export interface SkillGraphQuery {
  fromMonth?: string;
  toMonth?: string;
}

export interface SkillGraphEvidenceQuery extends SkillGraphQuery {
  page?: number;
  pageSize?: number;
}

interface RawSkillGraphData {
  scopeId?: JsonId;
  directSkillIds?: JsonId[];
}

interface RawSkillGraphMetric {
  skillId?: JsonId;
  jobCount?: number | string;
  coverage?: number;
}

interface RawSkillGraphEvidencePage {
  jobIds?: JsonId[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function graphResource(scopeType: SkillGraphScopeType) {
  return scopeType === "OCCUPATION" ? "occupations" : "majors";
}

export function getSkillGraph(
  scopeType: SkillGraphScopeType,
  scopeId: string,
  params: SkillGraphQuery = {},
) {
  const resource = graphResource(scopeType);
  return request<RawSkillGraphData>(
    `${BASE}/${resource}/${encodeURIComponent(scopeId)}/skill-graph${qs(params)}`,
    { headers: hdrs() },
  ).then((response) => ({
    ...response,
    data: {
      scopeId: String(response.data.scopeId ?? scopeId),
      directSkillIds: (response.data.directSkillIds ?? []).map(String),
    },
  } as ApiResponse<SkillGraphData>));
}

export async function lookupSkillGraphMetrics(
  scopeType: SkillGraphScopeType,
  scopeId: string,
  skillIds: Array<string | number>,
  params: SkillGraphQuery = {},
) {
  const resource = graphResource(scopeType);
  const uniqueIds = Array.from(new Set(skillIds.map(String)));
  if (uniqueIds.length === 0) {
    return { code: 200, data: { items: [], missingIds: [] } } as ApiResponse<SkillGraphMetricsData>;
  }

  // 批量端点默认每次最多 200 个 ID；大图谱按批次合并，避免逐技能 N+1。
  const requests: Array<Promise<ApiResponse<{ items?: RawSkillGraphMetric[]; missingIds?: JsonId[] }>>> = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batch = uniqueIds.slice(offset, offset + 200);
    requests.push(request<{ items?: RawSkillGraphMetric[]; missingIds?: JsonId[] }>(
      `${BASE}/${resource}/${encodeURIComponent(scopeId)}/skill-graph/skills/lookup`,
      {
        method: "POST",
        headers: hdrs(),
        body: stringifyNumericIdBody({ skillIds: batch, ...params }, [], ["skillIds"]),
      },
    ));
  }
  const responses = await Promise.all(requests);
  return {
    code: 200,
    data: mergeSkillGraphMetricBatches(uniqueIds, responses.map((response) => ({
      items: (response.data.items ?? []).map((item) => ({
        skillId: String(item.skillId ?? ""),
        jobCount: item.jobCount ?? 0,
        coverage: Number(item.coverage ?? 0),
      })),
      missingIds: response.data.missingIds,
    }))),
  } as ApiResponse<SkillGraphMetricsData>;
}

export function listSkillGraphEvidenceJobIds(
  scopeType: SkillGraphScopeType,
  scopeId: string,
  skillId: string,
  params: SkillGraphEvidenceQuery = {},
) {
  const resource = graphResource(scopeType);
  const query = {
    ...params,
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 20,
  };
  return request<RawSkillGraphEvidencePage>(
    `${BASE}/${resource}/${encodeURIComponent(scopeId)}/skill-graph/skills/${encodeURIComponent(skillId)}/evidence${qs(query)}`,
    { headers: hdrs() },
  ).then((response) => ({
    ...response,
    data: {
      jobIds: (response.data.jobIds ?? []).map(String),
      total: Number(response.data.total ?? 0),
      page: Number(response.data.page ?? 0),
      pageSize: Number(response.data.pageSize ?? query.pageSize),
    },
  } as ApiResponse<SkillGraphEvidencePage>));
}

// ==================== 向量化 ====================

export function getEmbeddingProgress() {
  return request<EmbeddingProgressResponse>(`${BASE}/embedding/progress`, { headers: hdrs() });
}

function getEmbeddingStatus(path: string) {
  return request<EmbeddingTaskStatus>(path, { headers: hdrs() }).then((response) => ({
    ...response,
    data: { ...response.data, id: String(response.data.id ?? "") },
  } as ApiResponse<EmbeddingTaskStatus>));
}

function runEmbeddingCommand(path: string, method: "POST" | "DELETE") {
  return request<{ id?: JsonId }>(path, { method, headers: hdrs() }).then((response) => ({
    ...response,
    data: { id: String(response.data.id ?? "") },
  } as ApiResponse<ResourceIdData>));
}

export function startMajorEmbedding() {
  return runEmbeddingCommand(`${BASE}/majors/embedding`, "POST");
}
export function getMajorEmbeddingStatus() {
  return getEmbeddingStatus(`${BASE}/majors/embedding`);
}
export function stopMajorEmbedding() {
  return runEmbeddingCommand(`${BASE}/majors/embedding`, "DELETE");
}

export function startOccupationEmbedding() {
  return runEmbeddingCommand(`${BASE}/occupations/embedding`, "POST");
}
export function getOccupationEmbeddingStatus() {
  return getEmbeddingStatus(`${BASE}/occupations/embedding`);
}
export function stopOccupationEmbedding() {
  return runEmbeddingCommand(`${BASE}/occupations/embedding`, "DELETE");
}

export function startSkillEmbedding() {
  return runEmbeddingCommand(`${BASE}/skills/embedding`, "POST");
}
export function getSkillEmbeddingStatus() {
  return getEmbeddingStatus(`${BASE}/skills/embedding`);
}
export function stopSkillEmbedding() {
  return runEmbeddingCommand(`${BASE}/skills/embedding`, "DELETE");
}
