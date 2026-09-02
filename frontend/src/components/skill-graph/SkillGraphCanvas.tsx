import T from "../../constants/tokens";
import type { SkillGraphViewData } from "../../types/api";

interface CanvasNode {
  id: string;
  name: string;
  coverage: number;
  x: number;
  y: number;
}

const CANVAS_WIDTH = 960;
const COLUMNS = 6;
const ROW_GAP = 112;
const X_GAP = 150;

function nodePositions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: 105 + (index % COLUMNS) * X_GAP,
    y: 70 + Math.floor(index / COLUMNS) * ROW_GAP,
  }));
}

function layout(data: SkillGraphViewData) {
  const positions = nodePositions(data.skills.length);
  const nodes: CanvasNode[] = data.skills.map((skill, index) => ({
    id: skill.skillId,
    name: skill.skillName,
    coverage: skill.coverage,
    ...positions[index],
  }));
  const rows = Math.max(1, Math.ceil(data.skills.length / COLUMNS));
  return {
    nodes,
    height: Math.max(240, 70 + rows * ROW_GAP),
  };
}

function shortName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}…` : name;
}

export default function SkillGraphCanvas({
  data,
  scopeName,
  selectedSkillId,
  onSkillSelect,
  addedSkillIds = new Set<string>(),
  removedSkillIds = new Set<string>(),
  maxHeight = 620,
}: {
  data: SkillGraphViewData;
  scopeName: string;
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
      <svg width={CANVAS_WIDTH} height={graph.height} role="img" aria-label={`${scopeName}直接技能图谱`}>
        <defs>
          <pattern id="skill-graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke={T.cloud} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#skill-graph-grid)" />

        {graph.nodes.map((node) => {
          const added = addedSkillIds.has(node.id);
          const removed = removedSkillIds.has(node.id);
          const selected = selectedSkillId === node.id;
          const stroke = selected ? T.ink : added ? T.emerging : removed ? T.risk : T.stable;
          const fill = `${stroke}18`;
          const radius = 24 + Math.min(1, Math.max(0, node.coverage)) * 8;
          return (
            <g
              key={node.id}
              role={onSkillSelect ? "button" : undefined}
              tabIndex={onSkillSelect ? 0 : undefined}
              className={onSkillSelect ? "cursor-pointer" : ""}
              onClick={() => onSkillSelect?.(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSkillSelect?.(node.id);
              }}
            >
              <title>{`${node.name} · 覆盖度 ${(node.coverage * 100).toFixed(1)}%`}</title>
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected || added || removed ? 3 : 1.5}
              />
              <text x={node.x} y={node.y + radius + 17} textAnchor="middle" fontSize="12" fill={T.ink}>
                {shortName(node.name)}
              </text>
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill={stroke} fontFamily="monospace">
                {(node.coverage * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
