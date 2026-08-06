import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ChevronDown, Network, FileSearch, Activity, Pencil, ArrowRight, CheckCircle, X } from "lucide-react";
import T from "../constants/tokens";
import { useNav } from "../context/NavContext";
import { useAuth } from "../auth/AuthContext";
import { getAbilityGraph, getGraphNodeDetail } from "../services/analytics";
import type { AbilityGraphData, GraphNodeDetail } from "../types/api";
import type { GraphNode as GraphNodeType } from "../types";
import { PageHeader, Btn, Card, Divider, StatusBadge, ConfidenceBadge } from "../components/ui";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";
import GraphNode from "../components/overlay/GraphNode";

const DEFAULT_PERIOD = "2026H1";

// 节点类型到UI类型的映射
const TYPE_MAP: Record<string, GraphNodeType["type"]> = {
  major: "industry",
  job_family: "family",
  job: "job",
  skill: "skill",
  tool: "tool",
};

const TYPE_LABEL: Record<string, string> = {
  major: "产业", job_family: "岗位族", job: "岗位", skill: "能力", tool: "工具",
};

// 根据节点类型计算布局位置
function computeLayout(nodes: AbilityGraphData["nodes"]) {
  const byType: Record<string, typeof nodes> = {};
  for (const n of nodes) {
    (byType[n.type] ??= []).push(n);
  }
  const order = ["major", "job_family", "job", "skill", "tool"];
  const yOffsets: Record<string, number> = { major: 45, job_family: 140, job: 250, skill: 375, tool: 460 };

  const result: GraphNodeType[] = [];
  for (const t of order) {
    const group = byType[t] || [];
    const totalWidth = 700;
    const spacing = group.length > 1 ? totalWidth / (group.length + 1) : 0;
    const y = yOffsets[t];
    group.forEach((n, i) => {
      const x = group.length === 1 ? 380 : spacing * (i + 1);
      result.push({
        id: n.id,
        label: n.name.length > 8 ? n.name.slice(0, 8) + "…" : n.name,
        type: TYPE_MAP[t] || "skill",
        x: Math.round(x),
        y,
      });
    });
  }
  return result;
}

function GraphBrowserPage() {
  const { t } = useTranslation();
  const nav = useNav();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";
  const isAnalyst = user?.role === "analyst";

  const [graphData, setGraphData] = useState<AbilityGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNodeType | null>(null);
  const [nodeDetail, setNodeDetail] = useState<GraphNodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  // 图谱筛选参数
  const [cityId, setCityId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  useEffect(() => {
    let cancelled = false;
    async function fetchGraph() {
      setLoading(true);
      try {
        const res = await getAbilityGraph({ city_id: cityId || undefined, major_id: majorId || undefined, period });
        if (!cancelled) setGraphData(res.data);
      } catch {
        if (!cancelled) setGraphData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGraph();
    return () => { cancelled = true; };
  }, [cityId, majorId, period]);

  // 点击节点获取详情
  const handleNodeClick = async (node: GraphNodeType) => {
    setSelectedNode(node);
    setNodeDetail(null);
    setDetailLoading(true);
    try {
      const apiNode = graphData?.nodes.find((n) => n.id === node.id);
      if (apiNode) {
        const res = await getGraphNodeDetail({
          node_type: apiNode.type,
          node_id: apiNode.entity_id,
          city_id: cityId || undefined,
          major_id: majorId || undefined,
          period,
        });
        setNodeDetail(res.data);
      }
    } catch {
      // 详情获取失败，使用图谱中的基础信息
    } finally {
      setDetailLoading(false);
    }
  };

  const graphNodes: GraphNodeType[] = graphData ? computeLayout(graphData.nodes) : [];
  const graphEdges = graphData?.edges || [];

  // 构建节点ID查找表
  const nodePosMap = new Map(graphNodes.map((n) => [n.id, n]));

  return (
    <div className="flex flex-col gap-5 h-full">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.graphBrowser")]}
        title={t("page.graphBrowser.title")}
        actions={
          isTeacher ? (
            <Btn size="sm" icon={ArrowRight} onClick={() => nav("gap-analysis")}>查看该岗位供需缺口 →</Btn>
          ) : isAnalyst ? (
            <Btn variant="secondary" size="sm" icon={Download}>导出图谱</Btn>
          ) : isStudent ? (
            <Btn size="sm" icon={ArrowRight} onClick={() => nav("skill-compare")}>以该岗位为目标 →</Btn>
          ) : (
            <>
              <Btn variant="secondary" size="sm" onClick={() => toast.success("视图已保存", { description: "可在图谱快照中查看" })}>保存视图</Btn>
              <Btn variant="secondary" size="sm" onClick={() => nav("graph-snapshots")}>快照比较</Btn>
              <Btn variant="secondary" size="sm" icon={Download} onClick={() => toast("正在生成导出文件…")}>导出</Btn>
            </>
          )
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Filter panel */}
        <div className="w-44 flex-shrink-0">
          <Card>
            <div className="px-4 py-3 space-y-4">
              {[
                { label: "区域", value: cityId ? `城市 #${cityId}` : "全部城市" },
                { label: "产业", value: majorId ? `专业 #${majorId}` : "全部专业" },
                { label: "时间窗口", value: period },
              ].map((f, i) => (
                <div key={i}>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: T.info }}>
                    {f.label}
                  </div>
                  <div className="flex items-center justify-between text-[13px]" style={{ color: T.ink }}>
                    <span>{f.value}</span>
                    <ChevronDown size={12} style={{ color: T.info }} />
                  </div>
                </div>
              ))}
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                  节点类型
                </div>
                {[
                  { label: "产业", color: T.ink },
                  { label: "岗位族", color: T.teal },
                  { label: "岗位", color: T.stable },
                  { label: "能力", color: T.emerging },
                  { label: "工具", color: T.declining },
                ].map((tp, i) => (
                  <label key={i} className="flex items-center gap-2 py-1 cursor-pointer">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tp.color }} />
                    <span className="text-[13px]" style={{ color: T.ink }}>{tp.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Graph canvas */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1" noPad>
            {loading ? (
              <div className="flex items-center justify-center h-full text-[13px]" style={{ color: T.info }}>
                正在加载图谱数据...
              </div>
            ) : graphNodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px]" style={{ color: T.info }}>
                暂无图谱数据，请确认后端统计分析服务已接入
              </div>
            ) : (
              <svg width="100%" height="100%" viewBox="0 0 760 510" style={{ minHeight: 440 }}>
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke={T.cloud} strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Edges */}
                {graphEdges.map((e, i) => {
                  const from = nodePosMap.get(e.source_id);
                  const to = nodePosMap.get(e.target_id);
                  if (!from || !to) return null;
                  return (
                    <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={e.confirmed ? T.teal : "#aab5bd"}
                      strokeWidth={e.confirmed ? 1.5 : 1}
                      strokeDasharray={e.confirmed ? "none" : "5,3"}
                      opacity={0.65}
                    />
                  );
                })}

                {/* Nodes */}
                {graphNodes.map(node => (
                  <GraphNode key={node.id} node={node}
                    selected={selectedNode?.id === node.id}
                    onClick={() => handleNodeClick(node)} />
                ))}
              </svg>
            )}
          </Card>

          {/* Legend */}
          <div className="mt-2 flex items-center gap-5 text-[11px]" style={{ color: T.info }}>
            {[
              { style: "solid", label: "已人工确认" },
              { style: "dashed", label: "AI候选" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <svg width="20" height="8">
                  <line x1="0" y1="4" x2="20" y2="4" stroke={T.teal} strokeWidth="1.5"
                    strokeDasharray={l.style === "dashed" ? "4,2" : "none"} />
                </svg>
                {l.label}
              </div>
            ))}
            {[
              { color: T.ink, label: "产业" },
              { color: T.teal, label: "岗位族" },
              { color: T.stable, label: "岗位" },
              { color: T.emerging, label: "能力" },
              { color: T.declining, label: "工具" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-52 flex-shrink-0">
          <Card className="h-full">
            {selectedNode ? (
              <div className="px-4 py-4 flex flex-col gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: T.info }}>
                    节点详情
                  </div>
                  <div className="text-[15px] font-medium" style={{ color: T.ink }}>{selectedNode.label}</div>
                  <div className="text-[12px] mt-1" style={{ color: T.info }}>
                    {TYPE_LABEL[Object.entries(TYPE_MAP).find(([, v]) => v === selectedNode.type)?.[0] ?? ""] || selectedNode.type}
                  </div>
                </div>
                <Divider />
                {detailLoading ? (
                  <div className="text-[12px] text-center py-4" style={{ color: T.info }}>加载详情中...</div>
                ) : nodeDetail ? (
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between">
                      <span style={{ color: T.info }}>覆盖度</span>
                      <span className="font-mono font-medium" style={{ color: T.ink }}>{(nodeDetail.coverage * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: T.info }}>关联岗位</span>
                      <span className="font-mono font-medium" style={{ color: T.ink }}>{nodeDetail.related_job_count}</span>
                    </div>
                    {nodeDetail.company_count > 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: T.info }}>涉及企业</span>
                        <span className="font-mono font-medium" style={{ color: T.ink }}>{nodeDetail.company_count}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span style={{ color: T.info }}>样本数</span>
                      <span className="font-mono font-medium" style={{ color: T.ink }}>{nodeDetail.sample_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: T.info }}>状态</span>
                      <StatusBadge status={nodeDetail.review_status === "REVIEW_PASSED" ? "confirmed" : "candidate"} />
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-center py-4" style={{ color: T.info }}>暂无详情数据</div>
                )}
                <div className="flex flex-col gap-2 mt-2">
                  <Btn variant="secondary" size="sm" icon={FileSearch} onClick={() => setEvidenceOpen(true)}>查看证据</Btn>
                  {(isAdmin || isAnalyst) ? (
                    <>
                      <Btn size="sm" icon={CheckCircle} onClick={() => toast.success("审核通过")}>审核通过</Btn>
                      <Btn variant="ghost" size="sm" icon={X} onClick={() => toast("已驳回")}>驳回</Btn>
                      <Btn variant="ghost" size="sm" icon={Pencil} onClick={() => toast("编辑关系")}>编辑关系</Btn>
                    </>
                  ) : (
                    <Btn variant="secondary" size="sm" icon={Activity} onClick={() => nav("evolution-trends")}>查看趋势</Btn>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
                <Network size={28} style={{ color: T.cloud }} />
                <div className="text-[12px] text-center" style={{ color: T.info }}>
                  点击节点查看详情与证据
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      {evidenceOpen && (
        <EvidenceDrawer
          title={selectedNode?.label ?? "关系证据"}
          subtitle={selectedNode ? `${selectedNode.type} · 点击展开证据原文` : ""}
          items={nodeDetail?.evidence?.length ? nodeDetail.evidence.map((e) => ({                               
            text: `${e.company_name} · ${e.job_name} · ${e.proficiency || ""}`,
            source: e.source_platform,
            date: e.publish_date?.slice(0, 10),
            job: e.job_name,
            status: nodeDetail.review_status === "REVIEW_PASSED" ? "confirmed" : "candidate",
          })) : undefined}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </div>
  );
}

export default GraphBrowserPage;
