import { useCallback, useEffect, useRef, useState } from "react";
import type { DynamicGraphNode, DynamicGraphEdge } from "../types/dynamic-graph";

export interface SimNode extends Required<Pick<DynamicGraphNode, "x" | "y" | "vx" | "vy" | "radius">> {
  id: string;
  demandLevel: number;
  fx: number | null;
  fy: number | null;
}

export interface SimEdge {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
  distance: number;
}

export interface ForceSimulationOptions {
  width: number;
  height: number;
  repulsionStrength?: number;
  linkStrength?: number;
  linkDistance?: number;
  gravityStrength?: number;
  collisionRadiusPadding?: number;
  alphaDecay?: number;
  velocityDecay?: number;
  minRadius?: number;
  maxRadius?: number;
  demandRadiusFactor?: number;
}

interface SimulationFrame {
  nodes: SimNode[];
  edges: SimEdge[];
  tick: number;
  alpha: number;
}

const DEFAULTS = {
  // 斥力：无连线节点之间的推开力度，调大让整体铺开、不挤作一团
  repulsionStrength: 12500,
  linkStrength: 0.06,
  // 连线目标距离：有连线的节点之间保持的间距，调大让边线能看清
  linkDistance: 500,
  // 向心引力：把节点往中心拉的力度，调小避免把所有节点吸到一起
  gravityStrength: 0.01,
  // 节点碰撞最小间隙，调大避免节点圆互相压住
  collisionRadiusPadding: 26,
  alphaDecay: 0.022,
  velocityDecay: 0.38,
  minRadius: 12,
  maxRadius: 34,
  demandRadiusFactor: 22,
};

/* 需求热度（重要性）→ 节点半径：0.65~1 线性映射到 min~max，放大节点间的尺寸差异 */
export function defaultNodeRadius(demandLevel: number): number {
  const { minRadius, maxRadius } = DEFAULTS;
  const t = Math.min(1, Math.max(0, (demandLevel - 0.65) / 0.35));
  return minRadius + t * (maxRadius - minRadius);
}

/** 根据节点 ID 生成稳定的 0~1 坐标，避免在 React 渲染期间调用随机数。 */
function stableCoordinate(id: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function useForceSimulation(
  inputNodes: DynamicGraphNode[],
  inputEdges: DynamicGraphEdge[],
  options: ForceSimulationOptions,
) {
  const width = options.width;
  const height = options.height;
  const repulsionStrength = options.repulsionStrength ?? DEFAULTS.repulsionStrength;
  const linkStrength = options.linkStrength ?? DEFAULTS.linkStrength;
  const linkDistance = options.linkDistance ?? DEFAULTS.linkDistance;
  const gravityStrength = options.gravityStrength ?? DEFAULTS.gravityStrength;
  const collisionRadiusPadding = options.collisionRadiusPadding ?? DEFAULTS.collisionRadiusPadding;
  const alphaDecay = options.alphaDecay ?? DEFAULTS.alphaDecay;
  const velocityDecay = options.velocityDecay ?? DEFAULTS.velocityDecay;
  const minRadius = options.minRadius ?? DEFAULTS.minRadius;
  const maxRadius = options.maxRadius ?? DEFAULTS.maxRadius;
  const demandRadiusFactor = options.demandRadiusFactor ?? DEFAULTS.demandRadiusFactor;
  const rafRef = useRef<number | null>(null);
  const alphaRef = useRef(1);
  const [frame, setFrame] = useState<SimulationFrame>({ nodes: [], edges: [], tick: 0, alpha: 1 });
  const [isRunning, setIsRunning] = useState(inputNodes.length > 0);

  const simNodes = useRef<SimNode[]>([]);
  const simEdges = useRef<SimEdge[]>([]);
  const nodeIndexById = useRef<Map<string, number>>(new Map());

  const initializeSimulation = useCallback(() => {
    const n = inputNodes.length;
    const nodes: SimNode[] = new Array(n);
    const idx = new Map<string, number>();
    const previousById = new Map(simNodes.current.map((node) => [node.id, node]));
    for (let i = 0; i < n; i++) {
      const nd = inputNodes[i];
      const demand = Math.min(1, Math.max(0, (nd.demandLevel - 0.65) / 0.35));
      const radius = Math.min(maxRadius, minRadius + demand * demandRadiusFactor);
      idx.set(nd.id, i);
      const existing = previousById.get(nd.id);
      nodes[i] = {
        id: nd.id,
        demandLevel: nd.demandLevel,
        x: existing?.x ?? nd.x ?? width / 2 + (stableCoordinate(nd.id, 17) - 0.5) * (width * 0.6),
        y: existing?.y ?? nd.y ?? height / 2 + (stableCoordinate(nd.id, 31) - 0.5) * (height * 0.6),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        radius,
        fx: nd.fx ?? null,
        fy: nd.fy ?? null,
      };
    }
    nodeIndexById.current = idx;
    simNodes.current = nodes;

    const edges: SimEdge[] = inputEdges.map((e) => ({
      id: e.id,
      sourceId: e.source,
      targetId: e.target,
      strength: linkStrength * (0.6 + 0.8 * (e.importance ?? 0.5)),
      distance: linkDistance / (0.6 + 0.6 * (e.importance ?? 0.5)),
    }));
    simEdges.current = edges;
    alphaRef.current = n > 0 ? 1 : 0;
  }, [
    demandRadiusFactor,
    height,
    inputEdges,
    inputNodes,
    linkDistance,
    linkStrength,
    maxRadius,
    minRadius,
    width,
  ]);

  const step = useCallback(function runSimulationFrame() {
    const nodes = simNodes.current;
    const edges = simEdges.current;
    const id2i = nodeIndexById.current;
    const n = nodes.length;
    const alpha = alphaRef.current;

    if (n === 0) {
      setFrame((current) => ({ nodes: [], edges, tick: current.tick + 1, alpha: 0 }));
      setIsRunning(false);
      rafRef.current = null;
      return;
    }
    setIsRunning(true);

    for (let i = 0; i < n; i++) {
      nodes[i].vx = 0;
      nodes[i].vy = 0;
    }

    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          dist2 = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(dist2);
        const denom = dist * dist2;
        const force = (repulsionStrength * alpha) / denom;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const e of edges) {
      const si = id2i.get(e.sourceId);
      const ti = id2i.get(e.targetId);
      if (si == null || ti == null) continue;
      const s = nodes[si];
      const t = nodes[ti];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const diff = dist - e.distance;
      const k = e.strength * alpha;
      const fx = (dx / dist) * diff * k;
      const fy = (dy / dist) * diff * k;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    const cx = width / 2;
    const cy = height / 2;
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      nd.vx += (cx - nd.x) * gravityStrength * alpha;
      nd.vy += (cy - nd.y) * gravityStrength * alpha;
    }

    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = a.radius + b.radius + collisionRadiusPadding;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.vx -= ux * overlap * 0.9 * alpha;
          a.vy -= uy * overlap * 0.9 * alpha;
          b.vx += ux * overlap * 0.9 * alpha;
          b.vy += uy * overlap * 0.9 * alpha;
        }
      }
    }

    const damping = 1 - velocityDecay;
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      nd.vx *= damping;
      nd.vy *= damping;
      if (nd.fx != null) {
        nd.x = nd.fx;
      } else {
        nd.x += nd.vx;
        const padding = nd.radius + 8;
        if (nd.x < padding) nd.x = padding;
        if (nd.x > width - padding) nd.x = width - padding;
      }
      if (nd.fy != null) {
        nd.y = nd.fy;
      } else {
        nd.y += nd.vy;
        const padding = nd.radius + 8;
        if (nd.y < padding) nd.y = padding;
        if (nd.y > height - padding) nd.y = height - padding;
      }
    }

    const nextAlpha = Math.max(0.001, alpha - alphaDecay);
    alphaRef.current = nextAlpha;
    // 对渲染层发布不可变快照，避免组件渲染时直接读取可变 ref。
    setFrame((current) => ({
      nodes: nodes.map((node) => ({ ...node })),
      edges,
      tick: current.tick + 1,
      alpha: nextAlpha,
    }));

    if (nextAlpha > 0.002) {
      rafRef.current = requestAnimationFrame(runSimulationFrame);
    } else {
      rafRef.current = null;
      setIsRunning(false);
    }
  }, [
    alphaDecay,
    collisionRadiusPadding,
    gravityStrength,
    height,
    repulsionStrength,
    velocityDecay,
    width,
  ]);

  const reheat = useCallback((alpha = 0.6) => {
    alphaRef.current = Math.max(alphaRef.current, alpha);
    if (rafRef.current == null) {
      setIsRunning(true);
      rafRef.current = requestAnimationFrame(step);
    }
  }, [step]);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const setNodePosition = useCallback((id: string, pos: { x?: number; y?: number; fixed?: boolean }) => {
    const idx = nodeIndexById.current.get(id);
    if (idx == null) return;
    const nd = simNodes.current[idx];
    if (pos.x != null) nd.x = pos.x;
    if (pos.y != null) nd.y = pos.y;
    if (pos.fixed === true) {
      nd.fx = pos.x ?? nd.fx ?? nd.x;
      nd.fy = pos.y ?? nd.fy ?? nd.y;
    } else if (pos.fixed === false) {
      nd.fx = null;
      nd.fy = null;
    }
    setFrame((current) => ({
      nodes: simNodes.current.map((node) => ({ ...node })),
      edges: simEdges.current,
      tick: current.tick + 1,
      alpha: alphaRef.current,
    }));
  }, []);

  useEffect(() => {
    initializeSimulation();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [initializeSimulation, step]);

  return {
    nodes: frame.nodes,
    edges: frame.edges,
    tick: frame.tick,
    isRunning,
    reheat,
    stop,
    setNodePosition,
    alpha: frame.alpha,
  };
}
