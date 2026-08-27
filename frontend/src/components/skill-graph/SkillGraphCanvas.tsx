import T from "../../constants/tokens";
import type { SkillGraphData } from "../../types/api";

interface CanvasNode {
  id: string;
  name: string;
  direct: boolean;
  coverage: number;
  x: number;
  y: number;
}

const CANVAS_WIDTH = 960;
const COLUMNS = 6;
const ROW_GAP = 112;
const X_GAP = 150;

function bandPositions(count: number, startY: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: 105 + (index % COLUMNS) * X_GAP,
    y: startY + Math.floor(index / COLUMNS) * ROW_GAP,
  }));
}

function layout(data: SkillGraphData) {
  const directIds = new Set(data.skills.map((skill) => skill.skillId));
  const parentMap = new Map<string, string>();
  data.skills.forEach((skill) => {
    skill.parents.forEach((parent) => {
      if (!directIds.has(parent.id)) parentMap.set(parent.id, parent.name);
    });
  });

  const parentEntries = [...parentMap.entries()].sort((left, right) => left[1].localeCompare(right[1], "zh-CN"));
  const parentPositions = bandPositions(parentEntries.length, 60);
  const parentRows = Math.ceil(parentEntries.length / COLUMNS);
  const directStartY = parentEntries.length === 0 ? 70 : 70 + parentRows * ROW_GAP;
  const directPositions = bandPositions(data.skills.length, directStartY);

  const nodes: CanvasNode[] = [
    ...parentEntries.map(([id, name], index) => ({
      id, name, direct: false, coverage: 0, ...parentPositions[index],
    })),
    ...data.skills.map((skill, index) => ({
      id: skill.skillId,
      name: skill.skillName,
      direct: true,
      coverage: skill.coverage,
      ...directPositions[index],
    })),
  ];
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const edges = data.skills.flatMap((skill) => skill.parents.map((parent) => ({
    from: positions.get(parent.id),
    to: positions.get(skill.skillId),
  }))).filter((edge) => edge.from && edge.to) as { from: CanvasNode; to: CanvasNode }[];

  const directRows = Math.max(1, Math.ceil(data.skills.length / COLUMNS));
  return {
    nodes,
    edges,
    height: Math.max(240, directStartY + directRows * ROW_GAP),
  };
}

function shortName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}…` : name;
}

export default function SkillGraphCanvas({
  data,
  selectedSkillId,
  onSkillSelect,
  addedSkillIds = new Set<string>(),
  removedSkillIds = new Set<string>(),
  maxHeight = 620,
}: {
  data: SkillGraphData;
  selectedSkillId?: string;
  onSkillSelect?: (skillId: string) => void;
  addedSkillIds?: Set<string>;
  removedSkillIds?: Set<string>;
  maxHeight?: number;
}) {
  const graph = layout(data);
  if (data.skills.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-[13px]" style={{ color: T.info }}>
        当前对象与时间范围内暂无直接技能关系
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <svg width={CANVAS_WIDTH} height={graph.height} role="img" aria-label={`${data.scope.name}技能图谱`}>
        <defs>
          <pattern id="skill-graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke={T.cloud} strokeWidth="0.5" />
          </pattern>
          <marker id="skill-graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={T.teal} opacity="0.55" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#skill-graph-grid)" />

        {graph.edges.map((edge, index) => (
          <line
            key={`${edge.from.id}-${edge.to.id}-${index}`}
            x1={edge.from.x}
            y1={edge.from.y + 22}
            x2={edge.to.x}
            y2={edge.to.y - 28}
            stroke={T.teal}
            strokeWidth="1.2"
            opacity="0.45"
            markerEnd="url(#skill-graph-arrow)"
          />
        ))}

        {graph.nodes.map((node) => {
          const added = addedSkillIds.has(node.id);
          const removed = removedSkillIds.has(node.id);
          const selected = selectedSkillId === node.id;
          const stroke = selected ? T.ink : added ? T.emerging : removed ? T.risk : node.direct ? T.stable : T.teal;
          const fill = node.direct ? `${stroke}18` : T.white;
          const radius = node.direct ? 24 + Math.min(1, Math.max(0, node.coverage)) * 8 : 20;
          return (
            <g
              key={node.id}
              role={node.direct ? "button" : undefined}
              tabIndex={node.direct ? 0 : undefined}
              className={node.direct ? "cursor-pointer" : ""}
              onClick={() => node.direct && onSkillSelect?.(node.id)}
              onKeyDown={(event) => {
                if (node.direct && (event.key === "Enter" || event.key === " ")) onSkillSelect?.(node.id);
              }}
            >
              <title>{node.direct ? `${node.name} · 覆盖度 ${(node.coverage * 100).toFixed(1)}%` : `${node.name} · 父技能`}</title>
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected || added || removed ? 3 : 1.5}
                strokeDasharray={node.direct ? undefined : "5 3"}
              />
              <text x={node.x} y={node.y + radius + 17} textAnchor="middle" fontSize="12" fill={T.ink}>
                {shortName(node.name)}
              </text>
              {node.direct && (
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill={stroke} fontFamily="monospace">
                  {(node.coverage * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
