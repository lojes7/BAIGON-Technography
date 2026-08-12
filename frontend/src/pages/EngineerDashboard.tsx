import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Upload, PackageOpen } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard, StatusBadge } from "../components/ui";

const recentImports = [
  { time: "07-13 14:30", source: "猎聘", count: 320, status: "succeeded" },
  { time: "07-12 10:15", source: "前程无忧", count: 185, status: "partially_succeeded" },
  { time: "07-11 09:00", source: "BOSS直聘", count: 256, status: "succeeded" },
];

const recentExports = [
  { time: "07-13 16:00", name: "常州市·后端岗位", format: "Excel", status: "succeeded" },
  { time: "07-10 11:30", name: "南京市·全岗位图谱", format: "CSV", status: "succeeded" },
];

export default function EngineerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "张工程师"}`}
        description="数据获取 · 数据交付"
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.engineerDashboard.totalSources")} value="8" sub="2个活跃" />
        <MetricCard title={t("page.engineerDashboard.monthlyImports")} value="1,247条" sub="+320 本周" trend={{ label: "+320", up: true }} />
        <MetricCard title={t("page.engineerDashboard.pendingExports")} value="3 个" sub="CSV/Excel" />
        <MetricCard title={t("page.engineerDashboard.dataHealth")} value="良好" sub="98%入库成功率" />
      </div>

      <Card title={t("page.engineerDashboard.quickActions")}>
        <div className="px-4 py-4 flex items-center gap-4">
          <Btn icon={Upload} onClick={() => nav("/import-batches")}>导入新数据</Btn>
          <Btn icon={PackageOpen} onClick={() => nav("/export-tasks")}>创建导出任务</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title={t("page.engineerDashboard.recentImportBatches")}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["时间", "数据源", "导入数量", "状态"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentImports.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{r.time}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{r.source}</td>
                  <td className="px-4 py-3 font-mono">{r.count} 条</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={t("page.engineerDashboard.recentExportRecords")}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["时间", "导出内容", "格式", "状态"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentExports.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{r.time}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{r.format}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
