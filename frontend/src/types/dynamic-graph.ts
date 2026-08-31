export type EntityType =
  | "Domain"
  | "Occupation"
  | "JobRole"
  | "Skill"
  | "Task"
  | "Tool"
  | "Certificate";

export type RelationType =
  | "REQUIRES"
  | "BROADER_THAN"
  | "EVOLVES_INTO"
  | "RELATED_TO"
  | "SIMILAR_TO";

export type TrendType = "rising" | "stable" | "declining" | "emerging";

export type ConfidenceLevel = "auto" | "rule" | "human";

export interface DynamicGraphNode {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  description?: string;
  summary?: string;
  category?: string;
  industry?: string;
  demandLevel: number;
  trend?: TrendType;
  emerging?: boolean;
  relatedJobCount?: number;
  sampleCount?: number;
  coverage?: number;
  companyCount?: number;
  reviewStatus?: string;
  confidence?: ConfidenceLevel;
  proficiency?: string;
  requiredLevel?: string;
  issuer?: string;
  difficulty?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
}

export interface DynamicGraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  confidence: ConfidenceLevel;
  importance: number;
  requiredLevel?: string;
  weight?: number;
  active?: boolean;
}

export interface DynamicGraphData {
  nodes: DynamicGraphNode[];
  edges: DynamicGraphEdge[];
}

export interface GraphSearchResult {
  id: string;
  name: string;
  type: EntityType;
  matchedAlias?: string;
}

export interface PathQueryResult {
  found: boolean;
  path: { nodeId: string; edgeId?: string }[];
  hops: number;
  totalImportance: number;
}

export interface GraphExportOptions {
  format: "json" | "svg" | "png";
  includeEvidence?: boolean;
  filename?: string;
}

export interface EvidenceRecord {
  id: string;
  companyName: string;
  jobName: string;
  sourcePlatform: string;
  publishDate: string;
  sourceUrl?: string;
  proficiency?: string;
  snippet: string;
}

export interface NodeDetailData {
  node: DynamicGraphNode;
  neighbors: { node: DynamicGraphNode; edge: DynamicGraphEdge; direction: "in" | "out" }[];
  evidence: EvidenceRecord[];
  statistics: {
    inDegree: number;
    outDegree: number;
    totalDegree: number;
    avgNeighborDemand: number;
    centrality: number;
  };
}

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  Domain: "领域",
  Occupation: "职业",
  JobRole: "岗位角色",
  Skill: "技能",
  Task: "任务",
  Tool: "工具",
  Certificate: "证书",
};

export const RELATION_TYPE_LABEL: Record<RelationType, string> = {
  REQUIRES: "要求掌握",
  BROADER_THAN: "包含子类",
  EVOLVES_INTO: "演化成",
  RELATED_TO: "相关",
  SIMILAR_TO: "相似于",
};

export const TREND_LABEL: Record<TrendType, string> = {
  rising: "上升",
  stable: "稳定",
  declining: "下降",
  emerging: "新兴",
};
