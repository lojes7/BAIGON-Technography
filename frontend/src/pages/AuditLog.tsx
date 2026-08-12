import { useTranslation } from "react-i18next";
import { Search, ChevronDown, Download } from "lucide-react";
import T from "../constants/tokens";
import { auditEntries, actionTypeColors } from "../data";
import { PageHeader, Btn, Card } from "../components/ui";

function AuditLogPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.admin"), t("nav.auditLog")]}
        title={t("page.auditLog.title")}
        description={t("page.auditLog.desc")}
        actions={<Btn variant="secondary" size="sm" icon={Download}>{t("page.auditLog.export")}</Btn>}
      />
      <div className="flex items-center gap-3">
        {[{ label: "用户", value: "全部" }, { label: "操作类型", value: "全部" }, { label: "时间", value: "近7天" }].map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[13px] cursor-pointer"
            style={{ border: `1px solid ${T.border}`, color: T.ink }}>
            <span style={{ color: T.info }}>{f.label}：</span>{f.value}<ChevronDown size={12} style={{ color: T.info }} />
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white max-w-52" style={{ border: `1px solid ${T.border}` }}>
          <Search size={13} style={{ color: T.info }} />
          <input className="bg-transparent text-[13px] flex-1 outline-none" placeholder={t("common.search")} style={{ color: T.ink }} />
        </div>
      </div>
      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["colTime","colUser","colAction","colEntity","colIP","colType"].map(k => (
                <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(`page.auditLog.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((e, i) => {
              const col = actionTypeColors[e.type] ?? T.info;
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{e.time}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0" style={{ background: T.teal }}>{e.user[0]}</div><span style={{ color: T.ink }}>{e.user}</span></div></td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{e.action}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info, maxWidth: 240 }}>{e.entity}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{e.ip}</td>
                  <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ color: col, background: `${col}18` }}>{e.type}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between text-[12px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
          <span>{t("page.auditLog.total", { count: 8, days: 7 })}</span>
          <div className="flex items-center gap-1"><button className="px-2 py-1 rounded hover:bg-gray-100">‹</button><span className="px-2">1 / 1</span><button className="px-2 py-1 rounded hover:bg-gray-100 opacity-40">›</button></div>
        </div>
      </Card>
    </div>
  );
}

export default AuditLogPage;
