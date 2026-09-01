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
  nodeSizeOf,
} from "../constants/graph-theme";
import type {
  DynamicGraphNode,
  DynamicGraphEdge,
  EntityType,
  RelationType,
} from "../types/dynamic-graph";

/* ===== 3D 球面旋转引擎（学 city_knowledge_graph_v9.html，仅自转逻辑 ===== */

interface SphericalNode {
  id: string;
  x3: number; y3: number; z3: number;  // 原始 3D 球面坐标（单位半径）
  x: number; y: number;                  // 投影后屏幕坐标（每帧更新）
  projZ: number;                          // 投影深度（用于排序）
  perspScale: number;                     // 透视缩放因子（用于节点大小缩放）
  radius: number;                         // 原始节点半径
  demandLevel: number;
}

/** Fibonacci 球面均匀分布（单位半径），用黄金角避免两极聚簇 */
function fibonacciSphere(n: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  if (n <= 0) return pts;
  const phi = Math.PI * (3 - Math.sqrt(5)); // 黄金角
  const offset = 2 / n;
  for (let i = 0; i < n; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

/** 旋转点（先绕 Y 轴，再绕 X 轴） */
function rotatePoint(x: number, y: number, z: number, rotX: number, rotY: number) {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;
  return { x: x1, y: y1, z: z2 };
}

/** 投影：返回屏幕坐标 + 深度 + 透视缩放 */
function project3D(
  x3: number, y3: number, z3: number,
  rotX: number, rotY: number,
  centerX: number, centerY: number,
  pixelScale: number,
  expandScale = 1.0,
) {
  const camera = 3.25;
  // 第一层：小 expandScale 乘单位坐标 → camera 级别
  const p = rotatePoint(x3 * expandScale, y3 * expandScale, z3 * expandScale, rotX, rotY);
  // camera / (camera - z * 1.15) → 近大远小透视因子（≈ 0.7 ~ 1.8）
  const perspective = camera / (camera - p.z * 1.15);
  // 第二层：pixelScale 把 3D 坐标映射到屏幕像素
  return {
    x: centerX + p.x * pixelScale * perspective,
    y: centerY + p.y * pixelScale * perspective,
    projZ: p.z,
    perspScale: perspective,
  };
}

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
  const startX = sx + ux * sr;
  const startY = sy + uy * sr;
  const endX = tx - ux * tr;
  const endY = ty - uy * tr;
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
  sr: number, tr: number, startGap = 0, endGap = 0,
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
  node: SphericalNode,
  original: DynamicGraphNode,
  palette: ReturnType<typeof getNodeFill>,
  onClick: (e: React.MouseEvent) => void,
  onMouseEnter: (e: React.MouseEvent) => void,
  onMouseLeave: (e: React.MouseEvent) => void,
  onPointerDown: (e: React.PointerEvent) => void,
  showLabel: boolean,
  isSearchHit: boolean,
  pulseRing: boolean,
  isCenterStar: boolean,
  dimmed: boolean,
  forceLabel: boolean,
) {
  const r = node.radius * (node.perspScale ?? 1);
  const { fill, text } = palette;
  const strokeW = dimmed ? 1 : 1.35;
  /* 深度调色：projZ ∈ [-1,1] → 背面(z<0)颜色变浅，正面(z>0)饱和，产生 3D 体积感 */
  const depthT = Math.max(0, Math.min(1, ((node.projZ ?? 0) + 1) / 2)); // 0(背) → 1(前)
  const depthAlpha = 0.5 + 0.5 * depthT; // 0.5 → 1.0
  const depthOpacity = dimmed ? 0.4 : depthAlpha;
  const common = {
    onClick,
    onMouseEnter,
    onMouseLeave,
    onPointerDown,
    style: { cursor: "pointer" } as React.CSSProperties,
  };

  /* 主体形状：中心领域 = 恒星（柔和渐变球）；其余 = 淡彩圆 + 顶部高光 */
  let shape: React.ReactNode;
  if (isCenterStar) {
    shape = (
      <g>
        <circle cx={node.x} cy={node.y} r={r} fill="url(#core-star)" />
      </g>
    );
  } else {
    shape = (
      <g opacity={depthOpacity}>
        <circle cx={node.x} cy={node.y} r={r} fill={fill} stroke={palette.stroke}
          strokeWidth={strokeW} />
        {/* 顶部柔和高光，增加体积感 */}
        {!dimmed && (
          <circle cx={node.x} cy={node.y} r={r - 0.4} fill="url(#node-gloss)" style={{ pointerEvents: "none" }} />
        )}
      </g>
    );
  }

  const fontSize = Math.max(9.5, Math.min(13, 8 + r * 0.18));
  /* 纯字符截断（无 SVG textLength 拉伸）：按节点内可容纳字符数估算 */
  const innerWidth = Math.max(6, r * 2 - 6);
  const charW = fontSize * 1.05;
  const labelMax = Math.max(1, Math.floor(innerWidth / charW));
  const name = original.name || "";
  /* 密集图标签策略：小节点默认隐藏名称（放不下 ≥2 字时），
     悬停/选中/搜索/路径命中的节点强制显示（超长仍省略号截断） */
  const canFit = labelMax >= 2;
  const showText = showLabel && (canFit || forceLabel || isSearchHit || pulseRing || isCenterStar);
  const label = showText
    ? (name.length > labelMax ? name.slice(0, labelMax) + "…" : name)
    : "";

  return (
    <g {...common}>
      {pulseRing && (
        <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke={isCenterStar ? "#D6AE7E" : TREND_COLOR[original.trend] || "#D6AE7E"} strokeWidth={2.2} opacity={0.6}>
          <animate attributeName="r" values={`${r + 6};${r + 18};${r + 6}`} dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      {isSearchHit && (
        <circle cx={node.x} cy={node.y} r={r + 12} fill="none" stroke="#D6AE7E" strokeWidth={2.2} strokeDasharray="4 3" opacity={0.8} />
      )}
      {shape}
      {label && (
        <text
          x={node.x}
          y={node.y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={isCenterStar ? 14 : fontSize}
          fontWeight={isCenterStar ? 800 : 600}
          fill={isCenterStar ? "#14315F" : text}
          opacity={isCenterStar ? 1 : depthOpacity}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
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

  /* ===== 关键技能结构：恒星→关键技能（实线箭头）、关键技能→子技能（虚线箭头） ===== */
  const centerDomainId = highlight.centerDomainId;

  const skillIds = useMemo(() => {
    const s = new Set<string>();
    for (const n of inputNodes) if (n.type === "Skill") s.add(n.id);
    return s;
  }, [inputNodes]);

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

  /* ===== 3D 球面节点初始化：中心领域固定球心，其余 Fibonacci 均匀分布在球面上 ===== */
  const sphericalNodes = useMemo<SphericalNode[]>(() => {
    if (inputNodes.length === 0) return [];
    const nonCenterIds = new Set(inputNodes.map((n) => n.id));
    nonCenterIds.delete(centerDomainId);
    const outerCount = nonCenterIds.size;
    const spherePts = fibonacciSphere(outerCount);

    const out: SphericalNode[] = [];
    let ptIdx = 0;
    for (const n of inputNodes) {
      const isCenter = n.id === centerDomainId;
      let x3 = 0, y3 = 0, z3 = 0;
      if (!isCenter && ptIdx < spherePts.length) {
        const pt = spherePts[ptIdx++]!;
        x3 = pt.x; y3 = pt.y; z3 = pt.z;
      }
      const baseR = nodeSizeOf(n.demandLevel, n.requiredLevel);
      const radius = isCenter ? DOMAIN_STAR_RADIUS : baseR;
      out.push({
        id: n.id,
        x3, y3, z3,
        x: width / 2, y: height / 2,  // 初始屏幕坐标，自转循环第一帧覆盖
        projZ: 0,
        perspScale: 1,
        radius,
        demandLevel: n.demandLevel,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputNodes, centerDomainId, width, height]);

  /* 自转状态 */
  const rotState = useRef({ rotX: -0.14, rotY: 0.42, paused: false, resumeTimer: 0 });
  const [, forceRenderTick] = useState(0);

  /* ===== 自转主循环：requestAnimationFrame → rotatePoint → project3D → 更新 sphericalNodes → 触发渲染 ===== */
  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    (window as any).__sphereFrames = 0;
    const render = () => {
      const { paused } = rotState.current;
      if (!paused) {
        rotState.current.rotY += 0.0018;
        rotState.current.rotX = -0.14 + Math.sin(rotState.current.rotY * 0.35) * 0.12;
      }
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) * 0.42;
      for (const nd of sphericalNodes) {
        if (nd.id === centerDomainId) {
          nd.x = cx; nd.y = cy; nd.projZ = 0; nd.perspScale = 1;
          continue;
        }
        const p = project3D(nd.x3, nd.y3, nd.z3, rotState.current.rotX, rotState.current.rotY, cx, cy, scale);
        nd.x = p.x; nd.y = p.y; nd.projZ = p.projZ; nd.perspScale = p.perspScale;
      }
      sphericalNodes.sort((a, b) => a.projZ - b.projZ);
      frameCount++;
      (window as any).__sphereFrames = frameCount;
      forceRenderTick((t) => (t + 1) & 0xffff);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [sphericalNodes, centerDomainId, width, height]);

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

  /* ===== 中心领域切换：改球面节点 radius，位置由球面自转自动处理 ===== */
  const prevCenterRef = useRef<string | null>(null);
  useEffect(() => {
    if (!centerDomainId) return;
    if (prevCenterRef.current && prevCenterRef.current !== centerDomainId) {
      const prev = sphericalNodes.find((n) => n.id === prevCenterRef.current);
      if (prev) prev.radius = nodeSizeOf(prev.demandLevel);
    }
    const center = sphericalNodes.find((n) => n.id === centerDomainId);
    if (center) center.radius = DOMAIN_STAR_RADIUS;
    prevCenterRef.current = centerDomainId;
  }, [centerDomainId, sphericalNodes]);

  const focusNode = useCallback((id: string, animate = true) => {
    const nd = sphericalNodes.find((n) => n.id === id);
    if (!nd) return;
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
  }, [sphericalNodes, width, height, viewOffset]);

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
    const newK = Math.max(0.4, Math.min(3.6, viewOffset.k * scaleFactor));
    const kRatio = newK / viewOffset.k;
    setViewOffset({
      k: newK,
      x: mx - (mx - viewOffset.x) * kRatio,
      y: my - (my - viewOffset.y) * kRatio,
    });
  };

  /* ===== 交互：点击不暂停自转，拖拽时才暂停，松开后立刻恢复 ===== */
  const pauseRotation = useCallback(() => {
    rotState.current.paused = true;
    if (rotState.current.resumeTimer) {
      clearTimeout(rotState.current.resumeTimer);
      rotState.current.resumeTimer = 0;
    }
  }, []);
  const resumeRotation = useCallback(() => {
    rotState.current.paused = false;
    if (rotState.current.resumeTimer) {
      clearTimeout(rotState.current.resumeTimer);
      rotState.current.resumeTimer = 0;
    }
  }, []);

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
      // 球面模型：拖拽节点 → 手动旋转视角；仅在检测到移动时才暂停自转
      const dx = ev.clientX - dragRef.current.offsetX;
      const dy = ev.clientY - dragRef.current.offsetY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        if (!dragRef.current.moved) {
          dragRef.current.moved = true;
          pauseRotation();
        }
        rotState.current.rotY += dx * 0.003;
        rotState.current.rotX = Math.max(-1.25, Math.min(1.25, rotState.current.rotX + dy * 0.003));
        dragRef.current.offsetX = ev.clientX;
        dragRef.current.offsetY = ev.clientY;
      }
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
      // 拖拽过：松开后立刻恢复自转
      resumeRotation();
      dragRef.current = { id: null, offsetX: 0, offsetY: 0, moved: false };
    }
    if (panningRef.current.active) {
      if (!panningRef.current.moved && onSelectionEmpty) {
        onSelectionEmpty();
      }
      panningRef.current.active = false;
    }
    (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
  };

  const handleNodePointerDown = (id: string) => (ev: React.PointerEvent) => {
    ev.stopPropagation();
    // 点击不暂停自转（用户要求"点击后依旧自转"）；仅在 pointermove 检测到拖拽时才暂停
    dragRef.current = {
      id,
      offsetX: ev.clientX,
      offsetY: ev.clientY,
      moved: false,
    };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  };

  const buildVisibleNodeIds = (): Set<string> => {
    const s = new Set<string>();
    const tf = highlight.typeFilter;
    const focus = highlight.focusNeighborsOf;
    for (const n of sphericalNodes) {
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
      {/* 恒星：TikZ Domain 柔和渐变（淡蓝→深蓝灰，无白热素描感） */}
      <radialGradient id="core-star" cx="42%" cy="36%" r="78%">
        <stop offset="0%" stopColor="#EEF1F6" />
        <stop offset="35%" stopColor="#C8D4E3" />
        <stop offset="72%" stopColor="#8FA9CC" />
        <stop offset="100%" stopColor="#5A7194" />
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
            {inputEdges.map((orig) => {
              const sIdx = sphericalNodes.findIndex((n) => n.id === orig.source);
              const tIdx = sphericalNodes.findIndex((n) => n.id === orig.target);
              if (sIdx < 0 || tIdx < 0) return null;
              const sNode = sphericalNodes[sIdx]!;
              const tNode = sphericalNodes[tIdx]!;
              const rt: RelationType = orig.relationType;
              const colorCfg = RELATION_COLOR[rt];
              const showEdge =
                visibleIds.has(orig.source) && visibleIds.has(orig.target) &&
                edgeConnectsNodes(orig.id, visibleIds);
              if (!showEdge) return null;

              const isOnPath = highlight.pathEdgeIds.has(orig.id);
              /* 技能节点只通过关键连线呈现，其余技能相关边不再连接 */
              const touchesSkill = skillIds.has(orig.source) || skillIds.has(orig.target);
              if (touchesSkill && !isOnPath) return null;

              const sel = highlight.selectedId && (orig.source === highlight.selectedId || orig.target === highlight.selectedId);
              const hov = highlight.hoveredId && (orig.source === highlight.hoveredId || orig.target === highlight.hoveredId);
              const dim = highlight.focusNeighborsOf && !(orig.source === highlight.focusNeighborsOf || orig.target === highlight.focusNeighborsOf);
              const centerTouch = orig.source === highlight.centerDomainId || orig.target === highlight.centerDomainId;
              const viewOff = viewActive && !(viewMatch(orig.source) && viewMatch(orig.target)) && !centerTouch;
              const baseAlpha = CONFIDENCE_ALPHA[orig.confidence] ?? 0.6;
              /* 选中节点存在时：非相关边淡出，衬托选中节点+邻居+连线的高亮 */
              const focusDimmed = !!highlight.selectedId && !sel;

              const curved = rt === "RELATED_TO" || rt === "SIMILAR_TO";
              const path = edgePath(sNode.x, sNode.y, tNode.x, tNode.y, sNode.radius * sNode.perspScale, tNode.radius * tNode.perspScale, curved ? 0.16 : 0.04);
              const strokeW = isOnPath ? 3.2 : sel ? 2.6 : hov ? 2.2 : rt === "REQUIRES" ? 1.4 : 1.1;
              const stroke = isOnPath ? "#D6AE7E" : sel ? "#7C93B5" : colorCfg.stroke;
              const opacity = dim ? 0.05
                : viewOff ? 0.05
                : focusDimmed ? 0.12
                : isOnPath ? 1
                : sel ? 0.95
                : hov ? Math.max(0.6, baseAlpha)
                : baseAlpha;
              const dash = colorCfg.dash;

              return (
                <g key={orig.id}
                  onMouseEnter={(e) => onEdgeHover?.(orig.id, e)}
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
              const star = sphericalNodes.find((n) => n.id === centerDomainId);
              if (!star) return null;
              return (
                <>
                  {KEY_SKILL_LIST.map((sid, i) => {
                    if (!visibleIds.has(sid)) return null;
                    const nd = sphericalNodes.find((n) => n.id === sid);
                    if (!nd) return null;
                    const dim = linkDimmed(sid);
                    /* 选中恒星或该关键技能时，此 spoke 高亮 */
                    const sel = highlight.selectedId === centerDomainId || highlight.selectedId === sid;
                    const focusDimmed = !!highlight.selectedId && !sel;
                    const seg = arrowLine(star.x, star.y, nd.x, nd.y, star.radius * star.perspScale, nd.radius * nd.perspScale);
                    const color = STAR_SPOKE_COLORS[i % STAR_SPOKE_COLORS.length]!;
                    return (
                      <line key={sid} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={color} strokeWidth={sel ? 2.6 : dim ? 1 : 1.8} strokeLinecap="round"
                        opacity={dim ? 0.08 : focusDimmed ? 0.18 : sel ? 1 : 0.9}
                        markerEnd={`url(#spoke-arr-${i % STAR_SPOKE_COLORS.length})`} />
                    );
                  })}
                  {subLinks.map((l) => {
                    if (!visibleIds.has(l.from) || !visibleIds.has(l.to)) return null;
                    const from = sphericalNodes.find((n) => n.id === l.from);
                    const to = sphericalNodes.find((n) => n.id === l.to);
                    if (!from || !to) return null;
                    const dim = linkDimmed(l.to) || linkDimmed(l.from);
                    const sel = highlight.selectedId === l.from || highlight.selectedId === l.to;
                    const focusDimmed = !!highlight.selectedId && !sel;
                    const seg = arrowLine(from.x, from.y, to.x, to.y, from.radius * from.perspScale, to.radius * to.perspScale);
                    return (
                      <line key={l.edgeId} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={SUB_ARROW_COLOR} strokeWidth={sel ? 2.2 : dim ? 1 : 1.5} strokeLinecap="round"
                        strokeDasharray="5 4"
                        opacity={dim ? 0.08 : focusDimmed ? 0.18 : sel ? 1 : 0.95}
                        markerEnd="url(#sub-arr)" />
                    );
                  })}
                </>
              );
            })()}
          </g>

          <g className="nodes-layer">
            {sphericalNodes.map((sn) => {
              if (!visibleIds.has(sn.id)) return null;
              const orig = nodeById.get(sn.id)!;
              const selected = highlight.selectedId === sn.id;
              const hovered = highlight.hoveredId === sn.id;
              const onPath = highlight.pathNodeIds.has(sn.id);
              const searchHit = highlight.searchMatches.has(sn.id);
              const neighborOfFocus = highlight.focusNeighborsOf && (
                sn.id === highlight.focusNeighborsOf || neighborMap.get(highlight.focusNeighborsOf)?.has(sn.id)
              );
              /* 选中节点的直接邻居也高亮（点击节点 → 该节点+邻居+连线全部高亮） */
              const neighborOfSelected = highlight.selectedId && (
                sn.id === highlight.selectedId || neighborMap.get(highlight.selectedId)?.has(sn.id)
              );
              const highlighted = hovered || onPath || searchHit
                || (!!highlight.focusNeighborsOf && neighborOfFocus)
                || (!!highlight.selectedId && neighborOfSelected);
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
                    !!highlighted,
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px]"
        style={{ background: "rgba(255,255,255,0.85)", border: `1px solid ${T.border}`, color: T.info }}>
        <span>滚轮缩放 · 拖拽旋转视角</span>
      </div>
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
