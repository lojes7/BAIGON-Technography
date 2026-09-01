import T from "../constants/tokens";
import type { EntityType, RelationType, TrendType } from "../types/dynamic-graph";

/* ===== TikZ / LaTeX 风格低饱和淡彩色板 =====
   原则：fill 为浅淡底色，stroke 为同色系灰调中深色，text 为低饱和深色，整体柔和不刺眼。 */
export const ENTITY_COLOR: Record<EntityType, { fill: string; stroke: string; deep: string; text: string; ring: string }> = {
  Domain:       { fill: "#EEF1F6", stroke: "#AAB7C9", deep: "#5A7194", text: "#46586E", ring: "#AAB7C9" },
  Occupation:   { fill: "#FAF0DE", stroke: "#D3B483", deep: "#B08A50", text: "#6E5A38", ring: "#D3B483" },
  JobRole:      { fill: "#E3EBF5", stroke: "#93AACB", deep: "#5F7FAE", text: "#3A5170", ring: "#93AACB" },
  Skill:        { fill: "#E6F1E7", stroke: "#93BB9B", deep: "#5E8F68", text: "#3D5A44", ring: "#93BB9B" },
  Task:         { fill: "#F8E7EE", stroke: "#D19BB4", deep: "#B06E8E", text: "#6B4257", ring: "#D19BB4" },
  Tool:         { fill: "#FCF0E2", stroke: "#DDB287", deep: "#B5814F", text: "#6F4F30", ring: "#DDB287" },
  Certificate:  { fill: "#EAE8F5", stroke: "#A89CD2", deep: "#7A6BB5", text: "#4B4370", ring: "#A89CD2" },
};

export const ENTITY_ICON_CODE: Record<EntityType, string> = {
  Domain: "✦",
  Occupation: "◉",
  JobRole: "◆",
  Skill: "●",
  Task: "▲",
  Tool: "■",
  Certificate: "★",
};

/* 关系类型 → 淡彩线色（普通边一律无箭头：结构类=实线，关联类=虚线） */
export const RELATION_COLOR: Record<RelationType, { stroke: string; dash?: string; labelBg: string }> = {
  REQUIRES:      { stroke: "#B7C3D5", labelBg: "#E9EEF5" },
  BROADER_THAN:  { stroke: "#C2CEC4", labelBg: "#EBF1EB" },
  EVOLVES_INTO:  { stroke: "#D9BFC6", labelBg: "#F6E9ED" },
  RELATED_TO:    { stroke: "#C9C4D8", dash: "5 4", labelBg: "#EFEDF6" },
  SIMILAR_TO:    { stroke: "#D3C6B4", dash: "6 4", labelBg: "#F5F0E7" },
};

/* ===== 关键技能：与中心恒星用淡彩实线箭头相连（数量 ≤ 10） =====
   取全图谱 demandLevel 最高的 9 个技能点，兼顾软件工程/人工智能/大数据三个领域。 */
export const KEY_SKILL_IDS = [
  "sk_001", // Python 0.97
  "sk_004", // 大语言模型 0.96
  "sk_013", // SQL 0.95
  "sk_005", // RAG工程化 0.94
  "sk_011", // PyTorch 0.94
  "sk_003", // 深度学习 0.93
  "sk_023", // MySQL 0.93
  "sk_014", // Java 0.92
  "sk_012", // 数据仓库 0.87
] as const;

/* 恒星 → 关键技能 的淡彩箭头颜色（与实体色同风格的 TikZ 淡彩） */
export const STAR_SPOKE_COLORS = [
  "#9FB0C9", // 灰蓝
  "#CFA3B8", // 藕红
  "#A79DD4", // 淡紫
  "#D6AE7E", // 杏橙
  "#8FB99A", // 豆绿
  "#8FB4C0", // 青灰
  "#CDB67E", // 芥黄
  "#B99BC0", // 藕紫
] as const;

/* 关键技能 → 子技能 的浅色虚线箭头颜色 */
export const SUB_ARROW_COLOR = "#B9C7D9";

/* ===== 熟练度要求（用于视图过滤与节点尺寸加权，不再用于描边编码） ===== */
export const PROFICIENCY_LEVELS = ["了解", "熟悉", "熟练", "精通"] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export function proficiencyOf(text?: string): number {
  if (!text) return 0;
  const idx = (PROFICIENCY_LEVELS as readonly string[]).indexOf(text);
  return idx >= 0 ? idx + 1 : 0;
}

/* 熟练度要求 → 节点尺寸加成（了解 +0 → 精通 +4.5） */
const PROFICIENCY_SIZE_BONUS: Record<number, number> = { 1: 0, 2: 1.5, 3: 3, 4: 4.5 };

/* 节点尺寸：中心恒星最大(46)；其余节点上限 = 23（数据量大、图面密集时节点整体缩小，
   间距不压缩——靠缩放浏览细看） */
export const DOMAIN_STAR_RADIUS = 46;
export const NODE_MAX_RADIUS = 23; // = DOMAIN_STAR_RADIUS * 0.5

export function nodeSizeOf(demandLevel: number, requiredLevel?: string): number {
  const t = Math.min(1, Math.max(0, (demandLevel - 0.65) / 0.35));
  const base = 7 + t * 15; // 7 → 22
  const bonus = PROFICIENCY_SIZE_BONUS[proficiencyOf(requiredLevel)] ?? 0;
  return Math.min(NODE_MAX_RADIUS, base + bonus);
}

export const TREND_COLOR: Record<TrendType, string> = {
  rising: T.emerging,
  stable: T.stable,
  declining: T.declining,
  emerging: "#A79DD4",
};

export const TREND_LABEL: Record<TrendType, string> = {
  rising: "上升",
  stable: "稳定",
  declining: "下降",
  emerging: "新兴",
};

export const CONFIDENCE_ALPHA: Record<"auto" | "rule" | "human", number> = {
  auto: 0.4,
  rule: 0.62,
  human: 0.9,
};

export function getNodeFill(type: EntityType, selected: boolean, highlighted: boolean, dimmed: boolean, trend?: TrendType) {
  const base = ENTITY_COLOR[type];
  if (dimmed) return { fill: "#F1F3F6", stroke: "#D9DEE5", text: "#A9B2BF", ring: "#E4E8EE" };
  if (selected) return { fill: base.deep, stroke: base.deep, text: "#FFFFFF", ring: trend ? TREND_COLOR[trend] : base.ring };
  if (highlighted) return { fill: base.fill, stroke: base.deep, text: base.text, ring: trend ? TREND_COLOR[trend] : base.ring };
  return { fill: base.fill, stroke: base.stroke, text: base.text, ring: base.ring };
}
