import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { useNav } from "../context/NavContext";
import { getEvolutionTrends } from "../services/analytics";
import type { EvolutionTrendData } from "../types/api";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

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

const LINE_COLORS = [T.teal, T.emerging, "#7c3aed", "#db2777", T.stable];

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
    EMERGING: T.emerging, emerging: T.emerging,
    RISING: T.stable, rising: T.stable,
    STABLE: T.info, stable: T.info,
    DECLINING: T.declining, declining: T.declining,
  };

  const chartInfo = trendData ? buildChartData(trendData) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.evolution"), t("nav.evolutionTrends")]}
        title={t("page.evolutionTrends.title")}
        description={t("page.evolutionTrends.desc")}
        actions={canManage ? <Btn icon={RefreshCw} onClick={() => setConfirmRecalc(true)}>{t("page.evolutionTrends.recalculate")}</Btn> : undefined}
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title={t("page.evolutionTrends.emerging")}
          value={loading ? "—" : String(trendData?.summary.emerging ?? "—")}
          trend={{ label: t("page.evolutionTrends.emergingSub"), up: true }}
        />
        <MetricCard
          title={t("page.evolutionTrends.rising")}
          value={loading ? "—" : String(trendData?.summary.rising ?? "—")}
          trend={{ label: t("page.evolutionTrends.risingSub"), up: true }}
        />
        <MetricCard
          title={t("page.evolutionTrends.stable")}
          value={loading ? "—" : String(trendData?.summary.stable ?? "—")}
          trend={{ label: t("page.evolutionTrends.stableSub") }}
        />
        <MetricCard
          title={t("page.evolutionTrends.declining")}
          value={loading ? "—" : String(trendData?.summary.declining ?? "—")}
          trend={{ label: t("page.evolutionTrends.decliningSub"), up: false }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title={t("page.evolutionTrends.trendChart")} className="col-span-2">
          <div className="px-4 pb-4 pt-2">
            {chartInfo && chartInfo.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartInfo.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.cloud} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} unit="%" width={35} />
                  <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 6 }} />
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
              <div className="flex items-center justify-center h-[240px] text-[13px]" style={{ color: T.info }}>
                {loading ? "正在加载趋势数据..." : "暂无趋势数据"}
              </div>
            )}
          </div>
        </Card>

        {/* Rankings */}
        <Card title={t("page.evolutionTrends.rankings")}>
          <div className="divide-y" style={{ borderColor: T.cloud }}>
            {trendData?.ranking?.length ? (
              trendData.ranking.map((s, i) => {
                const up = s.change_pp >= 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-5 text-center font-mono text-[12px]" style={{ color: T.info }}>{s.rank}</span>
                    <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{s.name}</span>
                    <span className="font-mono text-[12px]"
                      style={{ color: up ? T.emerging : T.declining }}>
                      {up ? "+" : ""}{s.change_pp.toFixed(1)}pp
                    </span>
                    {up
                      ? <TrendingUp size={13} style={{ color: T.emerging }} />
                      : <TrendingDown size={13} style={{ color: T.declining }} />}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>
                {loading ? "加载中..." : "暂无排行数据"}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Detail table */}
      <Card title={t("page.evolutionTrends.detailTable")}>
        {trendData?.details?.length ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["page.evolutionTrends.colSkill", "page.evolutionTrends.colCoverage", "page.evolutionTrends.colChange", "page.evolutionTrends.colCompanies", "page.evolutionTrends.colStatus"].map(key => (
                  <th key={key} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trendData.details.map((row, i) => {
                const up = row.change_pp >= 0;
                const statusKey = (row.status || "stable").toLowerCase();
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.name}</td>
                    <td className="px-4 py-3 font-mono">{row.current_coverage.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium"
                        style={{ color: up ? T.emerging : T.declining }}>
                        {up ? "+" : ""}{row.change_pp.toFixed(1)}pp
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{row.company_count}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{ color: statusColors[statusKey] || T.info, background: `${statusColors[statusKey] || T.info}18` }}>
                        {row.status || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>
            {loading ? "正在加载明细数据..." : "暂无明细数据"}
          </div>
        )}
      </Card>
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
          <Btn variant="secondary" icon={ArrowRight} onClick={() => nav("programs")}>
            查看培养方案匹配度 →
          </Btn>
        </div>
      )}
    </div>
  );
}

export default EvolutionTrendsPage;
