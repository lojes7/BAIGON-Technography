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
import { lookupJobs } from "../services/jobs";
import {
  getSkillGraph,
  listSkillGraphEvidenceJobIds,
  lookupSkillGraphMetrics,
} from "../services/occupation";
import { lookupCanonicalSkills } from "../services/skill-resolution";
import type { JobData, SkillGraphViewData } from "../types/api";
import {
  buildSkillGraphView,
  buildTimelineBounds,
  type GraphScopeSelection,
  type TimelineBounds,
  type TimelineGranularity,
  type TimelineMode,
} from "../utils/skill-graph";

const EVIDENCE_PAGE_SIZE = 20;

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
  const [graph, setGraph] = useState<SkillGraphViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidencePage, setEvidencePage] = useState(1);
  const [evidenceItems, setEvidenceItems] = useState<JobData[]>([]);
  const [evidenceTotal, setEvidenceTotal] = useState(0);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const changeScope = (value: GraphScopeSelection | null) => {
    setScope(value);
    setGraph(null);
    setSelectedSkillId(undefined);
    setEvidenceOpen(false);
    setEvidenceItems([]);
    setEvidenceTotal(0);
  };

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    setLoading(true);
    void getSkillGraph(scope.type, scope.id, appliedBounds)
      .then(async (response) => {
        const skillIds = response.data.directSkillIds;
        const [details, metrics] = await Promise.all([
          lookupCanonicalSkills(skillIds),
          lookupSkillGraphMetrics(scope.type, scope.id, skillIds, appliedBounds),
        ]);
        if (cancelled) return;
        const nextGraph = buildSkillGraphView(response.data, details.data.items, metrics.data.items);
        setGraph(nextGraph);
        setSelectedSkillId((current) => nextGraph.skills.some((skill) => skill.skillId === current) ? current : undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setGraph(null);
        toast.error("技能图谱加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [scope, appliedBounds]);

  const selectedSkill = useMemo(
    () => graph?.skills.find((skill) => skill.skillId === selectedSkillId),
    [graph, selectedSkillId],
  );
  const highestCoverageSkill = useMemo(
    () => graph?.skills.reduce((highest, skill) => (
      !highest || skill.coverage > highest.coverage ? skill : highest
    ), graph.skills[0]),
    [graph],
  );

  // 只有抽屉打开后才读取证据 ID，并对当前页岗位做一次批量详情查询。
  useEffect(() => {
    if (!evidenceOpen || !scope || !selectedSkill) return;
    let cancelled = false;
    setEvidenceLoading(true);
    void listSkillGraphEvidenceJobIds(scope.type, scope.id, selectedSkill.skillId, {
      ...appliedBounds,
      page: evidencePage - 1,
      pageSize: EVIDENCE_PAGE_SIZE,
    })
      .then(async (response) => {
        const jobs = await lookupJobs(response.data.jobIds);
        if (cancelled) return;
        setEvidenceItems(jobs.data.items);
        setEvidenceTotal(response.data.total);
      })
      .catch((error) => {
        if (cancelled) return;
        setEvidenceItems([]);
        setEvidenceTotal(0);
        toast.error(error instanceof Error ? error.message : "岗位证据加载失败");
      })
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });
    return () => { cancelled = true; };
  }, [evidenceOpen, evidencePage, selectedSkill, scope, appliedBounds]);

  const applyTimeline = () => {
    try {
      const value = granularity === "month" ? monthValue : yearValue;
      setAppliedBounds(buildTimelineBounds(mode, granularity, value));
      setEvidencePage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "时间范围无效");
    }
  };

  const openEvidence = () => {
    setEvidenceItems([]);
    setEvidenceTotal(0);
    setEvidencePage(1);
    setEvidenceOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.graphBrowser")]}
        title="职业 / 专业技能时间图谱"
        description="按 occupation_id 或 major_id 聚合岗位直接要求的技能；技能名称、覆盖指标与岗位证据分别按 ID 批量读取。"
        actions={user ? (
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
            支持名称或编码搜索，选中后只显示该对象的一跳直接技能。
          </div>
        </Card>
      ) : loading ? (
        <Card><div className="h-64 flex items-center justify-center text-[13px]" style={{ color: T.info }}>正在加载技能图谱…</div></Card>
      ) : graph ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MetricCard title="直接技能数" value={graph.skills.length} sub={timelineLabel(appliedBounds)} />
            <MetricCard
              title="最高覆盖技能"
              value={highestCoverageSkill?.skillName ?? "—"}
              sub={highestCoverageSkill ? `覆盖度 ${(highestCoverageSkill.coverage * 100).toFixed(1)}%` : "当前范围暂无技能"}
            />
          </div>

          <Card
            title={`${scope.name} · 直接技能图谱`}
            action={<span className="text-[11px] font-mono" style={{ color: T.info }}>{timelineLabel(appliedBounds)}</span>}
          >
            <SkillGraphCanvas
              data={graph}
              scopeName={scope.name}
              selectedSkillId={selectedSkillId}
              onSkillSelect={setSelectedSkillId}
            />
            <div className="px-4 py-3 flex items-center gap-5 text-[11px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: T.stable }} />直接技能（圆内为覆盖度）</span>
              <span>技能层次关系不属于职业 / 专业图谱成员，需在技能词典中单独查看。</span>
            </div>
          </Card>

          {selectedSkill && (
            <Card title={`技能详情 · ${selectedSkill.skillName}`}>
              <div className="px-5 py-4 flex items-center gap-8 flex-wrap text-[13px]">
                <div><span style={{ color: T.info }}>技能 ID </span><span className="font-mono font-medium" style={{ color: T.ink }}>{selectedSkill.skillId}</span></div>
                <div><span style={{ color: T.info }}>覆盖岗位 </span><span className="font-mono font-medium" style={{ color: T.ink }}>{Number(selectedSkill.jobCount)}</span></div>
                <div><span style={{ color: T.info }}>覆盖度 </span><span className="font-mono font-medium" style={{ color: T.emerging }}>{(selectedSkill.coverage * 100).toFixed(1)}%</span></div>
                <Btn variant="secondary" size="sm" icon={FileSearch} onClick={openEvidence}>
                  查看岗位证据
                </Btn>
              </div>
            </Card>
          )}

          <Card title="直接技能明细">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr style={{ background: T.cloud }}>
                  {["技能", "技能 ID", "覆盖岗位数", "覆盖度"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {graph.skills.map((skill) => (
                    <tr key={skill.skillId} className="hover:bg-gray-50 cursor-pointer" style={{ borderTop: `1px solid ${T.cloud}` }} onClick={() => setSelectedSkillId(skill.skillId)}>
                      <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{skill.skillName}</td>
                      <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{skill.skillId}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: T.ink }}>{Number(skill.jobCount)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: T.emerging }}>{(skill.coverage * 100).toFixed(1)}%</td>
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
          items={evidenceItems}
          total={evidenceTotal}
          page={evidencePage}
          totalPages={Math.max(1, Math.ceil(evidenceTotal / EVIDENCE_PAGE_SIZE))}
          loading={evidenceLoading}
          onPageChange={setEvidencePage}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </div>
  );
}
