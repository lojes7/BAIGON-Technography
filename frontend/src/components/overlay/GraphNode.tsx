import T from "../../constants/tokens";
import type { GraphNode as GraphNodeType } from "../../types";

function GraphNode({ node, selected, onClick }: { node: GraphNodeType; selected: boolean; onClick: () => void }) {
  const colors: Record<GraphNodeType["type"], string> = {
    industry: T.ink, family: T.teal, job: "#3E6FA3",
    skill: T.emerging, tool: "#B26A3C",
  };
  const col = colors[node.type];
  const sel = selected;

  if (node.type === "industry") {
    const r = 28;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 - 30) * Math.PI / 180;
      return `${node.x + r * Math.cos(a)},${node.y + r * Math.sin(a)}`;
    }).join(" ");
    return (
      <g onClick={onClick} style={{ cursor: "pointer" }}>
        <polygon points={pts} fill={sel ? col : `${col}15`}
          stroke={col} strokeWidth={sel ? 2 : 1.5} />
        <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fontWeight="500" fill={sel ? "white" : col}>{node.label}</text>
      </g>
    );
  }

  if (node.type === "skill") {
    return (
      <g onClick={onClick} style={{ cursor: "pointer" }}>
        <circle cx={node.x} cy={node.y} r={26} fill={sel ? col : `${col}15`}
          stroke={col} strokeWidth={sel ? 2 : 1.5} />
        <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={9.5} fontWeight={sel ? "600" : "400"} fill={sel ? "white" : col}
          style={{ maxWidth: 48 }}>{node.label.length > 5 ? node.label.slice(0, 5) + "…" : node.label}</text>
      </g>
    );
  }

  const rx = node.type === "tool" ? 3 : node.type === "family" ? 5 : 2;
  const w = node.type === "family" ? 90 : node.type === "tool" ? 60 : 80;
  const h = node.type === "family" ? 28 : node.type === "tool" ? 20 : 26;
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={rx}
        fill={sel ? col : `${col}15`} stroke={col} strokeWidth={sel ? 2 : 1.5} />
      <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={node.type === "tool" ? 9 : 10} fontWeight={sel ? "600" : "400"}
        fill={sel ? "white" : col}>
        {node.label.length > 8 ? node.label.slice(0, 8) + "…" : node.label}
      </text>
    </g>
  );
}

export default GraphNode;
