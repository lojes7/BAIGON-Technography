import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";
import { getAbilityGraph, getEvolutionEvents } from "../services/analytics";
import type { AbilityGraphSummary, EvolutionEventItem } from "../types/api";

// 默认查询参数，后续可由用户通过筛选器配置
const DEFAULT_CITY_ID = "1";
const DEFAULT_MAJOR_ID = "1";
const DEFAULT_PERIOD = "2026H1";

export default function AnalystDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  const [graphSummary, setGraphSummary] = useState<AbilityGraphSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<EvolutionEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [graphRes, eventsRes] = await Promise.all([
          getAbilityGraph({ city_id: DEFAULT_CITY_ID, major_id: DEFAULT_MAJOR_ID, period: DEFAULT_PERIOD }),
          getEvolutionEvents({ city_id: DEFAULT_CITY_ID, major_id: DEFAULT_MAJOR_ID, period: DEFAULT_PERIOD, page_size: 10 }),
        ]);
        if (!cancelled) {
          setGraphSummary(graphRes.data.summary);
          setRecentEvents(eventsRes.data.items);
        }
      } catch {
        // API 未就绪时使用空数据，页面展示默认状态
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const eventPriority = (eventType: string) => {
    switch (eventType) {
      case "EMERGING": return { label: "P0", color: T.risk };
      case "DECLINING": return { label: "P1", color: T.pending };
      case "RISING": return { label: "P2", color: T.info };
      default: return { label: "P3", color: T.stable };
    }
  };

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case "EMERGING": return "新兴技能";
      case "RISING": return "热度上升";
      case "DECLINING": return "热度衰退";
      case "STABLE": return "平稳发展";
      default: return type;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "陈分析师"}`}
        description={t("page.analystDashboard.desc")}
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title={t("page.analystDashboard.graphNodes2")}
          value={loading ? "-" : (graphSummary?.node_count?.toLocaleString() ?? "-")}
          sub={graphSummary ? `${graphSummary.job_count} 岗位 · ${graphSummary.skill_count} 技能` : "加载中"}
        />
        <MetricCard
          title={t("page.analystDashboard.pendingRelations")}
          value={loading ? "-" : `${graphSummary?.edge_count ?? "-"} 条`}
          sub={graphSummary ? `${graphSummary.family_count} 个岗位族` : "加载中"}
        />
        <MetricCard
          title={t("page.analystDashboard.evoEvents2")}
          value={loading ? "-" : `${recentEvents.length} 条`}
          sub="近期演化事件"
        />
        <MetricCard
          title={t("page.analystDashboard.dataCoverage2")}
          value={loading ? "-" : graphSummary ? `${graphSummary.tool_count} 工具` : "-"}
          sub="图谱覆盖的工具数"
        />
      </div>

      <Card title={t("page.analystDashboard.reviewQueue2")}>
        {recentEvents.length === 0 && !loading ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>
            暂无演化事件数据，请确认后端服务已接入
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["优先级", "类型", "内容", "变化幅度"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((item, i) => {
                const p = eventPriority(item.event_type);
                return (
                  <tr key={item.event_key || i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3">
                      <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                        style={{ color: p.color, background: `${p.color}18` }}>
                        {p.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{eventTypeLabel(item.event_type)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{item.skill_name}</td>
                    <td className="px-4 py-3 font-mono text-[12px]"
                      style={{ color: item.change_pp >= 0 ? T.emerging : T.declining }}>
                      {item.change_pp > 0 ? "+" : ""}{item.change_pp.toFixed(1)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Btn icon={ArrowRight} onClick={() => nav("/relation-evidence")}>审核待处理关系 →</Btn>
        <Btn variant="secondary" icon={ArrowRight} onClick={() => nav("/evolution-events")}>查看最近演化事件 →</Btn>
      </div>
    </div>
  );
}
