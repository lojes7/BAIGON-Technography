import { useState } from "react";
import T from "../constants/tokens";

const LEVELS: { key: string; label: string; color: string; soft: string }[] = [
  { key: "EXPERT", label: "精通", color: T.emerging, soft: "#E6F5F1" },
  { key: "ADVANCED", label: "熟练", color: T.teal, soft: "#EBF2FA" },
  { key: "FAMILIAR", label: "熟悉", color: T.pending, soft: "#FDF6E3" },
  { key: "BASIC", label: "基础", color: T.info, soft: "#EDE9F4" },
];

const LEVEL_MAP: Record<string, { label: string; color: string; soft: string }> =
  Object.fromEntries(LEVELS.map((l) => [l.key, l]));

// 未知等级回退为「基础」配色，但不改原始文案
function levelOf(proficiency: string) {
  const upper = (proficiency || "").toUpperCase();
  return LEVEL_MAP[upper] ?? LEVEL_MAP[upper] ?? LEVEL_MAP.BASIC;
}

export interface AbilityItem {
  name: string;
  proficiency: string; // EXPERT / ADVANCED / FAMILIAR / BASIC
  evidence?: string;
}

const CX = 320;
const CY = 320;
const CENTER_R = 52;
const NODE_R = 24;
const ORBIT_R = 186;

function truncate(name: string, max = 4) {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

export default function AbilityRadialGraph({
  centerLabel,
  abilities,
  emptyHint = "暂无能力数据",
}: {
  centerLabel: string;
  abilities: AbilityItem[];
  emptyHint?: string;
}) {
  const [selected, setSelected] = useState<AbilityItem | null>(null);

  if (abilities.length === 0) {
    return (
      <div className="py-10 text-center text-[13px]" style={{ color: T.info }}>
        {emptyHint}
      </div>
    );
  }

  const order = LEVELS.map((l) => l.key);
  const sorted = [...abilities].sort(
    (a, b) =>
      order.indexOf((a.proficiency || "").toUpperCase()) -
      order.indexOf((b.proficiency || "").toUpperCase()),
  );
  const n = sorted.length;
  const nodes = sorted.map((item, i) => {
    // 从顶部（-90°）开始顺时针均匀分布
    const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
    const lv = levelOf(item.proficiency);
    return {
      item,
      x: CX + ORBIT_R * Math.cos(angle),
      y: CY + ORBIT_R * Math.sin(angle),
      color: lv.color,
      soft: lv.soft,
    };
  });

  const selNode = selected ? nodes.find((nd) => nd.item === selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <svg width="100%" height="auto" viewBox="0 0 640 640" style={{ maxHeight: 460 }}>
        <defs>
          <radialGradient id="ability-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={T.teal} />
            <stop offset="100%" stopColor={T.ink} />
          </radialGradient>
        </defs>

        {/* 中心到各能力的连线 */}
        {nodes.map((nd, i) => {
          const dx = nd.x - CX;
          const dy = nd.y - CY;
          const dist = Math.hypot(dx, dy);
          const sx = CX + (dx / dist) * CENTER_R;
          const sy = CY + (dy / dist) * CENTER_R;
          const tx = nd.x - (dx / dist) * NODE_R;
          const ty = nd.y - (dy / dist) * NODE_R;
          const dim = selNode?.item === nd.item;
          return (
            <line key={i} x1={sx} y1={sy} x2={tx} y2={ty}
              stroke={dim ? nd.color : T.border} strokeWidth={dim ? 2 : 1.2}
              opacity={dim ? 0.95 : 0.55} />
          );
        })}

        {/* 中心节点 */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill="url(#ability-center)" />
        <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={600} fill="#F5EFEA">
          {truncate(centerLabel, 6)}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill="rgba(245,239,234,0.85)">
          {n} 项能力
        </text>

        {/* 能力节点 */}
        {nodes.map((nd, i) => {
          const dim = selNode?.item === nd.item;
          return (
            <g key={i} onClick={() => setSelected(selected === nd.item ? null : nd.item)}
              style={{ cursor: "pointer" }}>
              <circle cx={nd.x} cy={nd.y} r={NODE_R}
                fill={dim ? nd.color : nd.soft}
                stroke={nd.color} strokeWidth={dim ? 2.5 : 1.5} />
              <text x={nd.x} y={nd.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fontWeight={dim ? 700 : 500}
                fill={dim ? "#fff" : nd.color}>
                {truncate(nd.item.name)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {LEVELS.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[12px]" style={{ color: T.info }}>{l.label}</span>
          </div>
        ))}
        {selNode && (
          <span className="ml-auto text-[12px]" style={{ color: T.info }}>
            点击节点可查看证据
          </span>
        )}
      </div>

      {/* 选中能力证据 */}
      {selNode && (
        <div className="rounded-lg p-3 text-[12px]" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium" style={{ color: T.ink }}>{selNode.item.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium"
              style={{ color: selNode.color, background: selNode.soft }}>
              {levelOf(selNode.item.proficiency).label}
            </span>
          </div>
          {selNode.item.evidence ? (
            <div className="leading-relaxed" style={{ color: T.info }}>{selNode.item.evidence}</div>
          ) : (
            <div style={{ color: T.info }}>暂无证据</div>
          )}
        </div>
      )}
    </div>
  );
}
