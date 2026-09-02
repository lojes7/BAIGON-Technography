import { Network, TrendingUp, TrendingDown, Minus, Sparkles, FileText, Building2, Briefcase, Users, BarChart3, ArrowRightLeft, Link2, Award, X } from "lucide-react";
import T from "../constants/tokens";
import {
  ENTITY_COLOR,
  ENTITY_ICON_CODE,
  TREND_COLOR,
  TREND_LABEL,
  RELATION_COLOR,
} from "../constants/graph-theme";
import type { NodeDetailData, DynamicGraphEdge, EntityType } from "../types/dynamic-graph";
import { ENTITY_TYPE_LABEL, RELATION_TYPE_LABEL } from "../types/dynamic-graph";
import { Divider } from "./ui";
import { Btn } from "./ui";

interface Props {
  detail: NodeDetailData | null;
  loading?: boolean;
  onClose: () => void;
  onNeighborClick: (id: string, ev: React.MouseEvent) => void;
  onEvidenceExpand?: () => void;
}

const entityIcons: Record<EntityType, React.ComponentType<any>> = {
  Domain: Network,
  Occupation: Briefcase,
  JobRole: Users,
  Skill: Sparkles,
  Task: FileText,
  Tool: Building2,
  Certificate: Award,
};

function NodeDetailPanel({ detail, loading, onClose, onNeighborClick, onEvidenceExpand }: Props) {
  if (!detail) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-5 text-center"
        style={{ minHeight: 380 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: T.cloud + "88" }}>
          <Network size={26} style={{ color: T.teal, opacity: 0.7 }} />
        </div>
        <div>
          <div className="text-[14px] font-medium" style={{ color: T.ink }}>选择一个图谱节点</div>
          <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: T.info }}>
            点击任意节点可在此查看详细信息、<br />关联邻居节点与证据原文摘要
          </div>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ minHeight: 380 }}>
        <div className="text-[13px]" style={{ color: T.info }}>正在加载节点详情…</div>
      </div>
    );
  }
  const { node, neighbors, evidence, statistics } = detail;
  const color = ENTITY_COLOR[node.type];
  const Icon = entityIcons[node.type];

  const trendIcon =
    node.trend === "rising" ? <TrendingUp size={13} style={{ color: TREND_COLOR.rising }} /> :
    node.trend === "declining" ? <TrendingDown size={13} style={{ color: TREND_COLOR.declining }} /> :
    node.trend === "emerging" ? <Sparkles size={13} style={{ color: TREND_COLOR.emerging }} /> :
    <Minus size={13} style={{ color: TREND_COLOR.stable }} />;

  const inNbs = neighbors.filter((n) => n.direction === "in");
  const outNbs = neighbors.filter((n) => n.direction === "out");

  const NeighborChip = ({ nb, edge, dir }: { nb: NodeDetailData["neighbors"][number]["node"]; edge: DynamicGraphEdge; dir: "in" | "out" }) => {
    const c = ENTITY_COLOR[nb.type];
    return (
      <button
        type="button"
        onClick={(e) => onNeighborClick(nb.id, e)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-left transition border hover:-translate-y-0.5"
        style={{
          background: c.fill + "77",
          borderColor: c.stroke + "55",
          color: c.text,
        }}
      >
        <span className="text-[10.5px]" style={{ color: c.stroke, opacity: 0.8 }}>
          {dir === "in" ? "← 来自" : "→ 指向"}
        </span>
        <span className="text-[12px] font-bold">{ENTITY_ICON_CODE[nb.type]}</span>
        <span className="text-[12.5px] font-medium flex-1 truncate">{nb.name}</span>
        <span className="text-[10.5px] px-1 rounded flex-shrink-0"
          style={{ background: RELATION_COLOR[edge.relationType].labelBg, color: RELATION_COLOR[edge.relationType].stroke }}>
          {RELATION_TYPE_LABEL[edge.relationType]}
        </span>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-2 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color.fill, border: `1.5px solid ${color.stroke}` }}>
          {Icon ? <Icon size={20} style={{ color: color.stroke }} /> :
            <span className="text-[18px] font-bold" style={{ color: color.stroke }}>{ENTITY_ICON_CODE[node.type]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: color.fill, color: color.stroke, border: `1px solid ${color.stroke}55` }}>
              {ENTITY_TYPE_LABEL[node.type]}
            </span>
            {node.emerging && (
              <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "#7C3AED" + "22", color: "#7C3AED", border: `1px solid #7C3AED55` }}>
                ✦ 新兴
              </span>
            )}
            {node.trend && (
              <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5"
                style={{ background: TREND_COLOR[node.trend] + "18", color: TREND_COLOR[node.trend], border: `1px solid ${TREND_COLOR[node.trend]}55` }}>
                {trendIcon}
                <span>{TREND_LABEL[node.trend]}</span>
              </span>
            )}
          </div>
          <div className="text-[16px] font-semibold mt-1.5 leading-snug" style={{ color: T.ink }}>{node.name}</div>
          {node.category && (
            <div className="text-[11.5px] mt-0.5" style={{ color: T.info }}>
              {node.category}{node.industry ? ` · ${node.industry}` : ""}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/5 transition flex-shrink-0"
          style={{ color: T.info }}
          title="关闭详情"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-4 text-[12.5px] leading-relaxed py-2"
        style={{ color: T.info, background: T.bg + "66" }}>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: T.teal }}>
          <FileText size={12} />
          <span>原文摘要</span>
        </div>
        {node.summary || node.description || "暂无该节点的摘要描述信息。"}
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-x-3 gap-y-2"
        style={{ borderBottom: `1px solid ${T.border}` }}>
        {[
          { label: "需求热度", value: `${(node.demandLevel * 100).toFixed(0)}%`, color: T.teal },
          { label: "覆盖率", value: node.coverage != null ? `${(node.coverage * 100).toFixed(1)}%` : "-", color: T.emerging },
          { label: "关联岗位", value: node.relatedJobCount != null ? String(node.relatedJobCount) : "-", color: "#2563EB" },
          { label: "涉及企业", value: node.companyCount != null ? String(node.companyCount) : "-", color: "#7C3AED" },
          { label: "样本数量", value: node.sampleCount != null ? String(node.sampleCount) : "-", color: T.pending },
          { label: "节点中心性", value: statistics.centrality != null ? statistics.centrality.toFixed(3) : "-", color: T.stable },
        ].map((m, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[11.5px]" style={{ color: T.info }}>{m.label}</span>
            <span className="text-[12.5px] font-mono font-semibold" style={{ color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: T.teal }}>
              <BarChart3 size={12} />
              <span>关联邻居 · 共 {statistics.totalDegree} 个</span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px]" style={{ color: T.info }}>
              <span>入 {statistics.inDegree}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>出 {statistics.outDegree}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {outNbs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10.5px] font-medium px-0.5" style={{ color: T.info, opacity: 0.75 }}>
                  <ArrowRightLeft size={10} />
                  <span>出边（该节点指向）</span>
                </div>
                {outNbs.slice(0, 12).map(({ node: nb, edge }) => (
                  <NeighborChip key={`o-${nb.id}`} nb={nb} edge={edge} dir="out" />
                ))}
                {outNbs.length > 12 && (
                  <div className="text-[11px] text-center py-1" style={{ color: T.info }}>
                    还有 {outNbs.length - 12} 个关联节点…
                  </div>
                )}
              </div>
            )}
            {outNbs.length > 0 && inNbs.length > 0 && <Divider className="my-2" />}
            {inNbs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10.5px] font-medium px-0.5" style={{ color: T.info, opacity: 0.75 }}>
                  <Link2 size={10} />
                  <span>入边（指向该节点）</span>
                </div>
                {inNbs.slice(0, 12).map(({ node: nb, edge }) => (
                  <NeighborChip key={`i-${nb.id}`} nb={nb} edge={edge} dir="in" />
                ))}
                {inNbs.length > 12 && (
                  <div className="text-[11px] text-center py-1" style={{ color: T.info }}>
                    还有 {inNbs.length - 12} 个关联节点…
                  </div>
                )}
              </div>
            )}
            {statistics.totalDegree === 0 && (
              <div className="text-[12px] text-center py-3 rounded-lg"
                style={{ background: T.bg + "88", color: T.info }}>
                该节点暂无关联邻居
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: T.teal }}>
              <FileText size={12} />
              <span>证据摘要 · 共 {evidence.length} 条</span>
            </div>
            {onEvidenceExpand && evidence.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={onEvidenceExpand}>
                查看全部
              </Btn>
            )}
          </div>
          <div className="space-y-2">
            {evidence.slice(0, 4).map((e) => (
              <div key={e.id}
                className="rounded-lg p-2.5 border text-[11.5px] leading-relaxed"
                style={{ borderColor: T.border, background: T.white }}>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="font-semibold" style={{ color: T.ink }}>{e.companyName}</span>
                  <span style={{ color: T.info, opacity: 0.5 }}>·</span>
                  <span style={{ color: T.info }}>{e.jobName}</span>
                  {e.proficiency && (
                    <span className="ml-auto text-[10.5px] px-1.5 py-0.5 rounded"
                      style={{ background: `${T.teal}12`, color: T.teal }}>
                      {e.proficiency}
                    </span>
                  )}
                </div>
                <div style={{ color: T.ink, maxHeight: 58, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.snippet}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10.5px]" style={{ color: T.info, opacity: 0.75 }}>
                  <span>{e.sourcePlatform}</span>
                  <span>·</span>
                  <span>{e.publishDate}</span>
                </div>
              </div>
            ))}
            {evidence.length === 0 && (
              <div className="text-[12px] text-center py-3 rounded-lg"
                style={{ background: T.bg + "88", color: T.info }}>
                暂无证据记录
              </div>
            )}
            {evidence.length > 4 && (
              <div className="text-[11px] text-center py-1" style={{ color: T.info }}>
                还有 {evidence.length - 4} 条证据，点击"查看全部"展开
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default NodeDetailPanel;
