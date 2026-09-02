import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";
import SkillGraphCanvas from "../components/skill-graph/SkillGraphCanvas";
import SkillGraphScopeSelector from "../components/skill-graph/SkillGraphScopeSelector";
import type { SkillGraphViewData } from "../types/api";
import {
  buildComparisonBounds,
  buildSkillGraphView,
  type GraphMatchMode,
  type GraphScopeSelection,
  type TimelineGranularity,
} from "../utils/skill-graph";
import { getSkillGraph, lookupSkillGraphMetrics } from "../services/occupation";
import { lookupCanonicalSkills } from "../services/skill-resolution";
import { useNav } from "../context/NavContext";

type ChangeType = "added" | "removed" | "increased" | "decreased";

interface ChangeRow {
  type: ChangeType;
  skillId: string;
  skillName: string;
  baseCoverage: number;
  compareCoverage: number;
  delta: number;
}

interface MatchResult {
  base: SkillGraphViewData;
  compare: SkillGraphViewData;
  baseLabel: string;
  compareLabel: string;
  scopeName: string;
  mode: GraphMatchMode;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildChanges(result: MatchResult | null): ChangeRow[] {
  if (!result) return [];
  const baseMap = new Map(result.base.skills.map((skill) => [skill.skillId, skill]));
  const compareMap = new Map(result.compare.skills.map((skill) => [skill.skillId, skill]));
  const rows: ChangeRow[] = [];

  compareMap.forEach((skill, skillId) => {
    const baseSkill = baseMap.get(skillId);
    if (!baseSkill) {
      rows.push({
        type: "added",
        skillId,
        skillName: skill.skillName,
        baseCoverage: 0,
        compareCoverage: skill.coverage,
        delta: skill.coverage * 100,
      });
      return;
    }
    if (result.mode === "firstSeen") return;
    const delta = (skill.coverage - baseSkill.coverage) * 100;
    if (Math.abs(delta) >= 0.01) {
      rows.push({
        type: delta > 0 ? "increased" : "decreased",
        skillId,
        skillName: skill.skillName,
        baseCoverage: baseSkill.coverage,
        compareCoverage: skill.coverage,
        delta,
      });
    }
  });
  if (result.mode === "adjacent") {
    baseMap.forEach((skill, skillId) => {
      if (!compareMap.has(skillId)) {
        rows.push({
          type: "removed",
          skillId,
          skillName: skill.skillName,
          baseCoverage: skill.coverage,
          compareCoverage: 0,
          delta: -skill.coverage * 100,
        });
      }
    });
  }

  const order: Record<ChangeType, number> = { added: 0, removed: 1, increased: 2, decreased: 3 };
  return rows.sort((left, right) => order[left.type] - order[right.type] || Math.abs(right.delta) - Math.abs(left.delta));
}

export default function GraphSnapshotsPage() {
  const { t } = useTranslation();
  const nav = useNav();
  const [scope, setScope] = useState<GraphScopeSelection | null>(null);
  const [matchMode, setMatchMode] = useState<GraphMatchMode>("firstSeen");
  const [granularity, setGranularity] = useState<TimelineGranularity>("month");
  const [monthValue, setMonthValue] = useState(currentMonth());
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);

  const changes = useMemo(() => buildChanges(result), [result]);
  const addedIds = useMemo(() => new Set(changes.filter((row) => row.type === "added").map((row) => row.skillId)), [changes]);
  const removedIds = useMemo(() => new Set(changes.filter((row) => row.type === "removed").map((row) => row.skillId)), [changes]);
  const increasedCount = changes.filter((row) => row.type === "increased").length;
  const decreasedCount = changes.filter((row) => row.type === "decreased").length;

  const invalidateMatch = () => {
    requestVersion.current += 1;
    setResult(null);
    setLoading(false);
  };

  const changeScope = (value: GraphScopeSelection | null) => {
    setScope(value);
    invalidateMatch();
  };

  const runMatch = async () => {
    if (!scope) {
      toast.error("请先选择职业或专业");
      return;
    }
    const value = granularity === "month" ? monthValue : yearValue;
    let bounds: ReturnType<typeof buildComparisonBounds>;
    try {
      bounds = buildComparisonBounds(granularity, value, matchMode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "对比时间无效");
      return;
    }

    const currentRequest = requestVersion.current + 1;
    requestVersion.current = currentRequest;
    setLoading(true);
    try {
      const [baseResponse, compareResponse] = await Promise.all([
        getSkillGraph(scope.type, scope.id, bounds.base),
        getSkillGraph(scope.type, scope.id, bounds.compare),
      ]);
      const allSkillIds = Array.from(new Set([
        ...baseResponse.data.directSkillIds,
        ...compareResponse.data.directSkillIds,
      ]));
      // 两个快照共用一次名称批量查询；关系指标仍按各自时间窗口批量读取。
      const [details, baseMetrics, compareMetrics] = await Promise.all([
        lookupCanonicalSkills(allSkillIds),
        lookupSkillGraphMetrics(scope.type, scope.id, baseResponse.data.directSkillIds, bounds.base),
        lookupSkillGraphMetrics(scope.type, scope.id, compareResponse.data.directSkillIds, bounds.compare),
      ]);
      if (requestVersion.current !== currentRequest) return;
      setResult({
        base: buildSkillGraphView(baseResponse.data, details.data.items, baseMetrics.data.items),
        compare: buildSkillGraphView(compareResponse.data, details.data.items, compareMetrics.data.items),
        baseLabel: bounds.baseLabel,
        compareLabel: bounds.compareLabel,
        scopeName: scope.name,
        mode: matchMode,
      });
    } catch (error) {
      if (requestVersion.current !== currentRequest) return;
      toast.error(error instanceof Error && !error.message.startsWith("请求失败")
        ? error.message : "图谱对比加载失败");
      setResult(null);
    } finally {
      if (requestVersion.current === currentRequest) setLoading(false);
    }
  };

  const changeConfig: Record<ChangeType, { label: string; color: string; symbol: string }> = {
    added: { label: "新增", color: T.emerging, symbol: "+" },
    removed: { label: "消失", color: T.risk, symbol: "−" },
    increased: { label: "覆盖度上升", color: T.stable, symbol: "↑" },
    decreased: { label: "覆盖度下降", color: T.declining, symbol: "↓" },
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.graphSnapshots")]}
        title="技能图谱 Graph Match"
        description="对两个时间窗口的一跳直接技能 ID 与覆盖指标进行比较；技能名称按 ID 并集一次批量解析。"
        actions={<Btn variant="secondary" size="sm" icon={ArrowLeft} onClick={() => nav("graph-browser")}>返回图谱浏览</Btn>}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px]" style={{ color: T.info }}>对比对象</label>
            <SkillGraphScopeSelector value={scope} onChange={changeScope} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px]" style={{ color: T.info }}>粒度</label>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value as TimelineGranularity)} className="h-9 px-3 rounded-md text-[13px] bg-white" style={{ border: `1px solid ${T.border}`, color: T.ink }}>
              <option value="month">按月</option>
              <option value="year">按年</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px]" style={{ color: T.info }}>{granularity === "month" ? "目标月份" : "目标年份"}</label>
            {granularity === "month" ? (
              <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} className="h-9 px-3 rounded-md text-[13px] bg-white" style={{ border: `1px solid ${T.border}`, color: T.ink }} />
            ) : (
              <input type="number" value={yearValue} onChange={(e) => setYearValue(e.target.value)} className="h-9 px-3 rounded-md text-[13px] bg-white" style={{ border: `1px solid ${T.border}`, color: T.ink }} />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px]" style={{ color: T.info }}>对比模式</label>
            <select value={matchMode} onChange={(e) => setMatchMode(e.target.value as GraphMatchMode)} className="h-9 px-3 rounded-md text-[13px] bg-white" style={{ border: `1px solid ${T.border}`, color: T.ink }}>
              <option value="firstSeen">首次出现</option>
              <option value="adjacent">相邻周期</option>
            </select>
          </div>
          <Btn variant="primary" onClick={() => void runMatch()} disabled={loading || !scope} icon={ArrowRight}>开始对比</Btn>
        </div>
      </Card>

      {!result && !loading ? (
        <Card>
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-[13px]" style={{ color: T.info }}>
            <span className="text-[15px] font-medium" style={{ color: T.ink }}>选择对象和目标周期后开始对比</span>
            首次出现模式下，目标月份 2026-05 会比较“截至 4 月”与“截至 5 月”的累计技能集合。
          </div>
        </Card>
      ) : loading ? (
        <Card><div className="h-56 flex items-center justify-center text-[13px]" style={{ color: T.info }}>正在读取两个时间窗口的技能图谱…</div></Card>
      ) : result ? (
        <>
          <div className="flex items-center justify-center gap-3 text-[13px]" style={{ color: T.ink }}>
            <span className="px-3 py-1.5 rounded bg-white font-mono" style={{ border: `1px solid ${T.border}` }}>{result.baseLabel}</span>
            <ArrowRight size={16} style={{ color: T.info }} />
            <span className="px-3 py-1.5 rounded bg-white font-mono" style={{ border: `1px solid ${T.border}` }}>{result.compareLabel}</span>
          </div>

          {result.mode === "firstSeen" ? (
            <div className="grid grid-cols-3 gap-4">
              <MetricCard title="本周期首次出现" value={addedIds.size} sub="排除历史技能重新出现" />
              <MetricCard title="基准累计技能" value={result.base.skills.length} sub={result.baseLabel} />
              <MetricCard title="目标累计技能" value={result.compare.skills.length} sub={result.compareLabel} />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <MetricCard title="新增直接技能" value={addedIds.size} sub="相对上一周期新增" />
              <MetricCard title="消失直接技能" value={removedIds.size} sub="目标周期未再出现" severity={removedIds.size > 0 ? "warning" : "normal"} />
              <MetricCard title="覆盖度上升" value={increasedCount} sub="两个周期均出现" />
              <MetricCard title="覆盖度下降" value={decreasedCount} sub="两个周期均出现" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card title={`基准图谱 · ${result.baseLabel}`}>
              <SkillGraphCanvas data={result.base} scopeName={result.scopeName} removedSkillIds={removedIds} maxHeight={430} />
              <div className="px-4 py-3 text-[11px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
                直接技能 {result.base.skills.length}{result.mode === "adjacent" ? " · 红色为下一周期消失" : ""}
              </div>
            </Card>
            <Card title={`目标图谱 · ${result.compareLabel}`}>
              <SkillGraphCanvas data={result.compare} scopeName={result.scopeName} addedSkillIds={addedIds} maxHeight={430} />
              <div className="px-4 py-3 text-[11px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
                直接技能 {result.compare.skills.length} · 绿色为本周期新增
              </div>
            </Card>
          </div>

          <Card title="技能变化明细">
            {changes.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>
                {result.mode === "firstSeen" ? "目标周期内没有首次出现的直接技能" : "两个周期的直接技能集合与覆盖度没有变化"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr style={{ background: T.cloud }}>
                    {["变化", "技能", "技能 ID", `${result.baseLabel} 覆盖度`, `${result.compareLabel} 覆盖度`, "变化值"].map((heading) => (
                      <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>{heading}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {changes.map((row) => {
                      const config = changeConfig[row.type];
                      return (
                        <tr key={`${row.type}-${row.skillId}`} className="hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium" style={{ color: config.color, background: `${config.color}18` }}>
                              <span className="font-mono">{config.symbol}</span>{config.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.skillName}</td>
                          <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{row.skillId}</td>
                          <td className="px-4 py-3 font-mono" style={{ color: T.info }}>{(row.baseCoverage * 100).toFixed(1)}%</td>
                          <td className="px-4 py-3 font-mono" style={{ color: T.info }}>{(row.compareCoverage * 100).toFixed(1)}%</td>
                          <td className="px-4 py-3 font-mono" style={{ color: config.color }}>{row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}pp</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
