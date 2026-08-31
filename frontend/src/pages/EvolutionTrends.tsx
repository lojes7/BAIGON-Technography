// 能力演化趋势 — 岗位技能需求随时间的覆盖率变化（新兴/上升/稳定/衰退）
// 数据来自真实接口 getEvolutionTrends；UI 规范与其他改造页对齐：深蓝色板 + 圆角 2xl 卡片 + 胶囊 chip。
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Flame, Rocket, Scale, ArrowDownRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "../auth/AuthContext";
import { useNav } from "../context/NavContext";
import { getEvolutionTrends } from "../services/analytics";
import type { EvolutionTrendData } from "../types/api";
import { PageHeader, Btn } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

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
  redBg: "#FBEAE7",
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

const DEFAULT_FROM_PERIOD = "2025H1";
const DEFAULT_TO_PERIOD = "2026H1";

// 将 API 的 series 数据转为 recharts 的图表格式
function buildChartData(trendData: EvolutionTrendData) {
  const skillMap = new Map(trendData.skills.map((s) => [s.id, s.name]));
  const periodMap = new Map<string, Record<string, number>>();
  for (const s of trendData.series) {
    const row: Record<string, number> = {};
    for (const p of s.points) {
      row[`skill_${p.skill_id}`] = p.coverage;
    }
    periodMap.set(s.period, row);
  }
  // 只取前5个技能展示曲线
  const topSkillIds = trendData.skills.slice(0, 5).map((s) => s.id);
  return {
    chartData: Array.from(periodMap.entries()).map(([period, values]) => ({
      period,
      ...Object.fromEntries(topSkillIds.map((id) => [`skill_${id}`, values[`skill_${id}`] ?? 0])),
    })),
    topSkills: trendData.skills.slice(0, 5),
    skillMap,
  };
}

const LINE_COLORS = [P.primary, P.green, "#7C3AED", "#DB2777", P.amber];

function EvolutionTrendsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNav();
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const isAnalyst = user?.role === "analyst";
  const canManage = isAdmin || isAnalyst;
  const [confirmRecalc, setConfirmRecalc] = useState(false);

  const [trendData, setTrendData] = useState<EvolutionTrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await getEvolutionTrends({
          from_period: DEFAULT_FROM_PERIOD,
          to_period: DEFAULT_TO_PERIOD,
        });
        if (!cancelled) setTrendData(res.data);
      } catch {
        // API 未就绪时展示空状态
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const statusColors: Record<string, string> = {
    EMERGING: "#7C3AED", emerging: "#7C3AED",
    RISING: P.green, rising: P.green,
    STABLE: P.primary, stable: P.primary,
    DECLINING: P.red, declining: P.red,
  };
  const statusLabels: Record<string, string> = {
    EMERGING: "新兴", emerging: "新兴",
    RISING: "上升", rising: "上升",
    STABLE: "稳定", stable: "稳定",
    DECLINING: "衰退", declining: "衰退",
  };

  const chartInfo = trendData ? buildChartData(trendData) : null;

  const kpiCards = [
    { key: "emerging", label: t("page.evolutionTrends.emerging"), value: trendData?.summary.emerging, chip: t("page.evolutionTrends.emergingSub"), icon: Flame, iconBg: "#EDE9FE", iconColor: "#7C3AED" },
    { key: "rising", label: t("page.evolutionTrends.rising"), value: trendData?.summary.rising, chip: t("page.evolutionTrends.risingSub"), icon: Rocket, iconBg: P.greenBg, iconColor: P.green },
    { key: "stable", label: t("page.evolutionTrends.stable"), value: trendData?.summary.stable, chip: t("page.evolutionTrends.stableSub"), icon: Scale, iconBg: P.skySoft, iconColor: P.primary },
    { key: "declining", label: t("page.evolutionTrends.declining"), value: trendData?.summary.declining, chip: t("page.evolutionTrends.decliningSub"), icon: ArrowDownRight, iconBg: P.redBg, iconColor: P.red },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.evolution"), t("nav.evolutionTrends")]}
        title={t("page.evolutionTrends.title")}
        description={t("page.evolutionTrends.desc")}
        actions={canManage ? <Btn icon={RefreshCw} onClick={() => setConfirmRecalc(true)}>{t("page.evolutionTrends.recalculate")}</Btn> : undefined}
      />

      {/* KPI 统计卡区 */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(k => (
          <div key={k.key} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                <k.icon size={14} style={{ color: k.iconColor }} />
              </span>
            </div>
            <div className="text-[26px] font-mono font-semibold mt-1 leading-tight" style={{ color: P.ink }}>
              {loading ? "—" : (k.value ?? "—")}
              <span className="text-[13px] font-normal ml-1" style={{ color: P.faint }}>项</span>
            </div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: P.skySoft, color: P.primary }}>
              {k.chip}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 趋势折线图 */}
        <div className="col-span-2 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.evolutionTrends.trendChart")}</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>前 5 个热门技能的岗位覆盖率走势（%）</div>
          </div>
          <div className="px-4 pb-4 pt-2">
            {chartInfo && chartInfo.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartInfo.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: P.faint }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: P.faint }} tickLine={false} axisLine={false} unit="%" width={35} />
                  <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {chartInfo.topSkills.map((sk, idx) => (
                    <Line
                      key={sk.id}
                      type="monotone"
                      dataKey={`skill_${sk.id}`}
                      name={sk.name}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-[13px]" style={{ color: P.faint }}>
                {loading ? "正在加载趋势数据..." : "暂无趋势数据"}
              </div>
            )}
          </div>
        </div>

        {/* 涨幅排行 */}
        <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.evolutionTrends.rankings")}</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>按覆盖率变化排序</div>
          </div>
          <div className="px-2 py-1">
            {trendData?.ranking?.length ? (
              trendData.ranking.map((s, i) => {
                const up = s.change_pp >= 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${P.border}` }}>
                    <span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0 font-mono font-medium"
                      style={{ background: i < 3 ? P.primary : P.skySoft, color: i < 3 ? "#fff" : P.muted }}>{s.rank}</span>
                    <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: P.ink }}>{s.name}</span>
                    <span className="font-mono text-[12px] flex-shrink-0"
                      style={{ color: up ? P.green : P.red }}>
                      {up ? "+" : ""}{s.change_pp.toFixed(1)}pp
                    </span>
                    {up
                      ? <TrendingUp size={13} style={{ color: P.green }} className="flex-shrink-0" />
                      : <TrendingDown size={13} style={{ color: P.red }} className="flex-shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: P.faint }}>
                {loading ? "加载中..." : "暂无排行数据"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 明细表 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.evolutionTrends.detailTable")}</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>技能覆盖率现状与演化状态</div>
        </div>
        {trendData?.details?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: P.skySoft }}>
                  {["page.evolutionTrends.colSkill", "page.evolutionTrends.colCoverage", "page.evolutionTrends.colChange", "page.evolutionTrends.colCompanies", "page.evolutionTrends.colStatus"].map(key => (
                    <th key={key} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.muted }}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trendData.details.map((row, i) => {
                  const up = row.change_pp >= 0;
                  const statusKey = (row.status || "stable").toLowerCase();
                  return (
                    <tr key={i} className="hover:bg-[#FAFBFD] transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                      <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{row.name}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: P.ink }}>{row.current_coverage.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium"
                          style={{ color: up ? P.green : P.red }}>
                          {up ? "+" : ""}{row.change_pp.toFixed(1)}pp
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: P.ink }}>{row.company_count}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ color: statusColors[statusKey] || P.primary, background: `${statusColors[statusKey] || P.primary}15` }}>
                          {statusLabels[statusKey] || row.status || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-[13px]" style={{ color: P.faint }}>
            {loading ? "正在加载明细数据..." : "暂无明细数据"}
          </div>
        )}
      </div>
      {confirmRecalc && (
        <ConfirmDialog
          title={t("page.evolutionTrends.recalcTitle")}
          body={t("page.evolutionTrends.recalcBody")}
          confirmLabel={t("page.evolutionTrends.recalcConfirm")}
          onConfirm={() => toast.success(t("msg.recalculateStarted"), { description: t("msg.recalculateStartedDesc") })}
          onClose={() => setConfirmRecalc(false)}
        />
      )}
      {isTeacher && (
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
            style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
            onClick={() => nav("programs")}
          >
            查看培养方案匹配度 <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default EvolutionTrendsPage;
