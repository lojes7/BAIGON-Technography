import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import T from "../constants/tokens";
import {
  RELATION_COLOR,
  CONFIDENCE_ALPHA,
  getNodeFill,
  TREND_COLOR,
  PROFICIENCY_LEVELS,
  KEY_SKILL_IDS,
  STAR_SPOKE_COLORS,
  SUB_ARROW_COLOR,
  DOMAIN_STAR_RADIUS,
} from "../constants/graph-theme";
import { useForceSimulation, defaultNodeRadius, type SimNode, type SimEdge } from "../hooks/useForceSimulation";
import type {
  DynamicGraphNode,
  DynamicGraphEdge,
  EntityType,
  RelationType,
} from "../types/dynamic-graph";

export interface HighlightState {
  selectedId: string | null;
  hoveredId: string | null;
  focusNeighborsOf: string | null;
  pathNodeIds: Set<string>;
  pathEdgeIds: Set<string>;
  typeFilter: Set<EntityType>;
  searchMatches: Set<string>;
  /* 视图切换：技术栈 / 熟练度级别（空值 = 全部） */
  stackFilter: string;
  levelFilter: string;
  stackByNode: Record<string, string>;
  levelByNode: Record<string, number>;
  /* 当前作为中心恒星的领域节点 */
  centerDomainId: string;
}

export interface AbilityGraphHandle {
  focusNode: (id: string, animate?: boolean) => void;
  getSvgElement: () => SVGSVGElement | null;
  exportSvgString: () => string;
}

interface Props {
  nodes: DynamicGraphNode[];
  edges: DynamicGraphEdge[];
  highlight: HighlightState;
  onNodeClick: (id: string, ev: React.MouseEvent) => void;
  onNodeDoubleClick?: (id: string, ev: React.MouseEvent) => void;
  onNodeHover?: (id: string | null, ev?: React.MouseEvent) => void;
  onEdgeHover?: (id: string | null, ev?: React.MouseEvent) => void;
  onSelectionEmpty?: () => void;
  width?: number;
  height?: number;
  svgRef?: React.MutableRefObject<SVGSVGElement | null>;
  showEdgeLabels?: boolean;
  animateInitial?: boolean;
}

const DEFAULT_W = 900;
const DEFAULT_H = 620;

const KEY_SKILL_LIST = KEY_SKILL_IDS as readonly string[];

/* 普通边：无箭头的淡彩线（端点略离开节点边缘，视觉干净） */
function edgePath(
  sx: number, sy: number, tx: number, ty: number,
  sr: number, tr: number, curvature = 0.08,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const startX = sx + ux * (sr + 2);
  const startY = sy + uy * (sr + 2);
  const endX = tx - ux * (tr + 4);
  const endY = ty - uy * (tr + 4);
  if (curvature === 0) {
    return { d: `M ${startX} ${startY} L ${endX} ${endY}`, midX: (startX + endX) / 2, midY: (startY + endY) / 2, nx: -uy, ny: ux };
  }
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const perpX = -uy;
  const perpY = ux;
  const cpx = midX + perpX * dist * curvature;
  const cpy = midY + perpY * dist * curvature;
  const labelX = midX + perpX * dist * curvature * 0.9;
  const labelY = midY + perpY * dist * curvature * 0.9;
  return { d: `M ${startX} ${startY} Q ${cpx} ${cpy} ${endX} ${endY}`, midX: labelX, midY: labelY, nx: perpX, ny: perpY };
}

/* 关键连线（带箭头）：终点在目标节点外 endGap 处收笔，保证箭头永不被节点覆盖 */
function arrowLine(
  sx: number, sy: number, tx: number, ty: number,
  sr: number, tr: number, startGap = 5, endGap = 8,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: sx + ux * (sr + startGap), y1: sy + uy * (sr + startGap),
    x2: tx - ux * (tr + endGap), y2: ty - uy * (tr + endGap),
  };
}

function renderNodeShape(
  node: SimNode,
  original: DynamicGraphNode,
  palette: ReturnType<typeof getNodeFill>,
  keyColor: string | undefined,
  onClick: (e: React.MouseEvent) => void,
  onMouseEnter: (e: React.MouseEvent) => void,
  onMouseLeave: (e: React.MouseEvent) => void,
  onPointerDown: (e: React.PointerEvent) => void,
  showLabel: boolean,
  isSearchHit: boolean,
  pulseRing: boolean,
  isCenterStar: boolean,
  dimmed: boolean,
) {
  const r = node.radius;
  const { fill, text } = palette;
  const strokeW = dimmed ? 1 : 1.35;
  const common = {
    onClick,
    onMouseEnter,
    onMouseLeave,
    onPointerDown,
    style: { cursor: "pointer" } as React.CSSProperties,
  };

  /* 主体形状：中心领域 = 恒星（发光球体 + 呼吸光晕 + 轨道环）；其余 = 淡彩圆 + 顶部高光 */
  let shape: React.ReactNode;
  if (isCenterStar) {
    shape = (
      <g>
        {/* 呼吸光晕 */}
        <circle cx={node.x} cy={node.y} r={r + 30} fill="url(#core-halo)">
          <animate attributeName="r" values={`${r + 28};${r + 37};${r + 28}`} dur="5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;1;0.75" dur="5s" repeatCount="indefinite" />
        </circle>
        {/* 缓慢旋转的轨道环 */}
        <g>
          <animateTransform
            attributeName="transform" type="rotate"
            from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
            dur="60s" repeatCount="indefinite"
          />
          <circle cx={node.x} cy={node.y} r={r * 1.52} fill="none" stroke="#9FB0C9"
            strokeWidth={1.1} strokeDasharray="2 9" opacity={0.5} />
        </g>
        {/* 恒星本体：白热核心渐变球 */}
        <circle cx={node.x} cy={node.y} r={r} fill="url(#core-star)"
          stroke="#5A7194" strokeWidth={1.4} filter="url(#glow-soft)" />
        {/* 左上高光 */}
        <circle cx={node.x - r * 0.26} cy={node.y - r * 0.3} r={r * 0.32} fill="rgba(255,255,255,0.45)" />
      </g>
    );
  } else {
    shape = (
      <g>
        {keyColor && !dimmed && (
          /* 关键技能外环：与恒星连线同色，标识"关键技能"身份 */
          <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke={keyColor} strokeWidth={1.4} opacity={0.85} />
        )}
        <circle cx={node.x} cy={node.y} r={r} fill={fill} stroke={palette.stroke}
          strokeWidth={strokeW} filter={keyColor && !dimmed ? "url(#node-shadow)" : undefined} />
        {/* 顶部柔和高光，增加体积感 */}
        {!dimmed && (
          <circle cx={node.x} cy={node.y} r={r - 0.4} fill="url(#node-gloss)" style={{ pointerEvents: "none" }} />
        )}
      </g>
    );
  }

  const fontSize = Math.max(9.5, Math.min(13, 8 + r * 0.18));
  const labelMax = r < 20 ? 3 : r < 28 ? 4 : r < 36 ? 6 : 8;
  const label = showLabel && original.name.length > labelMax
    ? original.name.slice(0, labelMax) + "…"
    : showLabel ? original.name : "";

  return (
    <g {...common}>
      {pulseRing && (
        <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke={isCenterStar ? "#D6AE7E" : (original.trend ? TREND_COLOR[original.trend] : "#D6AE7E")} strokeWidth={2.2} opacity={0.6}>
          <animate attributeName="r" values={`${r + 6};${r + 18};${r + 6}`} dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      {/* 趋势外环（中心恒星用轨道环代替，不再叠加） */}
      {!isCenterStar && original.trend && !dimmed && (
        <circle cx={node.x} cy={node.y} r={r + 3.5} fill="none" stroke={TREND_COLOR[original.trend]} strokeWidth={1.3} opacity={0.4} />
      )}
      {isSearchHit && (
        <circle cx={node.x} cy={node.y} r={r + 12} fill="none" stroke="#D6AE7E" strokeWidth={2.2} strokeDasharray="4 3" opacity={0.8} />
      )}
      {shape}
      <text
        x={node.x}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={isCenterStar ? 14 : fontSize}
        fontWeight={isCenterStar ? 800 : 600}
        fill={isCenterStar ? "#14315F" : text}
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

function AbilityGraphInner(
  props: Props,
  ref: React.ForwardedRef<AbilityGraphHandle>,
) {
  const {
    nodes: inputNodes, edges: inputEdges, highlight,
    onNodeClick, onNodeHover, onEdgeHover, onSelectionEmpty,
    width = DEFAULT_W, height = DEFAULT_H, svgRef: outerSvgRef,
    showEdgeLabels = false,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (outerSvgRef) outerSvgRef.current = svgRef.current;
  }, [outerSvgRef]);

  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0, k: 1 });
  const panningRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean }>({
    active: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false,
  });
  const dragRef = useRef<{ id: string | null; offsetX: number; offsetY: number; moved: boolean }>({
    id: null, offsetX: 0, offsetY: 0, moved: false,
  });
  const [, forceRerender] = useState(0);

  /* ===== 关键技能结构：恒星→关键技能（实线箭头）、关键技能→子技能（虚线箭头） ===== */
  const centerDomainId = highlight.centerDomainId;

  const skillIds = useMemo(() => {
    const s = new Set<string>();
    for (const n of inputNodes) if (n.type === "Skill") s.add(n.id);
    return s;
  }, [inputNodes]);

  /* 关键技能颜色（与恒星连线一一对应） */
  const keyColorByNode = useMemo(() => {
    const m = new Map<string, string>();
    KEY_SKILL_LIST.forEach((id, i) => m.set(id, STAR_SPOKE_COLORS[i % STAR_SPOKE_COLORS.length]!));
    return m;
  }, []);

  /* 关键技能的直接子技能（BROADER_THAN，排除自身也是关键技能的） */
  const subLinks = useMemo(() => {
    const list: { edgeId: string; from: string; to: string }[] = [];
    for (const e of inputEdges) {
      if (e.relationType !== "BROADER_THAN") continue;
      if (!KEY_SKILL_LIST.includes(e.source)) continue;
      if (!skillIds.has(e.target)) continue;
      if (KEY_SKILL_LIST.includes(e.target)) continue;
      list.push({ edgeId: e.id, from: e.source, to: e.target });
    }
    return list;
  }, [inputEdges, skillIds]);

  /* 注入力导向模拟的虚拟边：把关键技能拉向恒星、子技能拉向关键技能 */
  const simEdges = useMemo<DynamicGraphEdge[]>(() => {
    const out: DynamicGraphEdge[] = [...inputEdges];
    if (centerDomainId) {
      for (const id of KEY_SKILL_LIST) {
        out.push({ id: `spoke-${id}`, source: centerDomainId, target: id, relationType: "REQUIRES", confidence: "human", importance: 0.95, weight: 190 });
      }
      for (const l of subLinks) {
        out.push({ id: `subsim-${l.edgeId}`, source: l.from, target: l.to, relationType: "BROADER_THAN", confidence: "human", importance: 0.9, weight: 140 });
      }
    }
    return out;
  }, [inputEdges, subLinks, centerDomainId]);

  const sim = useForceSimulation(inputNodes, simEdges, { width, height });

  const nodeById = useMemo(() => {
    const m = new Map<string, DynamicGraphNode>();
    for (const n of inputNodes) m.set(n.id, n);
    return m;
  }, [inputNodes]);

  const edgeById = useMemo(() => {
    const m = new Map<string, DynamicGraphEdge>();
    for (const e of inputEdges) m.set(e.id, e);
    return m;
  }, [inputEdges]);

  const neighborMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of inputEdges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [inputEdges]);

  const edgeConnectsNodes = useCallback((edgeId: string, ids: Set<string>) => {
    const e = edgeById.get(edgeId);
    if (!e) return false;
    return ids.has(e.source) && ids.has(e.target);
  }, [edgeById]);

  /* ===== 视图切换（技术栈 / 熟练度级别）：未命中的节点淡出为背景 ===== */
  const stackActive = !!highlight.stackFilter && highlight.stackFilter !== "全部";
  const levelActive = !!highlight.levelFilter && highlight.levelFilter !== "";
  const viewActive = stackActive || levelActive;
  const levelIdx = highlight.levelFilter
    ? (PROFICIENCY_LEVELS as readonly string[]).indexOf(highlight.levelFilter) + 1
    : 0;

  const viewMatch = useCallback((id: string) => {
    const sOk = !stackActive || highlight.stackByNode[id] === highlight.stackFilter;
    const lOk = !levelActive || (highlight.levelByNode[id] ?? -1) === levelIdx;
    return sOk && lOk;
  }, [stackActive, levelActive, levelIdx, highlight.stackByNode, highlight.levelByNode]);

  /* ===== 中心领域切换：新中心放大为恒星并固定于画布中心，原中心还原为普通领域节点 ===== */
  const prevCenterRef = useRef<string | null>(null);
  useEffect(() => {
    if (!centerDomainId) return;
    if (prevCenterRef.current && prevCenterRef.current !== centerDomainId) {
      const prev = sim.nodes.find((n) => n.id === prevCenterRef.current);
      if (prev) {
        prev.radius = defaultNodeRadius(prev.demandLevel, prev.requiredLevel);
        sim.setNodePosition(prev.id, { fixed: false });
      }
    }
    const center = sim.nodes.find((n) => n.id === centerDomainId);
    if (center) {
      center.radius = DOMAIN_STAR_RADIUS;
      sim.setNodePosition(center.id, { x: width / 2, y: height / 2, fixed: true });
    }
    prevCenterRef.current = centerDomainId;
    sim.reheat(0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerDomainId, width, height]);

  const focusNode = useCallback((id: string, animate = true) => {
    const idx = sim.nodes.findIndex((n) => n.id === id);
    if (idx < 0) return;
    const nd = sim.nodes[idx];
    const targetX = width / 2 - nd.x;
    const targetY = height / 2 - nd.y;
    const targetK = 1.15;
    if (!animate) {
      setViewOffset({ x: targetX, y: targetY, k: targetK });
      return;
    }
    const start = { ...viewOffset };
    const dur = 520;
    const t0 = performance.now();
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setViewOffset({
        x: start.x + (targetX - start.x) * ease,
        y: start.y + (targetY - start.y) * ease,
        k: start.k + (targetK - start.k) * ease,
      });
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [sim.nodes, width, height, viewOffset]);

  const exportSvgString = useCallback(() => {
    const el = svgRef.current;
    if (!el) return "";
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bb = el.getBBox();
    clone.setAttribute("viewBox", `${bb.x - 20} ${bb.y - 20} ${bb.width + 40} ${bb.height + 40}`);
    clone.setAttribute("width", String(bb.width + 40));
    clone.setAttribute("height", String(bb.height + 40));
    const s = new XMLSerializer().serializeToString(clone);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;
  }, []);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref({ focusNode, getSvgElement: () => svgRef.current, exportSvgString });
    } else {
      ref.current = { focusNode, getSvgElement: () => svgRef.current, exportSvgString };
    }
  }, [ref, focusNode, exportSvgString]);

  const onWheel = (ev: React.WheelEvent) => {
    ev.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const delta = -ev.deltaY;
    const scaleFactor = delta > 0 ? 1.12 : 1 / 1.12;
    const newK = Math.max(0.4, Math.min(2.6, viewOffset.k * scaleFactor));
    const kRatio = newK / viewOffset.k;
    setViewOffset({
      k: newK,
      x: mx - (mx - viewOffset.x) * kRatio,
      y: my - (my - viewOffset.y) * kRatio,
    });
  };

  const onBackgroundPointerDown = (ev: React.PointerEvent) => {
    if (ev.target !== ev.currentTarget && !(ev.target as Element).classList.contains("graph-bg")) return;
    if (dragRef.current.id) return;
    panningRef.current = {
      active: true, sx: ev.clientX, sy: ev.clientY,
      ox: viewOffset.x, oy: viewOffset.y, moved: false,
    };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    if (dragRef.current.id) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = (ev.clientX - rect.left - viewOffset.x) / viewOffset.k;
      const localY = (ev.clientY - rect.top - viewOffset.y) / viewOffset.k;
      const id = dragRef.current.id;
      const newX = localX - dragRef.current.offsetX;
      const newY = localY - dragRef.current.offsetY;
      sim.setNodePosition(id, { x: newX, y: newY, fixed: true });
      sim.reheat(0.25);
      dragRef.current.moved = true;
      forceRerender((t) => t + 1);
      return;
    }
    if (panningRef.current.active) {
      const dx = ev.clientX - panningRef.current.sx;
      const dy = ev.clientY - panningRef.current.sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panningRef.current.moved = true;
      setViewOffset((v) => ({ ...v, x: panningRef.current.ox + dx, y: panningRef.current.oy + dy }));
    }
  };

  const onPointerUp = (ev: React.PointerEvent) => {
    if (dragRef.current.id) {
      const moved = dragRef.current.moved;
      const id = dragRef.current.id;
      dragRef.current = { id: null, offsetX: 0, offsetY: 0, moved: false };
      if (!moved && id) {
      }
      if (id) {
        /* 中心恒星拖拽释放后保持固定，其余节点回到自由布局 */
        if (id === highlight.centerDomainId) sim.setNodePosition(id, { fixed: true });
        else sim.setNodePosition(id, { fixed: false });
      }
      sim.reheat(0.3);
    }
    if (panningRef.current.active) {
      if (panningRef.current.moved) {
      } else if (onSelectionEmpty) {
        onSelectionEmpty();
      }
      panningRef.current.active = false;
    }
    (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
  };

  const handleNodePointerDown = (id: string) => (ev: React.PointerEvent) => {
    ev.stopPropagation();
    const node = sim.nodes.find((n) => n.id === id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    const localX = (ev.clientX - rect.left - viewOffset.x) / viewOffset.k;
    const localY = (ev.clientY - rect.top - viewOffset.y) / viewOffset.k;
    dragRef.current = {
      id,
      offsetX: localX - node.x,
      offsetY: localY - node.y,
      moved: false,
    };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  };

  const buildVisibleNodeIds = (): Set<string> => {
    const s = new Set<string>();
    const tf = highlight.typeFilter;
    const focus = highlight.focusNeighborsOf;
    for (const n of sim.nodes) {
      if (tf.size > 0 && !tf.has(nodeById.get(n.id)!.type)) continue;
      if (focus) {
        if (n.id !== focus && !neighborMap.get(focus)?.has(n.id)) continue;
      }
      s.add(n.id);
    }
    return s;
  };

  const visibleIds = buildVisibleNodeIds();

  const renderMarkers = () => (
    <defs>
      {/* 恒星 → 关键技能：每个关键技能一种淡彩箭头 */}
      {STAR_SPOKE_COLORS.map((c, i) => (
        <marker key={i} id={`spoke-arr-${i}`} viewBox="0 0 10 10" refX="8.6" refY="5"
          markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
        </marker>
      ))}
      {/* 关键技能 → 子技能：浅色虚线箭头 */}
      <marker id="sub-arr" viewBox="0 0 10 10" refX="8.6" refY="5"
        markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={SUB_ARROW_COLOR} />
      </marker>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#5A7194" floodOpacity="0.5" />
      </filter>
      <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" floodColor="#5A7194" floodOpacity="0.2" />
      </filter>
      <radialGradient id="core-star" cx="42%" cy="36%" r="78%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="30%" stopColor="#E3EBF5" />
        <stop offset="66%" stopColor="#8FA9CC" />
        <stop offset="100%" stopColor="#46586E" />
      </radialGradient>
      <radialGradient id="core-halo">
        <stop offset="0%" stopColor="#8FA9CC" stopOpacity="0.24" />
        <stop offset="55%" stopColor="#8FA9CC" stopOpacity="0.09" />
        <stop offset="100%" stopColor="#8FA9CC" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="node-gloss" cx="34%" cy="26%" r="80%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <pattern id="graph-grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M 28 0 L 0 0 0 28" fill="none" stroke={T.cloud} strokeWidth="0.5" opacity="0.55" />
      </pattern>
    </defs>
  );

  const vx = viewOffset.x;
  const vy = viewOffset.y;
  const vk = viewOffset.k;

  /* 关键连线的淡出判断（跟随焦点模式与视图过滤） */
  const linkDimmed = (skillId: string) => {
    const focus = highlight.focusNeighborsOf;
    if (focus && focus !== skillId && focus !== centerDomainId) return true;
    if (viewActive && !viewMatch(skillId) && skillId !== centerDomainId) return true;
    return false;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative select-none overflow-hidden rounded-lg"
      style={{ minHeight: 480, background: T.white }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "none" }}
      >
        {renderMarkers()}
        <rect className="graph-bg" x={0} y={0} width={width} height={height} fill="url(#graph-grid)" />

        <g transform={`translate(${vx} ${vy}) scale(${vk})`}>
          {/* 普通边层：无箭头，淡彩实线/虚线；技能相关边默认隐藏（仅保留关键连线） */}
          <g className="edges-layer">
            {sim.edges.map((se: SimEdge) => {
              if (se.id.startsWith("spoke-") || se.id.startsWith("subsim-")) return null;
              const sIdx = sim.nodes.findIndex((n) => n.id === se.sourceId);
              const tIdx = sim.nodes.findIndex((n) => n.id === se.targetId);
              if (sIdx < 0 || tIdx < 0) return null;
              const sNode = sim.nodes[sIdx];
              const tNode = sim.nodes[tIdx];
              const orig = edgeById.get(se.id)!;
              const rt: RelationType = orig.relationType;
              const colorCfg = RELATION_COLOR[rt];
              const showEdge =
                visibleIds.has(se.sourceId) && visibleIds.has(se.targetId) &&
                edgeConnectsNodes(se.id, visibleIds);
              if (!showEdge) return null;

              const isOnPath = highlight.pathEdgeIds.has(se.id);
              /* 技能节点只通过关键连线呈现，其余技能相关边不再连接 */
              const touchesSkill = skillIds.has(se.sourceId) || skillIds.has(se.targetId);
              if (touchesSkill && !isOnPath) return null;

              const sel = highlight.selectedId && (se.sourceId === highlight.selectedId || se.targetId === highlight.selectedId);
              const hov = highlight.hoveredId && (se.sourceId === highlight.hoveredId || se.targetId === highlight.hoveredId);
              const dim = highlight.focusNeighborsOf && !(se.sourceId === highlight.focusNeighborsOf || se.targetId === highlight.focusNeighborsOf);
              const centerTouch = se.sourceId === highlight.centerDomainId || se.targetId === highlight.centerDomainId;
              const viewOff = viewActive && !(viewMatch(se.sourceId) && viewMatch(se.targetId)) && !centerTouch;
              const baseAlpha = CONFIDENCE_ALPHA[orig.confidence] ?? 0.6;

              const curved = rt === "RELATED_TO" || rt === "SIMILAR_TO";
              const path = edgePath(sNode.x, sNode.y, tNode.x, tNode.y, sNode.radius, tNode.radius, curved ? 0.16 : 0.04);
              const strokeW = isOnPath ? 3.2 : sel ? 2.6 : hov ? 2.2 : rt === "REQUIRES" ? 1.4 : 1.1;
              const stroke = isOnPath ? "#D6AE7E" : sel ? "#7C93B5" : colorCfg.stroke;
              const opacity = dim ? 0.05
                : viewOff ? 0.05
                : isOnPath ? 1
                : sel ? 0.95
                : hov ? Math.max(0.6, baseAlpha)
                : baseAlpha;
              const dash = colorCfg.dash;

              return (
                <g key={se.id}
                  onMouseEnter={(e) => onEdgeHover?.(se.id, e)}
                  onMouseLeave={() => onEdgeHover?.(null)}
                  style={{ pointerEvents: "stroke" }}
                  filter={isOnPath ? "url(#glow)" : undefined}
                >
                  <path d={path.d} fill="none" stroke="transparent" strokeWidth={Math.max(12, strokeW + 10)}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }} />
                  <path d={path.d} fill="none" stroke={stroke} strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeDasharray={isOnPath || sel || hov ? undefined : dash}
                    opacity={opacity}
                    style={{ pointerEvents: "none" }} />
                  {showEdgeLabels && opacity > 0.5 && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={path.midX - 30} y={path.midY - 9} width={60} height={18} rx={9}
                        fill={colorCfg.labelBg} stroke={stroke} strokeWidth={0.8} opacity={0.9} />
                      <text x={path.midX} y={path.midY + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={9.5} fontWeight={600} fill={stroke}>
                        {rt === "REQUIRES" ? "要求" : rt === "BROADER_THAN" ? "包含" : rt === "EVOLVES_INTO" ? "演化" : rt === "RELATED_TO" ? "相关" : "相似"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 关键连线层：恒星→关键技能（淡彩实线箭头）、关键技能→子技能（浅色虚线箭头）
              端点在节点边缘外收笔 + 节点层在其上，保证箭头不被覆盖 */}
          <g className="spokes-layer" style={{ pointerEvents: "none" }}>
            {centerDomainId && visibleIds.has(centerDomainId) && (() => {
              const star = sim.nodes.find((n) => n.id === centerDomainId);
              if (!star) return null;
              return (
                <>
                  {KEY_SKILL_LIST.map((sid, i) => {
                    if (!visibleIds.has(sid)) return null;
                    const nd = sim.nodes.find((n) => n.id === sid);
                    if (!nd) return null;
                    const dim = linkDimmed(sid);
                    const seg = arrowLine(star.x, star.y, nd.x, nd.y, star.radius, nd.radius);
                    const color = STAR_SPOKE_COLORS[i % STAR_SPOKE_COLORS.length]!;
                    return (
                      <line key={sid} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={color} strokeWidth={dim ? 1 : 1.8} strokeLinecap="round"
                        opacity={dim ? 0.08 : 0.9}
                        markerEnd={`url(#spoke-arr-${i % STAR_SPOKE_COLORS.length})`} />
                    );
                  })}
                  {subLinks.map((l) => {
                    if (!visibleIds.has(l.from) || !visibleIds.has(l.to)) return null;
                    const from = sim.nodes.find((n) => n.id === l.from);
                    const to = sim.nodes.find((n) => n.id === l.to);
                    if (!from || !to) return null;
                    const dim = linkDimmed(l.to) || linkDimmed(l.from);
                    const seg = arrowLine(from.x, from.y, to.x, to.y, from.radius, to.radius, 4, 7);
                    return (
                      <line key={l.edgeId} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={SUB_ARROW_COLOR} strokeWidth={dim ? 1 : 1.5} strokeLinecap="round"
                        strokeDasharray="5 4"
                        opacity={dim ? 0.08 : 0.95}
                        markerEnd="url(#sub-arr)" />
                    );
                  })}
                </>
              );
            })()}
          </g>

          <g className="nodes-layer">
            {sim.nodes.map((sn: SimNode) => {
              if (!visibleIds.has(sn.id)) return null;
              const orig = nodeById.get(sn.id)!;
              const selected = highlight.selectedId === sn.id;
              const hovered = highlight.hoveredId === sn.id;
              const onPath = highlight.pathNodeIds.has(sn.id);
              const searchHit = highlight.searchMatches.has(sn.id);
              const neighborOfFocus = highlight.focusNeighborsOf && (
                sn.id === highlight.focusNeighborsOf || neighborMap.get(highlight.focusNeighborsOf)?.has(sn.id)
              );
              const highlighted = hovered || onPath || searchHit || (!!highlight.focusNeighborsOf && neighborOfFocus);
              const hasFocusSignal = !!highlight.selectedId ||
                !!highlight.hoveredId ||
                highlight.pathNodeIds.size > 0 ||
                highlight.searchMatches.size > 0;
              const viewOff = viewActive && !viewMatch(sn.id) && sn.id !== highlight.centerDomainId;
              const dimmed = (!highlighted && hasFocusSignal && !selected) || viewOff;
              const palette = getNodeFill(orig.type, selected, highlighted, dimmed, orig.trend);

              return (
                <g key={sn.id}>
                  {renderNodeShape(
                    sn, orig, palette,
                    keyColorByNode.get(sn.id),
                    (e) => {
                      if (dragRef.current.moved) return;
                      onNodeClick(sn.id, e);
                    },
                    (e) => onNodeHover?.(sn.id, e),
                    () => onNodeHover?.(null),
                    handleNodePointerDown(sn.id),
                    true,
                    searchHit,
                    selected || onPath,
                    sn.id === highlight.centerDomainId,
                    dimmed,
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px]"
        style={{ background: "rgba(255,255,255,0.85)", border: `1px solid ${T.border}`, color: T.info }}>
        <span>滚轮缩放 · 拖拽平移 · 拖拽节点</span>
      </div>
      {sim.isRunning && (
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px]"
          style={{ background: `${T.cloud}99`, color: T.info }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.emerging }} />
          <span>布局优化中…</span>
        </div>
      )}
    </div>
  );
}

const AbilityGraph = (() => {
  const F = (props: Props & { ref?: React.ForwardedRef<AbilityGraphHandle> }) => {
    const { ref, ...rest } = props;
    return AbilityGraphInner(rest, ref ?? null);
  };
  return F as unknown as React.ForwardRefExoticComponent<Props & React.RefAttributes<AbilityGraphHandle>>;
})();

export default AbilityGraph;
export { AbilityGraph };
