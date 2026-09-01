import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle } from "lucide-react";
import P from "../constants/palette";
import { matrixData, courseNames } from "../data";
import { PageHeader, Card } from "../components/ui";

const evidenceLevels: Record<string, { label: string; color: string; bg: string }> = { H: { label: "实践H", color: P.green, bg: `${P.green}18` }, M: { label: "教学M", color: P.primary, bg: `${P.primary}18` }, L: { label: "声明L", color: P.amber, bg: `${P.amber}18` }, "": { label: "-", color: P.skySoft, bg: "transparent" } };

function CourseEvidencePage() {
  const { t } = useTranslation();
  const [onlyHigh, setOnlyHigh] = useState(false);
  const rows = onlyHigh ? matrixData.filter(r => r.demand === "高") : matrixData;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.curriculum"), t("nav.courseEvidence")]} title={t("page.courseEvidence.title")} description={t("page.courseEvidence.desc")} />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>高需求技能数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{matrixData.filter((r) => r.demand === "高").length}</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>市场需求旺盛</span>
        </div>
        {[
          { label: "已覆盖", value: matrixData.filter((r) => r.courses.filter((c) => c).length >= 4).length, chip: "证据充分", bg: P.greenBg, color: P.green },
          { label: "未覆盖", value: matrixData.filter((r) => r.courses.filter((c) => c).length === 0).length, chip: "需新增课程", bg: P.redBg, color: P.red },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: P.ink }} onClick={() => setOnlyHigh(v => !v)}>
          <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{ borderColor: onlyHigh ? P.primary : P.border, background: onlyHigh ? P.primary : "white" }}>{onlyHigh && <CheckCircle size={10} color="white" />}</div>
          {t("page.courseEvidence.onlyHigh")}</label>
      </div>
      <Card>
        <div className="overflow-x-auto"><table className="w-full text-[13px]" style={{ minWidth: 620 }}>
          <thead><tr style={{ background: P.sky }}>
            <th className="px-4 py-2.5 text-left font-medium text-[12px] w-40" style={{ color: P.primaryDeep }}>{t("page.courseEvidence.colSkill")}</th>
            <th className="px-4 py-2.5 text-center font-medium text-[12px] w-12" style={{ color: P.primaryDeep }}>{t("page.courseEvidence.colDemand")}</th>
            {courseNames.map(c => <th key={c} className="px-3 py-2.5 text-center font-medium text-[12px]" style={{ color: P.primaryDeep }}>{c}</th>)}
            <th className="px-4 py-2.5 text-center font-medium text-[12px]" style={{ color: P.primaryDeep }}>{t("page.courseEvidence.colQuality")}</th>
          </tr></thead>
          <tbody>{rows.map((row, i) => {
            const filled = row.courses.filter(c => c).length;
            const quality = filled >= 4 ? "高" : filled >= 2 ? "中" : filled === 1 ? "低" : "无";
            const qColor = quality === "高" ? P.green : quality === "中" ? P.primary : quality === "低" ? P.amber : P.red;
            const hasGap = row.demand === "高" && row.courses.filter(c => c === "H" || c === "M").length === 0;
            return (<tr key={i} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${P.border}`, background: hasGap ? `${P.red}05` : "transparent" }}>
              <td className="px-4 py-3"><span className="font-medium" style={{ color: P.ink }}>{row.skill}</span>{hasGap && <AlertTriangle size={12} className="inline ml-1.5" style={{ color: P.red }} />}</td>
              <td className="px-4 py-3 text-center"><span className="text-[11px]" style={{ color: row.demand === "高" ? P.red : P.muted }}>{row.demand}</span></td>
              {row.courses.map((c, j) => { const ev = evidenceLevels[c] ?? evidenceLevels[""]; return <td key={j} className="px-3 py-3 text-center">{c ? <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer" style={{ color: ev.color, background: ev.bg, border: `1px solid ${ev.color}30` }}>{c}</span> : <span style={{ color: P.skySoft }}>-</span>}</td>; })}
              <td className="px-4 py-3 text-center"><span className="text-[12px] font-medium" style={{ color: qColor }}>{quality}</span></td>
            </tr>);
          })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
export default CourseEvidencePage;
