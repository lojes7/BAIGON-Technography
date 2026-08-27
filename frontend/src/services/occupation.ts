// 百工谱 — 专业职业管理（occupation）服务层
// 目录查询（学科门类/专业类/专业/职业大类/中类/小类/职业）+ 名称向量化任务。
import type {
  ApiResponse, CatalogItem, EmbeddableCatalogItem, CatalogPage,
  EmbeddingProgressResponse, EmbeddingTaskStatus, SkillGraphData,
  SkillGraphScopeType,
} from "../types/api";
import { parseJson } from "./lossless";

const BASE = "/api/auth/occupation";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

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

export function getDisciplineCategories(params?: PageQuery) {
  return request<CatalogPage<CatalogItem>>(`${BASE}/discipline-categories${qs(params ?? {})}`, { headers: hdrs() });
}

export function getMajorCategories(params: PageQuery & { disciplineCategoryId?: string }) {
  return request<CatalogPage<CatalogItem>>(`${BASE}/major-categories${qs(params)}`, { headers: hdrs() });
}

export function getMajors(params: PageQuery & { majorCategoryId?: string }) {
  return request<CatalogPage<EmbeddableCatalogItem>>(`${BASE}/majors${qs(params)}`, { headers: hdrs() });
}

export function getOccupationMajorCategories(params?: PageQuery) {
  return request<CatalogPage<CatalogItem>>(`${BASE}/occupation-major-categories${qs(params ?? {})}`, { headers: hdrs() });
}

export function getOccupationSubCategories(params: PageQuery & { occupationMajorCategoryId?: string }) {
  return request<CatalogPage<CatalogItem>>(`${BASE}/occupation-sub-categories${qs(params)}`, { headers: hdrs() });
}

export function getOccupationCategories(params: PageQuery & { occupationSubCategoryId?: string }) {
  return request<CatalogPage<CatalogItem>>(`${BASE}/occupation-categories${qs(params)}`, { headers: hdrs() });
}

export function getOccupations(params: PageQuery & { occupationCategoryId?: string }) {
  return request<CatalogPage<EmbeddableCatalogItem>>(`${BASE}/occupations${qs(params)}`, { headers: hdrs() });
}

// ==================== 职业/专业技能时间图谱 ====================

export interface SkillGraphQuery {
  fromMonth?: string;
  toMonth?: string;
  evidenceLimit?: number;
}

export function getSkillGraph(
  scopeType: SkillGraphScopeType,
  scopeId: string,
  params: SkillGraphQuery = {},
) {
  const resource = scopeType === "OCCUPATION" ? "occupations" : "majors";
  return request<SkillGraphData>(
    `${BASE}/${resource}/${encodeURIComponent(scopeId)}/skill-graph${qs(params)}`,
    { headers: hdrs() },
  );
}

// ==================== 向量化 ====================

export function getEmbeddingProgress() {
  return request<EmbeddingProgressResponse>(`${BASE}/embedding/progress`, { headers: hdrs() });
}

export function startMajorEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/majors/embedding`, { method: "POST", headers: hdrs() });
}
export function getMajorEmbeddingStatus() {
  return request<EmbeddingTaskStatus>(`${BASE}/majors/embedding`, { headers: hdrs() });
}
export function stopMajorEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/majors/embedding`, { method: "DELETE", headers: hdrs() });
}

export function startOccupationEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/occupations/embedding`, { method: "POST", headers: hdrs() });
}
export function getOccupationEmbeddingStatus() {
  return request<EmbeddingTaskStatus>(`${BASE}/occupations/embedding`, { headers: hdrs() });
}
export function stopOccupationEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/occupations/embedding`, { method: "DELETE", headers: hdrs() });
}

export function startSkillEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/skills/embedding`, { method: "POST", headers: hdrs() });
}
export function getSkillEmbeddingStatus() {
  return request<EmbeddingTaskStatus>(`${BASE}/skills/embedding`, { headers: hdrs() });
}
export function stopSkillEmbedding() {
  return request<EmbeddingTaskStatus>(`${BASE}/skills/embedding`, { method: "DELETE", headers: hdrs() });
}
