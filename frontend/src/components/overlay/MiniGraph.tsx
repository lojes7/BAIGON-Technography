import T from "../../constants/tokens";
import { miniNodePositions, miniEdges } from "../../data";
import type { GraphNode } from "../../types";

function MiniGraph({
  newIds = [], removedIds = [],
}: { newIds?: string[]; removedIds?: string[] }) {
  const typeColor: Record<GraphNode["type"], string> = {
    industry: T.ink, family: T.teal, job: T.stable, skill: T.emerging, tool: T.declining,
  };
  return (
    <svg width="100%" height="100%" viewBox="0 0 360 325" style={{ minHeight: 220 }}>
      {miniEdges.map(([a, b], i) => {
        const from = miniNodePositions.find(n => n.id === a)!;
        const to = miniNodePositions.find(n => n.id === b)!;
        if (!from || !to) return null;
        const isNew = newIds.includes(a) || newIds.includes(b);
        const isRemoved = removedIds.includes(a) || removedIds.includes(b);
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isNew ? T.emerging : isRemoved ? T.risk : T.teal}
            strokeWidth={isNew ? 1.5 : 1}
            strokeDasharray={isNew ? "none" : "3 2"}
            opacity={isRemoved ? 0.25 : 0.45} />
        );
      })}
      {miniNodePositions.map(node => {
        const col = typeColor[node.type];
        const isNew = newIds.includes(node.id);
        const isRemoved = removedIds.includes(node.id);
        const r = node.type === "skill" ? 16 : node.type === "tool" ? 10 : 14;
        const fill = isNew ? T.emerging : isRemoved ? "#e0e4e7" : `${col}20`;
        const stroke = isNew ? T.emerging : isRemoved ? "#aab5bd" : col;
        const textColor = isNew ? "white" : isRemoved ? "#aab5bd" : col;
        return (
          <g key={node.id} opacity={isRemoved ? 0.45 : 1}>
            <circle cx={node.x} cy={node.y} r={r}
              fill={fill} stroke={stroke} strokeWidth={isNew ? 2 : 1.5} />
            {isNew && (
              <circle cx={node.x + r - 4} cy={node.y - r + 4} r={5}
                fill={T.emerging} stroke="white" strokeWidth={1} />
            )}
            <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={node.type === "tool" ? 7 : 8} fill={textColor} fontWeight={isNew ? "600" : "400"}>
              {node.label.length > 5 ? node.label.slice(0, 5) : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default MiniGraph;
