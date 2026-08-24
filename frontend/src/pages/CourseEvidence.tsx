import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle } from "lucide-react";
import T from "../constants/tokens";
import { matrixData, courseNames } from "../data";
import { PageHeader, Card } from "../components/ui";

const evidenceLevels: Record<string, { label: string; color: string; bg: string }> = { H: { label: "实践H", color: T.emerging, bg: `${T.emerging}18` }, M: { label: "教学M", color: T.stable, bg: `${T.stable}18` }, L: { label: "声明L", color: T.pending, bg: `${T.pending}18` }, "": { label: "—", color: T.cloud, bg: "transparent" } };

function CourseEvidencePage() {
  const { t } = useTranslation();
  const [onlyHigh, setOnlyHigh] = useState(false);
  const rows = onlyHigh ? matrixData.filter(r => r.demand === "高") : matrixData;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.curriculum"), t("nav.courseEvidence")]} title={t("page.courseEvidence.title")} description={t("page.courseEvidence.desc")} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: T.ink }} onClick={() => setOnlyHigh(v => !v)}>
          <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{ borderColor: onlyHigh ? T.teal : T.border, background: onlyHigh ? T.teal : "white" }}>{onlyHigh && <CheckCircle size={10} color="white" />}</div>
          {t("page.courseEvidence.onlyHigh")}</label>
      </div>
      <Card>
        <div className="overflow-x-auto"><table className="w-full text-[13px]" style={{ minWidth: 620 }}>
          <thead><tr style={{ background: T.cloud }}>
            <th className="px-4 py-2.5 text-left font-medium text-[12px] w-40" style={{ color: T.info }}>{t("page.courseEvidence.colSkill")}</th>
            <th className="px-4 py-2.5 text-center font-medium text-[12px] w-12" style={{ color: T.info }}>{t("page.courseEvidence.colDemand")}</th>
            {courseNames.map(c => <th key={c} className="px-3 py-2.5 text-center font-medium text-[12px]" style={{ color: T.info }}>{c}</th>)}
            <th className="px-4 py-2.5 text-center font-medium text-[12px]" style={{ color: T.info }}>{t("page.courseEvidence.colQuality")}</th>
          </tr></thead>
          <tbody>{rows.map((row, i) => {
            const filled = row.courses.filter(c => c).length;
            const quality = filled >= 4 ? "高" : filled >= 2 ? "中" : filled === 1 ? "低" : "无";
            const qColor = quality === "高" ? T.emerging : quality === "中" ? T.stable : quality === "低" ? T.pending : T.risk;
            const hasGap = row.demand === "高" && row.courses.filter(c => c === "H" || c === "M").length === 0;
            return (<tr key={i} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}`, background: hasGap ? `${T.risk}05` : "transparent" }}>
              <td className="px-4 py-3"><span className="font-medium" style={{ color: T.ink }}>{row.skill}</span>{hasGap && <AlertTriangle size={12} className="inline ml-1.5" style={{ color: T.risk }} />}</td>
              <td className="px-4 py-3 text-center"><span className="text-[11px]" style={{ color: row.demand === "高" ? T.risk : T.info }}>{row.demand}</span></td>
              {row.courses.map((c, j) => { const ev = evidenceLevels[c] ?? evidenceLevels[""]; return <td key={j} className="px-3 py-3 text-center">{c ? <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer" style={{ color: ev.color, background: ev.bg, border: `1px solid ${ev.color}30` }}>{c}</span> : <span style={{ color: T.cloud }}>—</span>}</td>; })}
              <td className="px-4 py-3 text-center"><span className="text-[12px] font-medium" style={{ color: qColor }}>{quality}</span></td>
            </tr>);
          })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
export default CourseEvidencePage;
