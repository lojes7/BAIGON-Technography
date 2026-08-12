import { useTranslation } from "react-i18next";
import T from "../constants/tokens";
const exportBatches = [
  { id: "EXP-20260701", range: "2025H2—2026H1", tables: 9, records: "12,486", status: "succeeded", date: "2026-07-01" },
  { id: "EXP-20260615", range: "2025H1—2025H2", tables: 9, records: "8,302", status: "succeeded", date: "2026-06-15" },
  { id: "EXP-20260530", range: "2024H2—2025H2", tables: 9, records: "7,115", status: "succeeded", date: "2026-05-30" },
];
import { PageHeader, Card, StatusBadge } from "../components/ui";

function ExportHistoryPage() {
  const { t } = useTranslation();
  const history = [...exportBatches,
    { id: "EXP-20260501", range: "2024H2—2025H2", tables: 9, records: "6,204", status: "archived", date: "2026-05-01" },
    { id: "EXP-20260315", range: "2024H1—2025H1", tables: 8, records: "4,881", status: "archived", date: "2026-03-15" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.delivery"), t("nav.exportHistory")]} title={t("page.exportHistory.title")} description={t("page.exportHistory.desc")} />
      <Card>
        <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}>
          {["colBatchId","colRange","colTables","colRecords","colDate","colOperator","colStatus","colActions"].map(k => (
            <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(`page.exportHistory.${k}`)}</th>
          ))}</tr></thead>
          <tbody>{history.map((b, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <td className="px-4 py-3 font-mono font-medium text-[12px]" style={{ color: T.ink }}>{b.id}</td>
              <td className="px-4 py-3">{b.range}</td>
              <td className="px-4 py-3 font-mono">{b.tables} 张</td>
              <td className="px-4 py-3 font-mono">{b.records}</td>
              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{b.date}</td>
              <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{t("page.exportHistory.operator")}</td>
              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
              <td className="px-4 py-3"><button className="text-[12px] font-medium" style={{ color: T.teal }}>{t("common.detail")}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}
export default ExportHistoryPage;
