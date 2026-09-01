import { useTranslation } from "react-i18next";
import { Plus, CheckCircle, AlertTriangle } from "lucide-react";
import P from "../constants/palette";
const exportBatches = [
  { id: "EXP-20260701", range: "2025H2—2026H1", tables: 9, records: "12,486", status: "succeeded", date: "2026-07-01" },
  { id: "EXP-20260615", range: "2025H1—2025H2", tables: 9, records: "8,302", status: "succeeded", date: "2026-06-15" },
  { id: "EXP-20260530", range: "2024H2—2025H2", tables: 9, records: "7,115", status: "succeeded", date: "2026-05-30" },
];
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";

function DataExportPage() {
  const { t } = useTranslation();
  const qualityChecks = [
    { ok: true, msg: "主键唯一性验证通过（12,486 条）" },
    { ok: true, msg: "维度编码完整，无空值" },
    { ok: false, msg: "14 条能力关系未完成人工复核，已从导出范围中排除", warn: true },
    { ok: true, msg: "指标字段格式验证通过" },
    { ok: true, msg: "能力覆盖率指标与源数据一致" },
    { ok: false, msg: "3 个演化事件置信度低于阈值，已标注", warn: true },
  ];

  const tables = [
    ["dim_skill", "能力维度表", "162 行"],
    ["dim_job", "岗位维度表", "486 行"],
    ["dim_program", "专业方案表", "12 行"],
    ["dim_course", "课程维度表", "62 行"],
    ["fact_skill_demand", "能力需求事实", "2,847 行"],
    ["fact_skill_supply", "能力供给事实", "1,934 行"],
    ["fact_skill_gap", "供需缺口事实", "168 行"],
    ["fact_response_lag", "响应时滞事实", "78 行"],
    ["fact_evolution", "演化事件事实", "48 行"],
  ];

  const dimensionTables = tables.filter(([id]) => String(id).startsWith("dim_")).length;
  const factTables = tables.filter(([id]) => String(id).startsWith("fact_")).length;
  const warnCount = qualityChecks.filter((c) => !c.ok).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.delivery"), t("nav.dataExport")]}
        title={t("page.dataExport.title")}
        description={t("page.dataExport.desc")}
        actions={<Btn icon={Plus}>{t("page.dataExport.createBatch")}</Btn>}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>导出批次数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{exportBatches.length}</div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>全量历史</span>
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>维度表 {dimensionTables}</span>
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>事实表 {factTables}</span>
          </div>
        </div>
        {[
          { label: "校验警告数", value: warnCount, chip: "需关注", bg: P.amberBg, color: P.amber },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      <Card title={t("page.dataExport.exportBatches")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: P.sky }}>
              {["colBatchId","colRange","colTables","colRecords","colDate","colStatus","colActions"].map(k => (
                <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{t(`page.dataExport.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportBatches.map((b, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                <td className="px-4 py-3 font-mono font-medium" style={{ color: P.ink }}>{b.id}</td>
                <td className="px-4 py-3">{b.range}</td>
                <td className="px-4 py-3 font-mono">{b.tables} 张</td>
                <td className="px-4 py-3 font-mono">{b.records}</td>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: P.muted }}>{b.date}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <button className="text-[12px] font-medium" style={{ color: P.primary }}>{t("common.view")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title={t("page.dataExport.qualityCheck")}>
          <div className="px-4 py-3 flex flex-col gap-2">
            {qualityChecks.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                {c.ok ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: P.green }} />
                  : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: P.amber }} />}
                <span className="text-[13px]" style={{ color: c.ok ? P.ink : P.amber }}>{c.msg}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("page.dataExport.tableList")}>
          <div className="px-4 py-3">
            <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: P.muted }}>{t("page.dataExport.tableListDesc", { tables: 9 })}</div>
            <div className="space-y-1.5 mt-2">
              {tables.map(([id, name, rows], i) => (
                <div key={i} className="flex items-center gap-3 text-[12px] py-1" style={{ borderBottom: i < 8 ? `1px solid ${P.border}` : "none" }}>
                  <span className="font-mono w-36 flex-shrink-0" style={{ color: P.primary }}>{id}</span>
                  <span className="flex-1" style={{ color: P.ink }}>{name}</span>
                  <span className="font-mono" style={{ color: P.muted }}>{rows}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default DataExportPage;
