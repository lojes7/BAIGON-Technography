import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Award, FileText, Layers, History, Target, Clock, Upload } from "lucide-react";
import { analyzeMyResumeSkills } from "../services/resume";
import { batchGetMySkills, listMySkills } from "../services/user";
import type { UserSkillData } from "../types/api";
import { PageHeader } from "../components/ui";
import AbilityRadialGraph from "../components/AbilityRadialGraph";

/* 深蓝主色系（与其他改造页一致） */
const P = {
  primary: "#1E4C8F",
  primaryDeep: "#12305E",
  sky: "#A9C8EC",
  skySoft: "#DCE8F6",
  ink: "#16283E",
  muted: "#5E6E82",
  faint: "#8B99AB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

const PROFICIENCY_LABEL: Record<string, string> = {
  EXPERT: "精通", ADVANCED: "熟练", FAMILIAR: "熟悉", BASIC: "基础",
};
const PROFICIENCY_COLOR: Record<string, { c: string; bg: string }> = {
  EXPERT: { c: P.red, bg: "#FBEAE7" },
  ADVANCED: { c: P.amber, bg: P.amberBg },
  FAMILIAR: { c: P.primary, bg: P.skySoft },
  BASIC: { c: P.faint, bg: "#EEF2F6" },
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
  const navigate = useNavigate();
  const [items, setItems] = useState<UserSkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [latest, setLatest] = useState<UserSkillData[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchSkills = () => {
    setLoading(true);
    listMySkills({ page: page - 1, pageSize })
      .then((res) => {
        setItems(res.data.items ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchSkills(); }, [page]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setLatest(null);
    try {
      const res = await analyzeMyResumeSkills();
      const ids = res.data.userSkillRecordIds ?? [];
      const details = ids.length > 0 ? await batchGetMySkills(ids) : null;
      setLatest(details?.data.items ?? []);
      toast.success("技能分析完成");
      setPage(1);
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

  /* 统计（来自真实数据） */
  const expertCount = items.filter(s => s.proficiency === "EXPERT").length;
  const recentTime = groups[0]?.createdAt ? new Date(groups[0].createdAt).toLocaleDateString() : "-";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), "我的能力"]}
        title="我的能力"
        description="基于最新简历调用 AI 识别技能并生成能力画像 · 历次分析沉淀为能力时间线，供人岗匹配诊断复用"
      />

      {/* KPI 统计卡区 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 主卡：深蓝渐变 */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden flex flex-col" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 132 }}>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>识别技能总数</span>
            <Layers size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
          </div>
          <div className="text-[34px] font-mono font-semibold mt-1 leading-tight">{total}<span className="text-[13px] font-normal ml-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>项</span></div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)" }}>
            其中精通 {expertCount} 项
          </span>
        </div>
        {[
          { label: "分析批次", value: groups.length, unit: "次", chip: "历次简历快照", icon: History, iconBg: P.skySoft, iconColor: P.primary },
          { label: "最新批次技能", value: currentSkills.length, unit: "项", chip: groups.length ? `分析于 ${recentTime}` : "待分析", icon: Award, iconBg: P.greenBg, iconColor: P.green },
          { label: "我的简历", value: groups.length > 0 ? "已就绪" : "待完善", unit: "", chip: groups.length ? "AI 分析素材就绪" : "请先上传简历", icon: FileText, iconBg: P.amberBg, iconColor: P.amber },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                <k.icon size={14} style={{ color: k.iconColor }} />
              </span>
            </div>
            <div className="text-[26px] font-mono font-semibold mt-1 leading-tight" style={{ color: P.ink }}>
              {k.value}{k.unit && <span className="text-[13px] font-normal ml-1" style={{ color: P.faint }}>{k.unit}</span>}
            </div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: P.skySoft, color: P.primary }}>
              {k.chip}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1 · AI 分析我的简历（业务入口） */}
      <StepCard step={1} title="AI 分析我的简历" hint="系统自动选取最新简历正文，提取有原文证据的技能并保留本次快照"
        action={
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
              style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
              onClick={() => navigate("/my-resume")}
            >
              <Upload size={12} />去上传/完善简历
            </button>
            <button
              className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
              style={{ background: P.primary, color: "#fff" }}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              <Sparkles size={13} className={analyzing ? "animate-spin" : ""} />
              {analyzing ? "分析中..." : "开始分析"}
            </button>
          </div>
        }
      >
        <div className="px-5 py-4">
          {analyzing && (
            <div className="rounded-lg px-4 py-3 mb-3 text-[12.5px] flex items-center gap-2" style={{ background: P.skySoft, color: P.primary }}>
              <Sparkles size={13} className="animate-spin" />
              正在读取最新简历正文并调用 AI 识别技能，通常需要 10~30 秒...
            </div>
          )}
          {latest === null && !analyzing && (
            <div className="rounded-lg py-6 text-center" style={{ background: P.bgSoft, border: `1px dashed ${P.border}` }}>
              <div className="text-[13px] font-medium" style={{ color: P.ink }}>尚未发起本次分析</div>
              <div className="text-[12px] mt-1" style={{ color: P.faint }}>点击右上角「开始分析」，识别结果将显示在此处并沉淀到下方时间线</div>
            </div>
          )}
          {latest && !analyzing && (
            <div className="rounded-xl p-4" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Award size={14} style={{ color: P.green }} />
                <span className="text-[13px] font-medium" style={{ color: P.ink }}>
                  本次识别 {latest.length} 项技能
                </span>
              </div>
              {latest.length === 0 ? (
                <div className="text-[13px]" style={{ color: P.faint }}>未识别出技能，请先上传或完善简历</div>
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
      </StepCard>

      {/* STEP 2 · 能力图谱 */}
      <StepCard step={2} title="能力图谱" hint="最新快照的可视化画像，颗粒度到技能点 · 熟练度以颜色区分"
        action={
          <button
            className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap cursor-pointer"
            style={{ color: P.primary }}
            onClick={() => navigate("/skill-compare")}
          >
            <Target size={12} />用此画像进行人岗匹配诊断 →
          </button>
        }
      >
        <div className="px-6 py-4">
          {currentSkills.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: P.faint }}>
              暂无能力画像，完成上方「开始分析」后自动生成
            </div>
          ) : (
            <AbilityRadialGraph
              centerLabel="我的能力"
              abilities={currentSkills.map((s) => ({
                name: s.skillName,
                proficiency: s.proficiency,
                evidence: s.evidence,
              }))}
              emptyHint="暂无能力，点击上方「开始分析」生成能力图谱"
            />
          )}
        </div>
      </StepCard>

      {/* STEP 3 · 能力时间线 */}
      <StepCard step={3} title="能力时间线" hint="历次分析按批次沉淀，可追溯能力成长轨迹"
        action={
          <button
            className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap cursor-pointer"
            style={{ color: P.primary }}
            onClick={fetchSkills}
          >
            <RefreshCw size={12} />刷新
          </button>
        }
      >
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: P.faint }}>{t("common.loading")}</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-10 text-center" style={{ color: P.faint }}>
            <Clock size={22} style={{ margin: "0 auto 8px", color: P.sky }} />
            <div className="text-[13px] font-medium" style={{ color: P.ink }}>暂无能力记录</div>
            <div className="text-[12px] mt-1">完成「开始分析」后将生成第一份能力快照</div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-0 max-h-[520px] overflow-y-auto">
            {groups.map((g, gi) => (
              <div key={g.resumeId} className="flex gap-4">
                {/* 时间轴节点 */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: gi === 0 ? P.primary : P.skySoft }}>
                    <FileText size={14} style={{ color: gi === 0 ? "white" : P.primary }} />
                  </div>
                  {gi < groups.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: P.border }} />}
                </div>
                {/* 批次内容 */}
                <div className="flex-1 min-w-0 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{ color: P.ink }}>
                        {gi === 0 ? "最新能力快照" : `历史批次 #${g.resumeId}`}
                      </span>
                      {gi === 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: P.greenBg, color: P.green }}>
                          当前画像
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[12px]" style={{ color: P.faint }}>
                      {new Date(g.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
                    <div className="flex flex-wrap gap-2">
                      {g.skills.map((s) => (
                        <SkillChip key={String(s.id)} skill={s} showEvidence />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </StepCard>
    </div>
  );
}

/* ═══════════ 小组件 ═══════════ */

function StepCard({ step, title, hint, action, children }: {
  step: number; title: string; hint: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: `1px solid ${P.border}` }}>
        <span className="w-6 h-6 rounded-full text-[12px] flex items-center justify-center text-white font-mono font-medium flex-shrink-0"
          style={{ background: P.primary }}>{step}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{title}</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>{hint}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// 单个技能标签：技能名 + 熟练度，可选展示原文证据
function SkillChip({ skill, showEvidence = false }: { skill: UserSkillData; showEvidence?: boolean }) {
  const pc = PROFICIENCY_COLOR[skill.proficiency] ?? { c: P.faint, bg: "#EEF2F6" };
  return (
    <div className="inline-flex flex-col items-start px-3 py-2 rounded-full text-[13px] max-w-full"
      style={{ background: "white", border: `1px solid ${P.border}` }}>
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pc.c }} />
        <span className="font-medium" style={{ color: P.ink }}>{skill.skillName}</span>
        {skill.proficiency && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ color: pc.c, background: pc.bg }}>
            {PROFICIENCY_LABEL[skill.proficiency] ?? skill.proficiency}
          </span>
        )}
      </span>
      {showEvidence && skill.evidence && (
        <span className="text-[11px] mt-1 leading-relaxed" style={{ color: P.faint }}>{skill.evidence}</span>
      )}
    </div>
  );
}
