import { useEffect, useMemo, useRef, useState } from "react";
import T from "../constants/tokens";

const LEVELS: { key: string; label: string; color: string; soft: string }[] = [
  { key: "EXPERT", label: "精通", color: T.emerging, soft: "#E6F5F1" },
  { key: "ADVANCED", label: "熟练", color: T.teal, soft: "#EBF2FA" },
  { key: "FAMILIAR", label: "熟悉", color: T.pending, soft: "#FDF6E3" },
  { key: "BASIC", label: "基础", color: T.info, soft: "#EDE9F4" },
];

const LEVEL_MAP: Record<string, { label: string; color: string; soft: string }> =
  Object.fromEntries(LEVELS.map((level) => [level.key, level]));

// 未知等级回退为「基础」配色，但不改原始文案。
function levelOf(proficiency: string) {
  return LEVEL_MAP[(proficiency || "").toUpperCase()] ?? LEVEL_MAP.BASIC;
}

export interface AbilityItem {
  id?: string;
  name: string;
  proficiency: string; // EXPERT / ADVANCED / FAMILIAR / BASIC
  evidence?: string;
}

export interface RelatedAbilityItem {
  id: string;
  name: string;
}

export interface AbilityRelation {
  parentId: string;
  childId: string;
}

interface RenderNode {
  id: string;
  name: string;
  proficiency: string;
  evidence?: string;
  related: boolean;
  x: number;
  y: number;
  radius: number;
  color: string;
  soft: string;
}

const CX = 320;
const CY = 320;
const CENTER_R = 52;
const NODE_R = 24;
const ORBIT_R = 186;
const TILT = -0.32; // 球面固定倾角（弧度），与能力图谱页一致
const SPIN_SPEED = 0.22; // 自转角速度（rad/s），约 28 秒一圈

function truncate(name: string, max = 4) {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

function positionNodes(nodes: Omit<RenderNode, "x" | "y">[], orbit: number): RenderNode[] {
  return nodes.map((node, index) => {
    // 从顶部开始顺时针均匀分布；内外两环使用不同半径。
    const angle = ((-90 + (index * 360) / Math.max(nodes.length, 1)) * Math.PI) / 180;
    return {
      ...node,
      x: CX + orbit * Math.cos(angle),
      y: CY + orbit * Math.sin(angle),
    };
  });
}

function trimmedLine(from: RenderNode, to: RenderNode) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x1: from.x + (dx / distance) * (from.radius + 2),
    y1: from.y + (dy / distance) * (from.radius + 2),
    x2: to.x - (dx / distance) * (to.radius + 7),
    y2: to.y - (dy / distance) * (to.radius + 7),
  };
}

interface SphereNode {
  item: AbilityItem;
  color: string;
  soft: string;
  /** 球面基础坐标（单位球），Fibonacci 均匀分布 */
  bx: number;
  by: number;
  bz: number;
}

export default function AbilityRadialGraph({
  centerLabel,
  abilities,
  relatedAbilities = [],
  relations = [],
  emptyHint = "暂无能力数据",
}: {
  centerLabel: string;
  abilities: AbilityItem[];
  relatedAbilities?: RelatedAbilityItem[];
  relations?: AbilityRelation[];
  emptyHint?: string;
}) {
  const [selected, setSelected] = useState<AbilityItem | null>(null);
  const [rot, setRot] = useState(0);
  const pausedRef = useRef(false);

  // 自转动画：与能力图谱页同款 rAF 驱动，悬停时暂停
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (!pausedRef.current) setRot((a) => (a + SPIN_SPEED * dt) % (Math.PI * 2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 能力节点：按熟练度排序后 Fibonacci 球面均匀铺开（无两极聚簇）
  const nodes = useMemo<SphereNode[]>(() => {
    const order = LEVELS.map((l) => l.key);
    const sorted = [...abilities].sort(
      (a, b) =>
        order.indexOf((a.proficiency || "").toUpperCase()) -
        order.indexOf((b.proficiency || "").toUpperCase()),
    );
    const n = sorted.length;
    return sorted.map((item, i) => {
      const y = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963; // 黄金角
      const lv = levelOf(item.proficiency);
      return {
        item,
        color: lv.color,
        soft: lv.soft,
        bx: rr * Math.cos(phi),
        by: y,
        bz: rr * Math.sin(phi),
      };
    });
  }, [abilities]);

  if (abilities.length === 0) {
    return (
      <div className="py-10 text-center text-[13px]" style={{ color: T.info }}>
        {emptyHint}
      </div>
    );
  }

  // 每帧投影：绕 Y 轴自转 + 固定 X 倾角，正交投影 + 近大远小
  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  const proj = nodes.map((nd) => {
    const x1 = nd.bx * cosA + nd.bz * sinA;
    const z1 = -nd.bx * sinA + nd.bz * cosA;
    const y1 = nd.by * cosT - z1 * sinT;
    const z2 = nd.by * sinT + z1 * cosT;
    const depth = (z2 + 1) / 2; // 0=背面 1=正面
    const s = 0.78 + 0.3 * depth;
    return {
      nd,
      px: CX + ORBIT_R * x1,
      py: CY + ORBIT_R * y1,
      z: z2,
      s,
      r: NODE_R * s,
      opacity: 0.45 + 0.55 * depth,
    };
  });
  const back = proj.filter((p) => p.z < 0);
  const front = proj.filter((p) => p.z >= 0);

  const innerNodes = positionNodes(directNodes.map(({ id, item }) => {
    const level = levelOf(item.proficiency);
    return {
      id,
      name: item.name,
      proficiency: item.proficiency,
      evidence: item.evidence,
      related: false,
      radius: innerNodeRadius,
      color: level.color,
      soft: level.soft,
    };
  }), innerOrbitRadius);

  const outerNodes = positionNodes(
    relatedAbilities
      .filter((item) => !directIds.has(String(item.id)))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
      .map((item) => ({
        id: String(item.id),
        name: item.name,
        proficiency: "",
        related: true,
        radius: OUTER_NODE_R,
        color: T.info,
        soft: T.cloud,
      })),
    OUTER_ORBIT_R,
  );

  const allNodes = [...innerNodes, ...outerNodes];
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const arrowId = `ability-relation-arrow-${instanceId}`;
  const gradientId = `ability-center-${instanceId}`;
  const renderedRelations = relations.filter((relation, index, source) => (
    relation.parentId !== relation.childId
      && nodeMap.has(String(relation.parentId))
      && nodeMap.has(String(relation.childId))
      && source.findIndex((candidate) => (
        String(candidate.parentId) === String(relation.parentId)
          && String(candidate.childId) === String(relation.childId)
      )) === index
  ));

  const renderNode = (p: (typeof proj)[number], interactive: boolean) => {
    const dim = selNode?.item === p.nd.item;
    return (
      <g
        key={p.nd.item.name + String(interactive)}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onClick={() => setSelected(selected === p.nd.item ? null : p.nd.item)}
        style={{ cursor: "pointer" }}
        opacity={p.opacity}
      >
        <circle cx={p.px} cy={p.py} r={p.r}
          fill={dim ? p.nd.color : p.nd.soft}
          stroke={p.nd.color} strokeWidth={dim ? 2.5 : 1.5} />
        <text x={p.px} y={p.py} textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fontWeight={dim ? 700 : 500}
          fill={dim ? "#fff" : p.nd.color}>
          {truncate(p.nd.item.name)}
        </text>
      </g>
    );
  };

  const renderEdge = (p: (typeof proj)[number]) => {
    const dx = p.px - CX;
    const dy = p.py - CY;
    const dist = Math.hypot(dx, dy) || 1;
    const sx = CX + (dx / dist) * (CENTER_R + 2);
    const sy = CY + (dy / dist) * (CENTER_R + 2);
    // 端点收在节点边缘，避免连线悬空或被节点覆盖
    const tx = p.px - (dx / dist) * p.r;
    const ty = p.py - (dy / dist) * p.r;
    const dim = selNode?.item === p.nd.item;
    return (
      <line key={p.nd.item.name} x1={sx} y1={sy} x2={tx} y2={ty}
        stroke={dim ? p.nd.color : T.border} strokeWidth={dim ? 2 : 1.2}
        opacity={dim ? 0.95 : 0.55 * (0.5 + 0.5 * ((p.z + 1) / 2))} />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <svg
        width="100%" height="auto" viewBox="0 0 640 640" style={{ maxHeight: 460 }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={T.teal} />
            <stop offset="100%" stopColor={T.ink} />
          </radialGradient>
          <marker
            id={arrowId}
            viewBox="0 0 10 6"
            refX="9"
            refY="3"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 3 L 0 6 Z" fill={T.teal} />
          </marker>
        </defs>

        {/* 背面节点 → 背面连线 */}
        {back.map(renderNode)}
        {back.map(renderEdge)}

        {/* 中心节点（恒星位，不随球自转） */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill="url(#ability-center)" />
        <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={600} fill="#F5EFEA">
          {truncate(centerLabel, 6)}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill="rgba(245,239,234,0.85)">
          {nodes.length} 项能力
        </text>

        {/* 正面连线 → 正面节点（层级高于中心，端点贴合节点边缘） */}
        {front.map(renderEdge)}
        {front.map(renderNode)}
      </svg>

      <div className="flex flex-wrap items-center gap-4 px-1">
        {LEVELS.map((level) => (
          <div key={level.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: level.color }} />
            <span className="text-[12px]" style={{ color: T.info }}>{level.label}</span>
          </div>
        ))}
        <span className="ml-auto text-[12px]" style={{ color: T.info }}>
          悬停暂停自转 · 点击节点查看证据
        </span>
      </div>

      {selectedNode && (
        <div className="rounded-lg p-3 text-[12px]" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium" style={{ color: T.ink }}>{selectedNode.name}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{ color: selectedNode.color, background: selectedNode.soft }}
            >
              {selectedNode.related ? "关联技能" : levelOf(selectedNode.proficiency).label}
            </span>
          </div>
          {selectedNode.related ? (
            <div style={{ color: T.info }}>该技能由父子关系引入，不属于岗位的直接技能。</div>
          ) : selectedNode.evidence ? (
            <div className="leading-relaxed" style={{ color: T.info }}>{selectedNode.evidence}</div>
          ) : (
            <div style={{ color: T.info }}>暂无证据</div>
          )}
        </div>
      )}
    </div>
  );
}
