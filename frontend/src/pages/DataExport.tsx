import { useTranslation } from "react-i18next";
import { Plus, CheckCircle, AlertTriangle } from "lucide-react";
import T from "../constants/tokens";
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.delivery"), t("nav.dataExport")]}
        title={t("page.dataExport.title")}
        description={t("page.dataExport.desc")}
        actions={<Btn icon={Plus}>{t("page.dataExport.createBatch")}</Btn>}
      />

      <Card title={t("page.dataExport.exportBatches")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["colBatchId","colRange","colTables","colRecords","colDate","colStatus","colActions"].map(k => (
                <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(`page.dataExport.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportBatches.map((b, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-mono font-medium" style={{ color: T.ink }}>{b.id}</td>
                <td className="px-4 py-3">{b.range}</td>
                <td className="px-4 py-3 font-mono">{b.tables} 张</td>
                <td className="px-4 py-3 font-mono">{b.records}</td>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{b.date}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <button className="text-[12px] font-medium" style={{ color: T.teal }}>{t("common.view")}</button>
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
                {c.ok ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.emerging }} />
                  : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.pending }} />}
                <span className="text-[13px]" style={{ color: c.ok ? T.ink : T.pending }}>{c.msg}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("page.dataExport.tableList")}>
          <div className="px-4 py-3">
            <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: T.info }}>{t("page.dataExport.tableListDesc", { tables: 9 })}</div>
            <div className="space-y-1.5 mt-2">
              {tables.map(([id, name, rows], i) => (
                <div key={i} className="flex items-center gap-3 text-[12px] py-1" style={{ borderBottom: i < 8 ? `1px solid ${T.cloud}` : "none" }}>
                  <span className="font-mono w-36 flex-shrink-0" style={{ color: T.teal }}>{id}</span>
                  <span className="flex-1" style={{ color: T.ink }}>{name}</span>
                  <span className="font-mono" style={{ color: T.info }}>{rows}</span>
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
