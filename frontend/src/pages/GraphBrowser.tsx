import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, ArrowRight, Network, FileSearch, Activity, Route,
  ChevronDown, Sparkles, BarChart3, Save, Image as ImageIcon, FileJson, Table as TableIcon,
  Layers, Gauge, Orbit,
} from "lucide-react";
import T from "../constants/tokens";
import { ENTITY_TYPE_LABEL, RELATION_TYPE_LABEL, type EntityType } from "../types/dynamic-graph";
import {
  MOCK_GRAPH_DATA,
  buildNodeDetail,
  searchGraph,
  findShortestPath,
} from "../data/dynamic-graph-mock";
import AbilityGraph, { type AbilityGraphHandle, type HighlightState } from "../components/AbilityGraph";
import GraphSearchBar, { type SearchResultItem } from "../components/GraphSearchBar";
import NodeDetailPanel from "../components/NodeDetailPanel";
import PathQueryModal from "../components/overlay/PathQueryModal";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";
import type { NodeDetailData } from "../types/dynamic-graph";
import {
  exportGraphJson,
  exportGraphSvg,
  exportGraphPng,
  exportGraphCsv,
} from "../utils/graph-export";
import { ENTITY_COLOR, RELATION_COLOR, PROFICIENCY_LEVELS, STAR_SPOKE_COLORS, SUB_ARROW_COLOR, proficiencyOf } from "../constants/graph-theme";
import { PageHeader, Btn, Card, Divider, MetricCard } from "../components/ui";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useNav } from "../context/NavContext";

const ALL_ENTITY_TYPES: EntityType[] = [
  "Domain", "Occupation", "JobRole", "Skill", "Task", "Tool", "Certificate",
];

/* ===== 技术栈分组（类目/行业 → 技术栈，Mock 数据驱动） ===== */
const STACK_AI = "AI与大模型";
const STACK_DATA = "大数据与数据工程";
const STACK_BACKEND = "后端与云原生";
const STACK_OPTIONS = [STACK_AI, STACK_DATA, STACK_BACKEND];

const CATEGORY_STACK: Record<string, string> = {
  "AI算法": STACK_AI, "LLM应用": STACK_AI, "深度学习框架": STACK_AI, "LLM框架": STACK_AI,
  "模型库": STACK_AI, "推理引擎": STACK_AI, "高性能计算": STACK_AI, "计算机视觉": STACK_AI,
  "大数据": STACK_DATA, "数据存储": STACK_DATA, "数据查询": STACK_DATA, "消息队列": STACK_DATA,
  "编程语言": STACK_BACKEND, "Web框架": STACK_BACKEND, "容器化": STACK_BACKEND,
  "容器编排": STACK_BACKEND, "工程实践": STACK_BACKEND,
};
const INDUSTRY_STACK: Record<string, string> = {
  "人工智能": STACK_AI, "智能制造": STACK_AI, "互联网": STACK_DATA, "全行业": STACK_BACKEND,
};
/* 任务/证书无类目字段，按业务归属显式映射 */
const NODE_STACK: Record<string, string> = {
  tk_001: STACK_AI, tk_002: STACK_AI, tk_003: STACK_AI, tk_004: STACK_DATA, tk_005: STACK_DATA,
  cert_001: STACK_AI, cert_002: STACK_AI, cert_003: STACK_AI, cert_004: STACK_BACKEND, cert_005: STACK_AI,
};

function GraphBrowserPage() {
  const { t } = useTranslation();
  const nav = useNav();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";
  const isAnalyst = user?.role === "analyst";

  const [graphData] = useState(MOCK_GRAPH_DATA);
  const graphHandleRef = useRef<AbilityGraphHandle>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusNeighborsOf, setFocusNeighborsOf] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<EntityType>>(new Set());
  const [searchMatches, setSearchMatches] = useState<Set<string>>(new Set());
  /* 视图切换：技术栈 / 熟练度级别 */
  const [stackFilter, setStackFilter] = useState("全部");
  const [levelFilter, setLevelFilter] = useState("");
  /* 中心领域：当前作为中心恒星的领域节点 */
  const [centerDomainId, setCenterDomainId] = useState("core_000");

  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [pathHighlight, setPathHighlight] = useState<{
    nodeIds: Set<string>; edgeIds: Set<string>;
  } | null>(null);

  const [detail, setDetail] = useState<NodeDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const period = "2026H1";

  const loadNodeDetail = useCallback((id: string | null) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    const t0 = performance.now();
    const minDelay = 120;
    const d = buildNodeDetail(id);
    const elapsed = performance.now() - t0;
    const rest = Math.max(0, minDelay - elapsed);
    setTimeout(() => {
      setDetail(d);
      setDetailLoading(false);
    }, rest);
  }, []);

  useEffect(() => {
    loadNodeDetail(selectedId);
  }, [selectedId, loadNodeDetail]);

  /* 按中心领域拆分图谱：不同领域是不同的图谱。
     从中心领域出发 BFS 收集子图；其余领域节点不进入本图谱，也不经其扩展。 */
  const scopedData = useMemo(() => {
    const typeById = new Map(graphData.nodes.map((n) => [n.id, n.type] as const));
    const adj = new Map<string, string[]>();
    for (const e of graphData.edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
    const keep = new Set<string>([centerDomainId]);
    const queue: string[] = [centerDomainId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const other of adj.get(cur) ?? []) {
        if (keep.has(other)) continue;
        if (typeById.get(other) === "Domain") continue; // 其它领域不属于本图谱
        keep.add(other);
        queue.push(other);
      }
    }
    return {
      nodes: graphData.nodes.filter((n) => keep.has(n.id)),
      edges: graphData.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
      ids: keep,
    };
  }, [graphData, centerDomainId]);

  const onSearchSelect = useCallback((id: string) => {
    setPathHighlight(null);
    setSelectedId(id);
    graphHandleRef.current?.focusNode(id, true);
    setSearchMatches(new Set([id]));
    setTimeout(() => setSearchMatches(new Set()), 2800);
  }, []);

  const onNodeClick = useCallback((id: string) => {
    setPathHighlight(null);
    setSearchMatches(new Set());
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    if (focusMode) {
      setFocusNeighborsOf(next);
    } else {
      setFocusNeighborsOf(null);
    }
  }, [selectedId, focusMode]);

  const onSelectionEmpty = useCallback(() => {
    setSelectedId(null);
    setSearchMatches(new Set());
    setPathHighlight(null);
    if (focusMode) setFocusNeighborsOf(null);
  }, [focusMode]);

  const resetView = useCallback(() => {
    setTypeFilter(new Set());
    setFocusMode(false);
    setFocusNeighborsOf(null);
    setSelectedId(null);
    setHoveredId(null);
    setSearchMatches(new Set());
    setPathHighlight(null);
    setStackFilter("全部");
    setLevelFilter("");
    setCenterDomainId("core_000");
  }, []);

  const toggleFocusMode = useCallback(() => {
    const next = !focusMode;
    setFocusMode(next);
    if (!next) {
      setFocusNeighborsOf(null);
    } else if (selectedId) {
      setFocusNeighborsOf(selectedId);
    }
  }, [focusMode, selectedId]);

  const handleExport = useCallback(async (format: "json" | "svg" | "png" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `ability-graph-${stamp}`;
    try {
      if (format === "json") {
        exportGraphJson(scopedData, `${base}.json`);
      } else if (format === "svg") {
        const ok = exportGraphSvg(graphHandleRef.current, `${base}.svg`);
        if (!ok) { toast.error("SVG 导出失败：SVG 元素未就绪"); return; }
      } else if (format === "png") {
        toast.loading("正在生成 PNG 图像…", { id: "png-export" });
        const ok = await exportGraphPng(graphHandleRef.current, `${base}.png`, 2);
        if (!ok) {
          toast.error("PNG 导出失败", { id: "png-export" });
          return;
        }
        toast.success("PNG 已导出", { id: "png-export" });
        return;
      } else if (format === "csv") {
        exportGraphCsv(scopedData, base);
      }
      toast.success(`${format.toUpperCase()} 已开始下载`);
    } catch (e) {
      toast.error(`导出失败：${(e as Error).message ?? "未知错误"}`);
    }
  }, [scopedData]);

  const runPathQuery = useCallback((sourceId: string, targetId: string) => {
    const r = findShortestPath(sourceId, targetId);
    if (!r.found) {
      return { found: false, hops: -1, path: [], edgeLabels: [], totalImportance: 0 };
    }
    const nodes = r.path.map((p) => {
      const n = graphData.nodes.find((x) => x.id === p.nodeId)!;
      return { id: n.id, name: n.name, type: n.type };
    });
    const edgeIds = r.path.slice(1).map((p) => p.edgeId!).filter(Boolean);
    const labels = edgeIds.map((eid) => {
      const e = graphData.edges.find((x) => x.id === eid);
      return e ? RELATION_TYPE_LABEL[e.relationType] : "";
    });
    const nodeIdSet = new Set(r.path.map((p) => p.nodeId));
    const edgeIdSet = new Set(edgeIds);
    setPathHighlight({ nodeIds: nodeIdSet, edgeIds: edgeIdSet });
    setSelectedId(null);
    setFocusNeighborsOf(null);
    return {
      found: true,
      hops: r.hops,
      path: nodes,
      edgeLabels: labels,
      totalImportance: r.totalImportance,
    };
  }, [graphData]);

  const getNodeById = useCallback((id: string) => {
    const n = graphData.nodes.find((x) => x.id === id);
    return n ? { id: n.id, name: n.name, type: n.type } : undefined;
  }, [graphData]);

  /* 节点 → 技术栈映射 */
  const stackByNode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of graphData.nodes) {
      m[n.id] = NODE_STACK[n.id]
        ?? ((n.type === "Skill" || n.type === "Tool") ? (CATEGORY_STACK[n.category ?? ""] ?? "")
          : n.type === "JobRole" ? (INDUSTRY_STACK[n.industry ?? ""] ?? "")
          : "");
    }
    return m;
  }, [graphData]);

  /* 节点 → 熟练度要求（入边 REQUIRES.requiredLevel 取最高，回退节点自带字段） */
  const levelByNode = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of graphData.edges) {
      if (e.relationType !== "REQUIRES") continue;
      const lv = proficiencyOf(e.requiredLevel);
      if (lv > (m[e.target] ?? 0)) m[e.target] = lv;
    }
    for (const n of graphData.nodes) {
      if (!m[n.id]) m[n.id] = Math.max(proficiencyOf(n.proficiency), proficiencyOf(n.requiredLevel));
    }
    return m;
  }, [graphData]);

  /* 领域节点列表（中心领域选择器的数据源） */
  const domainNodes = useMemo(() => graphData.nodes.filter((n) => n.type === "Domain"), [graphData]);
  const centerDomainName = domainNodes.find((d) => d.id === centerDomainId)?.name ?? "软件工程";

  /* 搜索范围限定在当前领域图谱内（不同领域是不同的图谱） */
  const onSearch = useCallback((keyword: string): SearchResultItem[] => {
    return searchGraph(keyword).filter((r) => scopedData.ids.has(r.id));
  }, [scopedData]);

  const onNeighborClick = useCallback((id: string) => {
    if (!scopedData.ids.has(id)) {
      toast.info("该节点属于其他领域图谱，请先切换中心领域");
      return;
    }
    setPathHighlight(null);
    setSelectedId(id);
    graphHandleRef.current?.focusNode(id, true);
  }, [scopedData]);

  const highlightState: HighlightState = useMemo(() => ({
    selectedId,
    hoveredId,
    focusNeighborsOf,
    pathNodeIds: pathHighlight?.nodeIds ?? new Set(),
    pathEdgeIds: pathHighlight?.edgeIds ?? new Set(),
    typeFilter,
    searchMatches,
    stackFilter,
    levelFilter,
    stackByNode,
    levelByNode,
    centerDomainId,
  }), [selectedId, hoveredId, focusNeighborsOf, pathHighlight, typeFilter, searchMatches, stackFilter, levelFilter, stackByNode, levelByNode, centerDomainId]);

  const stats = useMemo(() => {
    const byType = new Map<EntityType, number>();
    for (const n of scopedData.nodes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    const byRel = new Map<string, number>();
    for (const e of scopedData.edges) byRel.set(e.relationType, (byRel.get(e.relationType) ?? 0) + 1);
    const avgDemand = scopedData.nodes.reduce((s, n) => s + n.demandLevel, 0) / scopedData.nodes.length;
    const emerging = scopedData.nodes.filter((n) => n.emerging).length;
    return { byType, byRel, avgDemand, emerging };
  }, [scopedData]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.graphBrowser")]}
        title="新一代信息技术岗位全景图谱"
        description={`「${centerDomainName}」领域独立图谱 · 各领域分图浏览 · 颗粒度至技能点 · 节点大小=需求热度与熟练度要求 · Mock 演示数据`}
        actions={
          <>
            <div className="relative" key="export-menu">
              <Btn variant="secondary" size="sm" icon={Download}
                onClick={(e) => {
                  const menu = (e?.currentTarget as HTMLElement | null)?.nextElementSibling as HTMLElement | null;
                  menu?.classList.toggle("hidden");
                }}>
                导出图谱
                <ChevronDown size={12} className="-mr-1 ml-0.5" />
              </Btn>
              <div id="export-menu" className="hidden absolute right-0 top-full mt-1.5 rounded-lg shadow-xl z-30 overflow-hidden min-w-[180px]"
                style={{ background: T.white, border: `1px solid ${T.border}` }}>
                {[
                  { k: "json", i: FileJson, label: "导出 JSON 数据", desc: "结构化图谱数据" },
                  { k: "svg", i: Network, label: "导出 SVG 矢量图", desc: "可编辑矢量格式" },
                  { k: "png", i: ImageIcon, label: "导出 PNG 图像", desc: "2x 高清位图" },
                  { k: "csv", i: TableIcon, label: "导出 CSV 表格", desc: "节点/边拆分双表" },
                ].map((it) => {
                  const I = it.i;
                  return (
                    <button
                      key={it.k}
                      type="button"
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-black/[0.04]"
                      onClick={() => {
                        (document.getElementById("export-menu") as HTMLElement)?.classList.add("hidden");
                        void handleExport(it.k as "json" | "svg" | "png" | "csv");
                      }}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: T.cloud + "66", color: T.teal }}>
                        <I size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium" style={{ color: T.ink }}>{it.label}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: T.info, opacity: 0.8 }}>{it.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <Btn variant="secondary" size="sm" icon={Route} onClick={() => setPathModalOpen(true)}>
              多跳路径查询
            </Btn>
            {(isAdmin || isAnalyst) && (
              <Btn variant="secondary" size="sm" icon={Save}
                onClick={() => toast.success("视图已保存", { description: "可在图谱快照中查看" })}>
                保存视图
              </Btn>
            )}
            {isTeacher ? (
              <Btn size="sm" icon={ArrowRight} onClick={() => nav("gap-analysis")}>查看供需缺口 →</Btn>
            ) : isStudent ? (
              <Btn size="sm" icon={ArrowRight} onClick={() => nav("skill-compare")}>设定为目标岗位 →</Btn>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="实体总数"
          value={scopedData.nodes.length}
          sub={`「${centerDomainName}」领域图谱 · ${domainNodes.length} 个领域可切换`}
          trend={{ label: "颗粒度至技能点", up: true }}
        />
        <MetricCard
          title="关系总数"
          value={scopedData.edges.length}
          sub={`${stats.byRel.size} 种关系类型`}
          trend={{ label: "父子关系弱化显示" }}
        />
        <MetricCard
          title="平均需求热度"
          value={`${(stats.avgDemand * 100).toFixed(0)}%`}
          sub={`新兴节点 ${stats.emerging} 个`}
          trend={{ label: `新兴占比 ${((stats.emerging / scopedData.nodes.length) * 100).toFixed(0)}%`, up: true }}
        />
        <MetricCard
          title="时间窗口"
          value={period}
          sub="Mock 演示数据"
          trend={{ label: "未接入真实后端" }}
        />
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <Card className="px-4 py-3">
            <GraphSearchBar
              onSearch={onSearch}
              onSelect={onSearchSelect}
              activeFilter={typeFilter}
              onFilterChange={setTypeFilter}
              focusMode={focusMode}
              onToggleFocusMode={toggleFocusMode}
              onResetView={resetView}
              allEntityTypes={ALL_ENTITY_TYPES}
            />

            {/* 视图切换：中心领域 / 技术栈 / 熟练度级别 */}
            <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-semibold inline-flex items-center gap-1 mr-0.5" style={{ color: T.teal }}>
                  <Orbit size={12} />中心领域
                </span>
                <select
                  value={centerDomainId}
                  onChange={(e) => {
                    setCenterDomainId(e.target.value);
                    /* 领域切换 = 切换到另一张图谱，清空上一张图的选中与高亮 */
                    setSelectedId(null);
                    setHoveredId(null);
                    setSearchMatches(new Set());
                    setPathHighlight(null);
                    setFocusNeighborsOf(null);
                  }}
                  className="px-2.5 py-1 rounded-full text-[11.5px] font-medium outline-none cursor-pointer transition-colors"
                  style={{ background: `${T.cloud}66`, color: T.ink, border: `1px solid ${T.border}` }}
                >
                  {domainNodes.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11.5px] font-semibold inline-flex items-center gap-1 mr-0.5" style={{ color: T.teal }}>
                  <Layers size={12} />技术栈视图
                </span>
                {["全部", ...STACK_OPTIONS].map((s) => {
                  const active = stackFilter === s;
                  return (
                    <button key={s} type="button"
                      className="px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-colors"
                      style={active
                        ? { background: T.teal, color: "#fff" }
                        : { background: `${T.cloud}66`, color: T.ink }}
                      onClick={() => setStackFilter(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11.5px] font-semibold inline-flex items-center gap-1 mr-0.5" style={{ color: T.teal }}>
                  <Gauge size={12} />熟练度级别
                </span>
                {["", ...PROFICIENCY_LEVELS].map((lv) => {
                  const active = levelFilter === lv;
                  return (
                    <button key={lv || "all"} type="button"
                      className="px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-colors"
                      style={active
                        ? { background: T.teal, color: "#fff" }
                        : { background: `${T.cloud}66`, color: T.ink }}
                      onClick={() => setLevelFilter(lv)}
                    >
                      {lv || "全部级别"}
                    </button>
                  );
                })}
              </div>
              {(stackFilter !== "全部" || levelFilter) && (
                <button type="button" className="text-[11.5px] underline-offset-2 hover:underline"
                  style={{ color: T.info }}
                  onClick={() => { setStackFilter("全部"); setLevelFilter(""); }}>
                  退出视图聚焦
                </button>
              )}
            </div>
          </Card>

          <Card className="flex-1 min-h-0 p-0" noPad>
            <AbilityGraph
              ref={graphHandleRef}
              svgRef={svgRef}
              nodes={scopedData.nodes}
              edges={scopedData.edges}
              highlight={highlightState}
              onNodeClick={onNodeClick}
              onNodeHover={setHoveredId}
              onSelectionEmpty={onSelectionEmpty}
            />
          </Card>

          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px]" style={{ color: T.info }}>
              <div className="flex items-center gap-1.5 font-semibold mr-1" style={{ color: T.teal }}>
                <Sparkles size={12} />
                <span>实体类型（颜色）：</span>
              </div>
              {ALL_ENTITY_TYPES.map((tp) => {
                const c = ENTITY_COLOR[tp];
                return (
                  <div key={tp} className="flex items-center gap-1.5">
                    {tp === "Domain" ? (
                      <span className="text-[13px] leading-none font-bold" style={{ color: c.stroke }}>✦</span>
                    ) : (
                      <span className="w-3 h-3 rounded-full inline-block"
                        style={{ background: c.fill, border: `1.6px solid ${c.stroke}` }} />
                    )}
                    <span>{ENTITY_TYPE_LABEL[tp]}</span>
                    <span className="text-[10.5px] font-mono px-1 rounded"
                      style={{ background: T.cloud + "66" }}>
                      {stats.byType.get(tp) ?? 0}
                    </span>
                  </div>
                );
              })}
              <Divider className="mx-1 hidden md:block" style={{ width: 1, height: 14 }} />
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300" />
                <span>节点大小 = 需求热度/重要性</span>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px]" style={{ color: T.info }}>
              <div className="flex items-center gap-1.5 font-semibold mr-1" style={{ color: T.teal }}>
                <Gauge size={12} />
                <span>熟练度要求（节点大小加成）：</span>
              </div>
              {PROFICIENCY_LEVELS.map((lv, i) => {
                const d = 6 + i * 2.5;
                return (
                  <div key={lv} className="flex items-center gap-1.5">
                    <span className="rounded-full inline-block"
                      style={{ width: d, height: d, background: "#C9D6E6" }} />
                    <span>{lv}</span>
                  </div>
                );
              })}
              <Divider className="mx-1 hidden lg:block" style={{ width: 1, height: 14 }} />
              <div className="flex items-center gap-1.5 font-semibold mr-1" style={{ color: T.teal }}>
                <Orbit size={12} />
                <span>关键连线：</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width={26} height={8}>
                  <line x1={0} y1={4} x2={26} y2={4} stroke={STAR_SPOKE_COLORS[0]} strokeWidth={1.8} strokeLinecap="round"
                    markerEnd="url(#lg-spoke-arr)" />
                  <defs>
                    <marker id="lg-spoke-arr" viewBox="0 0 10 10" refX={8.6} refY={5} markerWidth={5.5} markerHeight={5.5} orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={STAR_SPOKE_COLORS[0]} />
                    </marker>
                  </defs>
                </svg>
                <span>中心领域 → 关键技能（按需求热度精选）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width={26} height={8}>
                  <line x1={0} y1={4} x2={26} y2={4} stroke={SUB_ARROW_COLOR} strokeWidth={1.5} strokeLinecap="round"
                    strokeDasharray="5 4" markerEnd="url(#lg-sub-arr)" />
                  <defs>
                    <marker id="lg-sub-arr" viewBox="0 0 10 10" refX={8.6} refY={5} markerWidth={5.5} markerHeight={5.5} orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={SUB_ARROW_COLOR} />
                    </marker>
                  </defs>
                </svg>
                <span>关键技能 → 子技能</span>
              </div>
              <Divider className="mx-1 hidden lg:block" style={{ width: 1, height: 14 }} />
              <div className="flex items-center gap-1.5 font-semibold mr-1" style={{ color: T.teal }}>
                <BarChart3 size={12} />
                <span>其他关系（非技能节点间）：</span>
              </div>
              {(Object.keys(RELATION_TYPE_LABEL) as Array<keyof typeof RELATION_TYPE_LABEL>).map((rt) => {
                const cfg = RELATION_COLOR[rt];
                const dashed = cfg.dash;
                const weak = rt === "BROADER_THAN" || rt === "RELATED_TO" || rt === "SIMILAR_TO";
                return (
                  <div key={rt} className="flex items-center gap-1.5" style={weak ? { opacity: 0.65 } : undefined}>
                    <svg width={22} height={8}>
                      <line x1={0} y1={4} x2={22} y2={4} stroke={cfg.stroke} strokeWidth={weak ? 1.1 : 1.8}
                        strokeDasharray={dashed || undefined} strokeLinecap="round" />
                    </svg>
                    <span>{RELATION_TYPE_LABEL[rt]}</span>
                    <span className="text-[10.5px] font-mono px-1 rounded"
                      style={{ background: cfg.labelBg }}>
                      {stats.byRel.get(rt) ?? 0}
                    </span>
                  </div>
                );
              })}
              <Divider className="mx-1 hidden lg:block" style={{ width: 1, height: 14 }} />
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: TREND_COLOR_WORKAROUND.emerging }} />
                <span>新兴趋势</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TREND_COLOR_WORKAROUND.rising }} />
                <span>上升</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TREND_COLOR_WORKAROUND.stable }} />
                <span>稳定</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TREND_COLOR_WORKAROUND.declining }} />
                <span>下降</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="w-[320px] flex-shrink-0 min-h-0">
          <Card className="h-full min-h-0 flex flex-col overflow-hidden" noPad>
            <NodeDetailPanel
              detail={detail}
              loading={detailLoading}
              onClose={() => setSelectedId(null)}
              onNeighborClick={onNeighborClick}
              onEvidenceExpand={() => setEvidenceOpen(true)}
            />
            <div className="px-4 py-3 border-t flex items-center justify-between gap-2 flex-wrap"
              style={{ borderTopColor: T.border }}>
              {isTeacher ? (
                <Btn size="sm" icon={Activity} variant="secondary"
                  onClick={() => nav("evolution-trends")}>查看演化趋势</Btn>
              ) : isAnalyst || isAdmin ? (
                <>
                  <Btn size="sm" variant="secondary" icon={FileSearch}
                    onClick={() => setEvidenceOpen(!!detail)}>打开证据抽屉</Btn>
                </>
              ) : (
                <Btn size="sm" variant="secondary" icon={Network}
                  onClick={() => toast.info("提示：点击任意节点查看完整详情")}>
                  选择节点
                </Btn>
              )}
              {(detail && (isStudent)) && (
                <Btn size="sm" icon={ArrowRight} onClick={() => nav("skill-compare")}>
                  以该节点为目标
                </Btn>
              )}
            </div>
          </Card>
        </div>
      </div>

      {pathModalOpen && (
        <PathQueryModal
          open={pathModalOpen}
          onClose={() => setPathModalOpen(false)}
          onSearch={onSearch}
          onQuery={runPathQuery}
          getNodeById={getNodeById}
        />
      )}

      {evidenceOpen && (
        <EvidenceDrawer
          title={detail?.node.name ?? "证据原文"}
          subtitle={detail ? `${ENTITY_TYPE_LABEL[detail.node.type]} · 共 ${detail.evidence.length} 条证据摘要` : ""}
          items={detail?.evidence?.length ? detail.evidence.map((e) => ({
            text: `${e.snippet}\n\n【企业】${e.companyName}　【岗位】${e.jobName}${e.proficiency ? `　【熟练度】${e.proficiency}` : ""}\n【来源】${e.sourcePlatform}　【日期】${e.publishDate}`,
            source: e.sourcePlatform,
            date: e.publishDate,
            job: e.jobName,
            status: "confirmed",
          })) : undefined}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </div>
  );
}

const TREND_COLOR_WORKAROUND = {
  emerging: "#7C3AED",
  rising: T.emerging,
  stable: T.stable,
  declining: T.declining,
};

export default GraphBrowserPage;
