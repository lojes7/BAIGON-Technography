// 一键调用 AI 分析最新简历技能，并展示历次技能识别的能力时间线。
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Award, FileText } from "lucide-react";
import T from "../constants/tokens";
import { analyzeMyResumeSkills } from "../services/resume";
import { listMySkills } from "../services/user";
import type { UserSkillData } from "../types/api";
import { PageHeader, Btn, Card } from "../components/ui";
import AbilityRadialGraph from "../components/AbilityRadialGraph";


const PROFICIENCY_LABEL: Record<string, string> = {
  EXPERT: "精通", ADVANCED: "熟练", FAMILIAR: "熟悉", BASIC: "基础",
};
const PROFICIENCY_COLOR: Record<string, string> = {
  EXPERT: T.emerging, ADVANCED: T.teal, FAMILIAR: T.pending, BASIC: T.info,
};

// 按识别批次（resumeId）分组，最新批次在前
function groupByBatch(items: UserSkillData[]): { resumeId: string; createdAt: string; skills: UserSkillData[] }[] {
  const map = new Map<string, { resumeId: string; createdAt: string; skills: UserSkillData[] }>();
  for (const s of items) {
    const key = String(s.resumeId);
    if (!map.has(key)) map.set(key, { resumeId: s.resumeId, createdAt: s.createdAt, skills: [] });
    map.get(key)!.skills.push(s);
  }
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default function MySkills() {
  const { t } = useTranslation();
  const [items, setItems] = useState<UserSkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [latest, setLatest] = useState<UserSkillData[] | null>(null);

  const fetchSkills = () => {
    setLoading(true);
    listMySkills()
      .then((res) => setItems(res.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchSkills(); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setLatest(null);
    try {
      const res = await analyzeMyResumeSkills();
      setLatest(res.data.skills ?? []);
      toast.success("技能分析完成");
      fetchSkills();
    } catch (err) {
      toast.error((err as Error).message || "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const groups = groupByBatch(items);
  // 能力图谱数据：优先本次分析结果，否则取最新一批历史快照
  const currentSkills = latest ?? groups[0]?.skills ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), "我的能力"]}
        title="我的能力"
        description="基于最新简历调用 AI 识别你的技能，并保留历次分析的能力时间线"
      />

      {/* 顶部通栏：能力图谱（核心亮点模块） */}
      <Card title="能力图谱">
        <div className="px-6 py-4">
          {currentSkills.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: T.info }}>
              暂无能力，点击右侧「开始分析」生成能力图谱
            </div>
          ) : (
            <AbilityRadialGraph
              centerLabel="我的能力"
              abilities={currentSkills.map((s) => ({
                name: s.skillName,
                proficiency: s.proficiency,
                evidence: s.evidence,
              }))}
              emptyHint="暂无能力，点击右侧「开始分析」生成能力图谱"
            />
          )}
        </div>
      </Card>

      {/* 下方双栏并排 */}
      <div className="grid grid-cols-2 gap-5">
        {/* 左栏：AI 分析我的简历 */}
        <Card title="AI 分析我的简历">
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.cloud }}>
                <Sparkles size={20} style={{ color: T.teal }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium" style={{ color: T.ink }}>
                  基于我的最新简历重新分析技能
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: T.info }}>
                  系统自动选取最新简历正文，提取有原文证据的技能并保留本次快照
                </div>
              </div>
              <Btn icon={Sparkles} onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "分析中…" : "开始分析"}
              </Btn>
            </div>

            {/* 本次分析结果 */}
            {latest && (
              <div className="rounded-lg p-4" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Award size={14} style={{ color: T.teal }} />
                  <span className="text-[13px] font-medium" style={{ color: T.ink }}>
                    本次识别 {latest.length} 项技能
                  </span>
                </div>
                {latest.length === 0 ? (
                  <div className="text-[13px]" style={{ color: T.info }}>未识别出技能，请先上传或完善简历</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {latest.map((s) => (
                      <SkillChip key={String(s.id)} skill={s} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* 右栏：能力时间线 */}
        <Card title="能力时间线" action={<Btn variant="ghost" size="sm" icon={RefreshCw} onClick={fetchSkills}>刷新</Btn>}>
          {loading ? (
            <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
          ) : groups.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>
              暂无能力记录，点击「开始分析」生成第一份能力快照
            </div>
          ) : (
            <div className="px-6 py-4 space-y-5 max-h-[420px] overflow-y-auto">
              {groups.map((g, gi) => (
                <div key={g.resumeId} className="flex gap-4">
                  {/* 时间轴节点 */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: gi === 0 ? T.teal : T.cloud }}>
                      <FileText size={14} style={{ color: gi === 0 ? "white" : T.info }} />
                    </div>
                    {gi < groups.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: T.border }} />}
                  </div>
                  {/* 批次内容 */}
                  <div className="flex-1 min-w-0 pb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium" style={{ color: T.ink }}>
                        {gi === 0 ? "最新能力快照" : `历史批次 #${g.resumeId}`}
                      </span>
                      <span className="font-mono text-[12px]" style={{ color: T.info }}>
                        {new Date(g.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {g.skills.map((s) => (
                        <SkillChip key={String(s.id)} skill={s} showEvidence />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// 单个技能标签：技能名 + 熟练度，可选展示原文证据
function SkillChip({ skill, showEvidence = false }: { skill: UserSkillData; showEvidence?: boolean }) {
  const color = PROFICIENCY_COLOR[skill.proficiency] ?? T.info;
  return (
    <div className="inline-flex flex-col items-start px-3 py-2 rounded-lg text-[13px]"
      style={{ background: "white", border: `1px solid ${T.border}` }}>
      <span className="flex items-center gap-1.5">
        <span style={{ color: T.ink }}>{skill.skillName}</span>
        {skill.proficiency && (
          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
            style={{ color, background: `${color}15` }}>
            {PROFICIENCY_LABEL[skill.proficiency] ?? skill.proficiency}
          </span>
        )}
      </span>
      {showEvidence && skill.evidence && (
        <span className="text-[11px] mt-1 leading-relaxed" style={{ color: T.info }}>{skill.evidence}</span>
      )}
    </div>
  );
}
