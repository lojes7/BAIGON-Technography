import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, ArrowRight } from "lucide-react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { getGraphComparison } from "../services/analytics";
import type { GraphComparisonData } from "../types/api";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";
import MiniGraph from "../components/overlay/MiniGraph";

const DEFAULT_BASE_PERIOD = "2025H1";
const DEFAULT_COMPARE_PERIOD = "2026H1";

function GraphSnapshotsPage() {
  const { t } = useTranslation();
  const [base] = useState(DEFAULT_BASE_PERIOD);
  const [compare] = useState(DEFAULT_COMPARE_PERIOD);
  const [data, setData] = useState<GraphComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await getGraphComparison({
          base_period: base,
          compare_period: compare,
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [base, compare]);

  const opColors = { add: T.emerging, rise: T.stable, fall: T.declining, remove: T.risk };
  const opIcons = { add: "+", rise: "↑", fall: "↓", remove: "×" };
  const opLabels: Record<string, string> = { add: t("page.graphSnapshots.new"), rise: t("page.graphSnapshots.rise"), fall: t("page.graphSnapshots.fall"), remove: t("page.graphSnapshots.removed") };

  const s = data?.summary;
  const changes = data?.changes || [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.graph"), t("nav.graphSnapshots")]} title={t("page.graphSnapshots.title")} description={t("page.graphSnapshots.desc")} actions={<Btn variant="secondary" icon={Download} size="sm">{t("page.graphSnapshots.exportDiff")}</Btn>} />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[13px]" style={{ color: T.ink }}><span style={{ color: T.info }}>{t("page.graphSnapshots.base")}</span><div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white cursor-pointer" style={{ border: `1px solid ${T.border}` }}>{base}</div></div>
        <ArrowRight size={16} style={{ color: T.info }} />
        <div className="flex items-center gap-2 text-[13px]" style={{ color: T.ink }}><span style={{ color: T.info }}>{t("page.graphSnapshots.compare")}</span><div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white cursor-pointer" style={{ border: `1px solid ${T.border}` }}>{compare}</div></div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.graphSnapshots.newNodes")} value={loading ? "-" : String(s?.added_skills ?? "-")} trend={{ label: t("page.graphSnapshots.newNodesTrend"), up: true }} />
        <MetricCard title={t("page.graphSnapshots.removedNodes")} value={loading ? "-" : String(s?.removed_skills ?? "-")} trend={{ label: t("page.graphSnapshots.removedNodesTrend"), up: false }} />
        <MetricCard title={t("page.graphSnapshots.newEdges")} value={loading ? "-" : String(s?.added_relations ?? "-")} trend={{ label: t("page.graphSnapshots.newEdgesTrend"), up: true }} />
        <MetricCard title={t("page.graphSnapshots.weakenedEdges")} value={loading ? "-" : String(s?.weakened_relations ?? "-")} trend={{ label: t("page.graphSnapshots.weakenedEdgesTrend"), up: false }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`${t("page.graphSnapshots.baseGraph")} · ${base}`}>
          <div className="px-2 pb-3" style={{ height: 300 }}><MiniGraph removedIds={[]} /></div>
          <div className="px-4 pb-3 text-[12px] flex items-center gap-4" style={{ color: T.info }}>
            <span>{t("page.graphSnapshots.nodes")}<span className="font-mono font-medium" style={{ color: T.ink }}>{data?.base_graph.nodes.length ?? "-"}</span></span>
            <span>{t("page.graphSnapshots.edges")}<span className="font-mono font-medium" style={{ color: T.ink }}>{data?.base_graph.edges.length ?? "-"}</span></span>
          </div>
        </Card>
        <Card title={`${t("page.graphSnapshots.compareGraph")} · ${compare}`}>
          <div className="px-2 pb-3" style={{ height: 300 }}><MiniGraph newIds={[]} /></div>
          <div className="px-4 pb-3 text-[12px] flex items-center gap-4" style={{ color: T.info }}>
            <span>{t("page.graphSnapshots.nodes")}<span className="font-mono font-medium" style={{ color: T.ink }}>{data?.compare_graph.nodes.length ?? "-"}</span></span>
            <span>{t("page.graphSnapshots.edges")}<span className="font-mono font-medium" style={{ color: T.ink }}>{data?.compare_graph.edges.length ?? "-"}</span></span>
          </div>
        </Card>
      </div>

      <Card title={t("page.graphSnapshots.changeDetails")}>
        {changes.length === 0 && !loading ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无变化数据</div>
        ) : (
          <table className="w-full text-[13px]"><thead><tr style={{ background: P.sky }}>{["colType","colName","colDetail","colConfidence"].map(k => (<th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{t(`page.graphSnapshots.${k}`)}</th>))}</tr></thead>
            <tbody>
              {changes.map((row, i) => {
                // 确定变化类型
                let op = "add";
                if (row.change_type === "removed") op = "remove";
                else if (row.change_type === "declining") op = "fall";
                else if (row.change_type === "rising") op = "rise";
                const col = opColors[op as keyof typeof opColors] || T.info;
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px] px-2 py-0.5 rounded font-medium" style={{ color: col, background: `${col}18` }}>
                        <span className="font-mono">{opIcons[op as keyof typeof opIcons]}</span>{opLabels[op] || row.change_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.skill_name}</td>
                    <td className="px-4 py-3" style={{ color: T.info }}>
                      覆盖度 {row.base_coverage.toFixed(1)}% → {row.compare_coverage.toFixed(1)}% ({row.change_pp > 0 ? "+" : ""}{row.change_pp.toFixed(1)}pp)
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px]" style={{ color: Math.abs(row.change_pp) > 5 ? T.emerging : T.pending }}>
                        {Math.abs(row.change_pp) > 5 ? "显著" : "轻微"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
        )}
      </Card>
    </div>
  );
}
export default GraphSnapshotsPage;
