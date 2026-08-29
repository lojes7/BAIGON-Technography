import type {
  CanonicalSkillItem,
  SkillGraphData,
  SkillGraphMetric,
  SkillGraphMetricsData,
  SkillGraphScopeType,
  SkillGraphViewData,
} from "../types/api";

export type TimelineMode = "all" | "before" | "in" | "from";
export type TimelineGranularity = "month" | "year";
export type GraphMatchMode = "firstSeen" | "adjacent";

export interface TimelineBounds {
  fromMonth?: string;
  toMonth?: string;
}

export interface GraphScopeSelection {
  type: SkillGraphScopeType;
  id: string;
  code: string;
  name: string;
}

interface SkillGraphMetricBatch {
  items?: SkillGraphMetric[];
  missingIds?: Array<string | number>;
}

/** 合并多个指标批次，并恢复调用方的技能 ID 顺序。 */
export function mergeSkillGraphMetricBatches(
  skillIds: Array<string | number>,
  batches: SkillGraphMetricBatch[],
): SkillGraphMetricsData {
  const uniqueIds = Array.from(new Set(skillIds.map(String)));
  const items = batches.flatMap((batch) => batch.items ?? []);
  const itemById = new Map(items.map((item) => [String(item.skillId), item]));
  const responseMissingIds = batches.flatMap((batch) => batch.missingIds ?? []).map(String);
  const missingIdSet = new Set([
    ...responseMissingIds,
    ...uniqueIds.filter((id) => !itemById.has(id)),
  ]);
  return {
    items: uniqueIds.flatMap((id) => itemById.get(id) ?? []),
    missingIds: uniqueIds.filter((id) => missingIdSet.has(id)),
  };
}

/** 将三个瘦 API 的结果按 directSkillIds 顺序拼成纯前端展示模型。 */
export function buildSkillGraphView(
  graph: SkillGraphData,
  details: CanonicalSkillItem[],
  metrics: SkillGraphMetric[],
): SkillGraphViewData {
  const detailById = new Map(details.map((skill) => [String(skill.id), skill]));
  const metricById = new Map(metrics.map((metric) => [String(metric.skillId), metric]));
  return {
    scopeId: graph.scopeId,
    skills: graph.directSkillIds.map((skillId) => {
      const id = String(skillId);
      const metric = metricById.get(id);
      return {
        skillId: id,
        skillName: detailById.get(id)?.name || `技能 #${id}`,
        jobCount: metric?.jobCount ?? 0,
        coverage: metric?.coverage ?? 0,
      };
    }),
  };
}

function parseMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error("月份必须使用 YYYY-MM 格式");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("月份必须在 01 到 12 之间");
  return { year, month };
}

function formatMonth(year: number, month: number): string {
  const zeroBased = year * 12 + month - 1;
  const normalizedYear = Math.floor(zeroBased / 12);
  const normalizedMonth = zeroBased % 12 + 1;
  return `${normalizedYear}-${String(normalizedMonth).padStart(2, "0")}`;
}

export function shiftMonth(value: string, offset: number): string {
  const { year, month } = parseMonth(value);
  return formatMonth(year, month + offset);
}

export function normalizeTimelineValue(
  granularity: TimelineGranularity,
  value: string,
): string {
  if (granularity === "month") {
    parseMonth(value);
    return value;
  }
  if (!/^\d{4}$/.test(value)) throw new Error("年份必须使用 YYYY 格式");
  return `${value}-01`;
}

/** 将“之前 / 当期 / 之后”的界面语义转换为后端的 [fromMonth, toMonth) 区间。 */
export function buildTimelineBounds(
  mode: TimelineMode,
  granularity: TimelineGranularity,
  value: string,
): TimelineBounds {
  if (mode === "all") return {};
  const start = normalizeTimelineValue(granularity, value);
  if (mode === "before") return { toMonth: start };
  if (mode === "from") return { fromMonth: start };
  return {
    fromMonth: start,
    toMonth: granularity === "month"
      ? shiftMonth(start, 1)
      : `${Number(value) + 1}-01`,
  };
}

/** Graph Match 比较目标自然周期与其紧邻的前一个自然周期。 */
export function buildComparisonBounds(
  granularity: TimelineGranularity,
  value: string,
  mode: GraphMatchMode = "firstSeen",
): { base: TimelineBounds; compare: TimelineBounds; baseLabel: string; compareLabel: string } {
  const compareStart = normalizeTimelineValue(granularity, value);
  const compareEnd = granularity === "month"
    ? shiftMonth(compareStart, 1)
    : `${Number(value) + 1}-01`;

  // 累计截止快照的集合差，才能排除“旧技能本期重新出现”的假新增。
  if (mode === "firstSeen") {
    return {
      base: { toMonth: compareStart },
      compare: { toMonth: compareEnd },
      baseLabel: granularity === "month"
        ? `截至 ${shiftMonth(compareStart, -1)}`
        : `截至 ${Number(value) - 1}`,
      compareLabel: granularity === "month" ? `截至 ${compareStart}` : `截至 ${value}`,
    };
  }

  if (granularity === "month") {
    const baseStart = shiftMonth(compareStart, -1);
    return {
      base: { fromMonth: baseStart, toMonth: compareStart },
      compare: { fromMonth: compareStart, toMonth: compareEnd },
      baseLabel: baseStart,
      compareLabel: compareStart,
    };
  }
  const year = Number(value);
  return {
    base: { fromMonth: `${year - 1}-01`, toMonth: `${year}-01` },
    compare: { fromMonth: `${year}-01`, toMonth: compareEnd },
    baseLabel: String(year - 1),
    compareLabel: String(year),
  };
}
