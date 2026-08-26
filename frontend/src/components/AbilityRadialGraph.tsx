import { useId, useState } from "react";
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
const RELATION_CENTER_R = 48;
const LEGACY_CENTER_R = 52;
const RELATION_INNER_NODE_R = 23;
const LEGACY_INNER_NODE_R = 24;
const OUTER_NODE_R = 18;
const RELATION_INNER_ORBIT_R = 142;
const LEGACY_INNER_ORBIT_R = 186;
const OUTER_ORBIT_R = 246;

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const instanceId = useId().replace(/:/g, "");
  // 未传入父子关系时保持旧能力图的尺寸和文案，避免影响“我的技能”等复用页面。
  const relationMode = relations.length > 0 || relatedAbilities.length > 0;
  const centerRadius = relationMode ? RELATION_CENTER_R : LEGACY_CENTER_R;
  const innerNodeRadius = relationMode ? RELATION_INNER_NODE_R : LEGACY_INNER_NODE_R;
  const innerOrbitRadius = relationMode ? RELATION_INNER_ORBIT_R : LEGACY_INNER_ORBIT_R;

  if (abilities.length === 0) {
    return (
      <div className="py-10 text-center text-[13px]" style={{ color: T.info }}>
        {emptyHint}
      </div>
    );
  }

  const order = LEVELS.map((level) => level.key);
  const directNodes = abilities
    .map((item, index) => ({
      id: String(item.id ?? `ability-${index}`),
      item,
    }))
    .sort((left, right) => (
      order.indexOf((left.item.proficiency || "").toUpperCase()) -
      order.indexOf((right.item.proficiency || "").toUpperCase())
    ));
  const directIds = new Set(directNodes.map((node) => node.id));

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

  return (
    <div className="flex flex-col gap-3">
      <svg
        width="100%"
        height="auto"
        viewBox="0 0 640 640"
        style={{ maxHeight: relationMode ? 500 : 460 }}
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

        {/* 岗位中心仅连接内环的直接技能。 */}
        {innerNodes.map((node) => {
          const dx = node.x - CX;
          const dy = node.y - CY;
          const distance = Math.hypot(dx, dy) || 1;
          const highlighted = selectedId === node.id;
          return (
            <line
              key={`job-${node.id}`}
              x1={CX + (dx / distance) * centerRadius}
              y1={CY + (dy / distance) * centerRadius}
              x2={node.x - (dx / distance) * node.radius}
              y2={node.y - (dy / distance) * node.radius}
              stroke={highlighted ? node.color : T.border}
              strokeWidth={highlighted ? 2 : 1.1}
              opacity={highlighted ? 0.95 : 0.5}
            />
          );
        })}

        {/* 父技能指向子技能，关系可跨内外环。 */}
        {renderedRelations.map((relation) => {
          const parent = nodeMap.get(String(relation.parentId));
          const child = nodeMap.get(String(relation.childId));
          if (!parent || !child) return null;
          const line = trimmedLine(parent, child);
          const highlighted = selectedId === parent.id || selectedId === child.id;
          return (
            <line
              key={`${parent.id}->${child.id}`}
              {...line}
              stroke={T.teal}
              strokeWidth={highlighted ? 2 : 1.25}
              opacity={highlighted ? 0.95 : 0.58}
              markerEnd={`url(#${arrowId})`}
            />
          );
        })}

        <circle cx={CX} cy={CY} r={centerRadius} fill={`url(#${gradientId})`} />
        <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={600} fill="#F5EFEA">
          {truncate(centerLabel, 6)}
        </text>
        <text
          x={CX}
          y={CY + (relationMode ? 15 : 16)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={relationMode ? 10 : 11}
          fill="rgba(245,239,234,0.85)"
        >
          {innerNodes.length} 项{relationMode ? "直接技能" : "能力"}
        </text>

        {allNodes.map((node) => {
          const selected = selectedId === node.id;
          return (
            <g
              key={node.id}
              onClick={() => setSelectedId(selected ? null : node.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={selected ? node.color : node.soft}
                stroke={node.color}
                strokeWidth={selected ? 2.5 : 1.4}
                strokeDasharray={node.related ? "3,2" : undefined}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={node.related ? 9 : relationMode ? 10 : 11}
                fontWeight={selected ? 700 : 500}
                fill={selected ? "#fff" : node.color}
              >
                {truncate(node.name, node.related ? 3 : 4)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 px-1">
        {LEVELS.map((level) => (
          <div key={level.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: level.color }} />
            <span className="text-[12px]" style={{ color: T.info }}>{level.label}</span>
          </div>
        ))}
        {outerNodes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: T.info }} />
            <span className="text-[12px]" style={{ color: T.info }}>关联技能（外环）</span>
          </div>
        )}
        {renderedRelations.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: T.teal }}>→</span>
            <span className="text-[12px]" style={{ color: T.info }}>父技能指向子技能</span>
          </div>
        )}
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
