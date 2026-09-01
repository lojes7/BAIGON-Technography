import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import P from "../constants/palette";
import { gapData } from "../data";
import { PageHeader, Card, StatusBadge } from "../components/ui";
import GapDetailDrawer from "../components/overlay/GapDetailDrawer";

function GapAnalysisPage() {
  const { t } = useTranslation();
  const [drawerSkill, setDrawerSkill] = useState<typeof gapData[0] | null>(null);

  const quadrantColors = (x: number, y: number) => {
    if (x >= 50 && y < 50) return P.red;
    if (x >= 50 && y >= 50) return P.green;
    if (x < 50 && y >= 50) return P.muted;
    return P.amber;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.curriculum"), t("nav.gapAnalysis")]}
        title={t("page.gapAnalysis.title")}
        description={t("page.gapAnalysis.desc")}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>高需求低供给</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">12</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>优先改进</span>
        </div>
        {[
          { label: "高需求高供给", value: "31", chip: "良好响应", bg: P.greenBg, color: P.green },
          { label: "证据不足", value: "14", chip: "待补充证据", bg: P.amberBg, color: P.amber },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Scatter plot */}
        <Card title="需求—供给矩阵" className="col-span-2">
          <div className="px-4 pb-4 pt-2 relative">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.skySoft} />
                <XAxis type="number" dataKey="demand" name="需求分" domain={[0, 100]}
                  tick={{ fontSize: 11, fill: P.muted }} tickLine={false} axisLine={false}
                  label={{ value: "需求强度 →", position: "insideBottom", offset: -10, fontSize: 11, fill: P.muted }} />
                <YAxis type="number" dataKey="supply" name="供给分" domain={[0, 100]}
                  tick={{ fontSize: 11, fill: P.muted }} tickLine={false} axisLine={false}
                  label={{ value: "供给强度 →", angle: -90, position: "insideLeft", fontSize: 11, fill: P.muted }} />
                <ZAxis type="number" dataKey="z" range={[30, 150]} />
                <ReferenceLine x={50} stroke={P.border} strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke={P.border} strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 6 }}
                  formatter={(value: unknown, name: unknown) => [String(value ?? ""), name === "demand" ? "需求分" : name === "supply" ? "供给分" : "样本量"]}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white rounded-md p-2.5 shadow text-[12px]"
                        style={{ border: `1px solid ${P.border}` }}>
                        <div className="font-medium mb-1" style={{ color: P.ink }}>{d.name}</div>
                        <div style={{ color: P.muted }}>需求分 <span className="font-mono font-medium" style={{ color: P.ink }}>{d.demand}</span></div>
                        <div style={{ color: P.muted }}>供给分 <span className="font-mono font-medium" style={{ color: P.ink }}>{d.supply}</span></div>
                      </div>
                    );
                  }}
                />
                <Scatter data={gapData} shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const col = quadrantColors(payload.demand, payload.supply);
                  const r = Math.sqrt(payload.z) * 1.2;
                  return (
                    <circle cx={cx} cy={cy} r={r} fill={`${col}40`} stroke={col} strokeWidth={1.5} />
                  );
                }} />
              </ScatterChart>
            </ResponsiveContainer>
            {/* Quadrant labels */}
            <div className="absolute top-6 left-8 text-[10px] font-medium" style={{ color: P.amber }}>
              低优先级
            </div>
            <div className="absolute top-6 right-8 text-[10px] font-medium" style={{ color: P.red }}>
              高缺口 ⚠
            </div>
            <div className="absolute bottom-16 left-8 text-[10px] font-medium" style={{ color: P.muted }}>
              可能冗余
            </div>
            <div className="absolute bottom-16 right-8 text-[10px] font-medium" style={{ color: P.green }}>
              良好匹配
            </div>
          </div>
        </Card>

        {/* Priority list */}
        <Card title="优先改进能力">
          <div className="divide-y divide-[#E4EAF2]" >
            {gapData.filter(d => d.demand >= 60 && d.supply < 50)
              .sort((a, b) => (b.demand - b.supply) - (a.demand - a.supply))
              .map((item, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono font-medium text-white flex-shrink-0"
                      style={{ background: i < 3 ? P.red : P.amber }}>{i + 1}</span>
                    <span className="text-[13px] font-medium" style={{ color: P.ink }}>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] pl-7" style={{ color: P.muted }}>
                    <span>需求 <span className="font-mono font-medium" style={{ color: P.ink }}>{item.demand}</span></span>
                    <span>供给 <span className="font-mono font-medium" style={{ color: P.ink }}>{item.supply}</span></span>
                    <span className="font-mono font-medium" style={{ color: P.red }}>
                      缺口 +{item.demand - item.supply}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Detail table */}
      <Card title="能力明细">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: P.sky }}>
              {["能力", "分类", "需求分", "供给分", "缺口", "证据率", "响应状态", "操作"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gapData.map((row, i) => {
              const gap = row.demand - row.supply;
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ borderTop: `1px solid ${P.border}` }}
                  onClick={() => setDrawerSkill(row)}>
                  <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{row.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{row.cat}</td>
                  <td className="px-4 py-3 font-mono">{row.demand}</td>
                  <td className="px-4 py-3 font-mono">{row.supply}</td>
                  <td className="px-4 py-3 font-mono font-medium" style={{ color: gap > 20 ? P.red : gap > 0 ? P.amber : P.green }}>
                    {gap > 0 ? `+${gap}` : gap}
                  </td>
                  <td className="px-4 py-3 font-mono">{Math.round(70 - Math.abs(gap) * 0.3)}%</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={gap > 30 ? "needs_review" : gap > 0 ? "pending" : "confirmed"} />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button className="text-[12px] font-medium" style={{ color: P.primary }}
                      onClick={() => setDrawerSkill(row)}>详情</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {drawerSkill && <GapDetailDrawer skill={drawerSkill} onClose={() => setDrawerSkill(null)} />}
    </div>
  );
}

export default GapAnalysisPage;
