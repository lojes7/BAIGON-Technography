import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSearch, GitCompareArrows, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { useNav } from "../context/NavContext";
import SkillGraphCanvas from "../components/skill-graph/SkillGraphCanvas";
import SkillGraphEvidenceDrawer from "../components/skill-graph/SkillGraphEvidenceDrawer";
import SkillGraphScopeSelector from "../components/skill-graph/SkillGraphScopeSelector";
import SkillGraphTimelineFilter from "../components/skill-graph/SkillGraphTimelineFilter";
import { Btn, Card, MetricCard, PageHeader } from "../components/ui";
import { getSkillGraph } from "../services/occupation";
import type { SkillGraphData } from "../types/api";
import {
  buildTimelineBounds,
  type GraphScopeSelection,
  type TimelineBounds,
  type TimelineGranularity,
  type TimelineMode,
} from "../utils/skill-graph";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function timelineLabel(bounds: TimelineBounds) {
  if (!bounds.fromMonth && !bounds.toMonth) return "全部时间";
  if (!bounds.fromMonth) return `${bounds.toMonth} 之前`;
  if (!bounds.toMonth) return `${bounds.fromMonth} 起`;
  return `${bounds.fromMonth} 至 ${bounds.toMonth}（不含上界）`;
}

export default function GraphBrowserPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNav();
  const [scope, setScope] = useState<GraphScopeSelection | null>(null);
  const [mode, setMode] = useState<TimelineMode>("all");
  const [granularity, setGranularity] = useState<TimelineGranularity>("month");
  const [monthValue, setMonthValue] = useState(currentMonth());
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()));
  const [appliedBounds, setAppliedBounds] = useState<TimelineBounds>({});
  const [graph, setGraph] = useState<SkillGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const changeScope = (value: GraphScopeSelection | null) => {
    setScope(value);
    setGraph(null);
    setSelectedSkillId(undefined);
    setEvidenceOpen(false);
  };

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getSkillGraph(scope.type, scope.id, { ...appliedBounds, evidenceLimit: 10 })
        .then((response) => {
          if (cancelled) return;
          setGraph(response.data);
          setSelectedSkillId((current) => response.data.skills.some((skill) => skill.skillId === current) ? current : undefined);
        })
        .catch(() => {
          if (cancelled) return;
          setGraph(null);
          toast.error("技能图谱加载失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scope, appliedBounds]);

  const selectedSkill = useMemo(
    () => graph?.skills.find((skill) => skill.skillId === selectedSkillId),
    [graph, selectedSkillId],
  );
  const parentCount = useMemo(() => new Set(
    graph?.skills.flatMap((skill) => skill.parents.map((parent) => parent.id)) ?? [],
  ).size, [graph]);

  const applyTimeline = () => {
    try {
      const value = granularity === "month" ? monthValue : yearValue;
      setAppliedBounds(buildTimelineBounds(mode, granularity, value));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "时间范围无效");
    }
  };

  const canCompare = Boolean(user);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.graphBrowser")]}
        title="职业 / 专业技能时间图谱"
        description="岗位名称仅作为来源证据；图谱按 occupation_id 或 major_id 聚合直接技能、父技能与岗位覆盖度。"
        actions={canCompare ? (
          <Btn variant="secondary" size="sm" icon={GitCompareArrows} onClick={() => nav("graph-snapshots")}>
            Graph Match
          </Btn>
        ) : undefined}
      />

      <Card>
        <div className="px-5 py-4 space-y-4">
          <SkillGraphScopeSelector value={scope} onChange={changeScope} />
          <div style={{ borderTop: `1px solid ${T.cloud}` }} />
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <SkillGraphTimelineFilter
              mode={mode}
              granularity={granularity}
              value={granularity === "month" ? monthValue : yearValue}
              onModeChange={setMode}
              onGranularityChange={setGranularity}
              onValueChange={granularity === "month" ? setMonthValue : setYearValue}
            />
            <Btn size="sm" icon={RefreshCw} disabled={!scope || loading} onClick={applyTimeline}>
              应用时间筛选
            </Btn>
          </div>
        </div>
      </Card>

      {!scope ? (
        <Card>
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-[13px]" style={{ color: T.info }}>
            <span className="text-[15px] font-medium" style={{ color: T.ink }}>请先选择一个职业或专业</span>
            支持名称或编码搜索，选中后显示该对象的全部直接技能与父技能关系。
          </div>
        </Card>
      ) : loading ? (
        <Card><div className="h-64 flex items-center justify-center text-[13px]" style={{ color: T.info }}>正在加载技能图谱…</div></Card>
      ) : graph ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <MetricCard title="时间范围内岗位数" value={Number(graph.totalJobCount)} sub={timelineLabel(appliedBounds)} />
            <MetricCard title="直接技能数" value={graph.skills.length} sub="仅统计岗位明确贡献的技能" />
            <MetricCard title="关联父技能数" value={parentCount} sub="父技能不继承子技能覆盖度" />
          </div>

          <Card
            title={`${graph.scope.name} · 技能图谱`}
            action={<span className="text-[11px] font-mono" style={{ color: T.info }}>{timelineLabel(appliedBounds)}</span>}
          >
            <SkillGraphCanvas
              data={graph}
              selectedSkillId={selectedSkillId}
              onSkillSelect={setSelectedSkillId}
            />
            <div className="px-4 py-3 flex items-center gap-5 text-[11px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: T.stable }} />直接技能（圆内为覆盖度）</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ border: `1px dashed ${T.teal}` }} />层次父技能</span>
              <span>箭头：父技能 → 直接技能</span>
            </div>
          </Card>

          {selectedSkill && (
            <Card title={`技能详情 · ${selectedSkill.skillName}`}>
              <div className="px-5 py-4 flex items-center gap-8 flex-wrap text-[13px]">
                <div><span style={{ color: T.info }}>覆盖岗位 </span><span className="font-mono font-medium" style={{ color: T.ink }}>{Number(selectedSkill.jobCount)}</span></div>
                <div><span style={{ color: T.info }}>覆盖度 </span><span className="font-mono font-medium" style={{ color: T.emerging }}>{(selectedSkill.coverage * 100).toFixed(1)}%</span></div>
                <div className="flex-1 min-w-60"><span style={{ color: T.info }}>父技能 </span><span style={{ color: T.ink }}>{selectedSkill.parents.map((parent) => parent.name).join("、") || "无"}</span></div>
                <Btn variant="secondary" size="sm" icon={FileSearch} onClick={() => setEvidenceOpen(true)}>
                  查看岗位证据（{selectedSkill.evidenceJobs.length}）
                </Btn>
              </div>
            </Card>
          )}

          <Card title="直接技能明细">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr style={{ background: T.cloud }}>
                  {["技能", "覆盖岗位数", "覆盖度", "父技能", "代表岗位证据"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {graph.skills.map((skill) => (
                    <tr key={skill.skillId} className="hover:bg-gray-50 cursor-pointer" style={{ borderTop: `1px solid ${T.cloud}` }} onClick={() => setSelectedSkillId(skill.skillId)}>
                      <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{skill.skillName}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: T.ink }}>{Number(skill.jobCount)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: T.emerging }}>{(skill.coverage * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3" style={{ color: T.info }}>{skill.parents.map((parent) => parent.name).join("、") || "—"}</td>
                      <td className="px-4 py-3" style={{ color: T.info }}>{skill.evidenceJobs.map((job) => job.jobName).filter(Boolean).slice(0, 3).join("、") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {evidenceOpen && selectedSkill && (
        <SkillGraphEvidenceDrawer
          skillName={selectedSkill.skillName}
          jobCount={Number(selectedSkill.jobCount)}
          items={selectedSkill.evidenceJobs}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </div>
  );
}
