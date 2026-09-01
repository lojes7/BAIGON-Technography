import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import P from "../constants/palette";
import { lagSkills } from "../data";
import { PageHeader, Btn, Card } from "../components/ui";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";

function ResponseLagPage() {
  const { t } = useTranslation();
  const [evidenceSkill, setEvidenceSkill] = useState<string | null>(null);
  const minDate = new Date("2024-03-01").getTime();
  const maxDate = new Date("2026-06-01").getTime();
  const totalMs = maxDate - minDate;

  const dateToX = (dateStr: string | null, width = 520) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + "-01").getTime();
    return ((d - minDate) / totalMs) * width;
  };

  const months = [
    "2024-03", "2024-06", "2024-09", "2024-12",
    "2025-03", "2025-06", "2025-09", "2025-12",
    "2026-03", "2026-06",
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.curriculum"), t("nav.responseLag")]}
        title={t("page.responseLag.title")}
        description="能力需求信号与培养方案、课程证据的时间差分析"
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>平均方案响应时滞</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">9.4 个月</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>需求信号 → 方案更新</span>
        </div>
        {[
          { label: "平均证据响应时滞", value: "16.8 个月", chip: "需加速", bg: P.redBg, color: P.red },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      <Card title="响应时滞时间轴">
        <div className="px-6 py-5">
          {/* Timeline axis */}
          <div className="mb-6">
            <svg width="100%" height="24" viewBox="0 0 560 24">
              <line x1="20" y1="12" x2="540" y2="12" stroke={P.border} strokeWidth="1" />
              {months.map((m, i) => {
                const x = (dateToX(m) ?? 0) + 20;
                return (
                  <g key={i}>
                    <line x1={x} y1="8" x2={x} y2="16" stroke={P.border} strokeWidth="1" />
                    <text x={x} y="22" textAnchor="middle" fontSize="9" fill={P.muted}>{m.slice(2)}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Skill timelines */}
          <div className="space-y-6">
            {lagSkills.map((skill, i) => {
              const sx = (dateToX(skill.signal) ?? 0) + 20;
              const px = skill.plan ? (dateToX(skill.plan) ?? 0) + 20 : null;
              const ex = skill.evidence ? (dateToX(skill.evidence) ?? 0) + 20 : null;

              return (
                <div key={i}>
                  <div className="text-[13px] font-medium mb-2" style={{ color: P.ink }}>{skill.name}</div>
                  <svg width="100%" height="36" viewBox="0 0 560 36">
                    <line x1="20" y1="14" x2="540" y2="14" stroke={P.skySoft} strokeWidth="1" />
                    {px && <line x1={sx} y1="14" x2={px} y2="14" stroke={P.primary} strokeWidth="1.5" />}
                    {px && ex && <line x1={px} y1="14" x2={ex} y2="14" stroke={P.primary} strokeWidth="1.5" />}
                    {!px && <line x1={sx} y1="14" x2="540" y2="14" stroke="#cdd5db" strokeWidth="1" strokeDasharray="4 3" />}
                    {px && !ex && <line x1={px} y1="14" x2="540" y2="14" stroke="#cdd5db" strokeWidth="1" strokeDasharray="4 3" />}

                    <circle cx={sx} cy="14" r="5" fill={P.ink} />
                    <text x={sx} y="30" textAnchor="middle" fontSize="9" fill={P.muted}>{skill.signal}</text>
                    <text x={sx} y="8" textAnchor="middle" fontSize="8" fill={P.muted}>需求</text>

                    {px ? (
                      <>
                        <circle cx={px} cy="14" r="5" fill={P.primary} />
                        <text x={px} y="30" textAnchor="middle" fontSize="9" fill={P.muted}>{skill.plan}</text>
                        <text x={px} y="8" textAnchor="middle" fontSize="8" fill={P.muted}>方案</text>
                      </>
                    ) : (
                      <text x="420" y="14" fontSize="9" fill={P.red} dominantBaseline="middle">方案未响应</text>
                    )}

                    {ex ? (
                      <>
                        <circle cx={ex} cy="14" r="5" fill={P.green} />
                        <text x={ex} y="30" textAnchor="middle" fontSize="9" fill={P.muted}>{skill.evidence}</text>
                        <text x={ex} y="8" textAnchor="middle" fontSize="8" fill={P.muted}>证据</text>
                      </>
                    ) : px ? (
                      <text x="500" y="14" fontSize="9" fill={P.amber} dominantBaseline="middle">证据待补充</text>
                    ) : null}

                    {skill.months && (
                      <text x="540" y="14" textAnchor="end" fontSize="10" fill={P.amber}
                        dominantBaseline="middle" fontFamily="'JetBrains Mono', monospace">
                        {skill.months}个月
                      </text>
                    )}
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-6 text-[11px]" style={{ color: P.muted }}>
            {([
              { color: P.ink, label: "需求信号出现", hollow: false },
              { color: P.primary, label: "方案已响应", hollow: false },
              { color: P.green, label: "考核证据存在", hollow: false },
              { color: P.muted, label: "未响应", hollow: true },
            ] as { color: string; label: string; hollow: boolean }[]).map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="4"
                    fill={l.hollow ? "none" : l.color}
                    stroke={l.color} strokeWidth={l.hollow ? 1.5 : 0} />
                </svg>
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Unresponsive list */}
      <Card title="未响应能力清单">
        <div className="divide-y divide-[#E4EAF2]" >
          {lagSkills.filter(s => !s.plan).map((skill, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <AlertCircle size={14} style={{ color: P.red, flexShrink: 0 }} />
              <div className="flex-1">
                <div className="text-[13px] font-medium" style={{ color: P.ink }}>{skill.name}</div>
                <div className="text-[12px] mt-0.5" style={{ color: P.muted }}>
                  需求信号 {skill.signal} · 至今未见方案响应
                </div>
              </div>
              <Btn variant="secondary" size="sm" onClick={() => setEvidenceSkill(skill.name)}>查看证据</Btn>
            </div>
          ))}
        </div>
      </Card>
      {evidenceSkill && (
        <EvidenceDrawer
          title={evidenceSkill}
          subtitle="需求信号来源证据"
          onClose={() => setEvidenceSkill(null)}
        />
      )}
    </div>
  );
}

export default ResponseLagPage;
