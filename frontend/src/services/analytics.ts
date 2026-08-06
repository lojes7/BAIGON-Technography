import type {
  ApiResponse, PaginatedData,
  AbilityGraphData, GraphNodeDetail, GraphComparisonData,
  EvolutionTrendData, EvolutionEventItem, EvolutionEventDetail,
  ComboEvolutionData,
} from "../types/api";

const BASE = "/api/analytics";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail?.[0]?.msg || `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

function setIf(q: URLSearchParams, key: string, value?: string | null) {
  if (value != null) q.set(key, value);
}

// 1. 岗位能力图谱
export async function getAbilityGraph(params: {
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  period: string;
  include_candidates?: boolean;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("period", params.period);
  if (params.include_candidates) q.set("include_candidates", "true");
  return request<AbilityGraphData>(`${BASE}/ability-graph?${q}`, { headers: hdrs() });
}

// 2. 图谱节点详情
export async function getGraphNodeDetail(params: {
  node_type: string;
  node_id: string;
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  period: string;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("period", params.period);
  return request<GraphNodeDetail>(
    `${BASE}/ability-graph/nodes/${params.node_type}/${params.node_id}?${q}`,
    { headers: hdrs() },
  );
}

// 3. 图谱周期比较
export async function getGraphComparison(params: {
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  base_period: string;
  compare_period: string;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("base_period", params.base_period);
  q.set("compare_period", params.compare_period);
  return request<GraphComparisonData>(`${BASE}/ability-graph/comparison?${q}`, { headers: hdrs() });
}

// 4. 能力演化趋势
export async function getEvolutionTrends(params: {
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  from_period: string;
  to_period: string;
  skill_id?: string[];
  limit?: number;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("from_period", params.from_period);
  q.set("to_period", params.to_period);
  if (params.skill_id?.length) {
    params.skill_id.forEach((id) => q.append("skill_id", id));
  }
  if (params.limit) q.set("limit", String(params.limit));
  return request<EvolutionTrendData>(`${BASE}/evolution/trends?${q}`, { headers: hdrs() });
}

// 5. 演化事件列表
export async function getEvolutionEvents(params: {
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  period: string;
  event_type?: string;
  page?: number;
  page_size?: number;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("period", params.period);
  if (params.event_type) q.set("event_type", params.event_type);
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 20));
  return request<PaginatedData<EvolutionEventItem>>(`${BASE}/evolution/events?${q}`, { headers: hdrs() });
}

// 6. 演化事件详情
export async function getEvolutionEventDetail(params: {
  skill_id: string;
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  base_period: string;
  compare_period: string;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("base_period", params.base_period);
  q.set("compare_period", params.compare_period);
  return request<EvolutionEventDetail>(
    `${BASE}/evolution/events/${params.skill_id}?${q}`,
    { headers: hdrs() },
  );
}

// 7. 能力组合演化
export async function getComboEvolution(params: {
  city_id?: string | null;
  major_id?: string | null;
  company_id?: string | null;
  center_skill_id: string;
  base_period: string;
  compare_period: string;
  limit?: number;
  evidence_limit?: number;
}) {
  const q = new URLSearchParams();
  setIf(q, "city_id", params.city_id);
  setIf(q, "major_id", params.major_id);
  setIf(q, "company_id", params.company_id);
  q.set("center_skill_id", params.center_skill_id);
  q.set("base_period", params.base_period);
  q.set("compare_period", params.compare_period);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.evidence_limit) q.set("evidence_limit", String(params.evidence_limit));
  return request<ComboEvolutionData>(`${BASE}/evolution/combinations?${q}`, { headers: hdrs() });
}
