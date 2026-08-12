import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Upload, Users, FileText } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard, StatusBadge } from "../components/ui";

const importHistory = [
  { time: "07-13 14:30", type: "成绩单", file: "计科21级成绩", status: "succeeded" },
  { time: "07-12 10:15", type: "学生", file: "22级新生名单", status: "succeeded" },
  { time: "07-10 16:00", type: "教师", file: "新入职教师", status: "partially_succeeded" },
];

export default function StudentAffairsDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "王老师"}`}
        description="学生工作办公室"
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.studentAffairsDashboard.teacherTotal")} value="12 人" sub="+2 本月" trend={{ label: "+2", up: true }} />
        <MetricCard title={t("page.studentAffairsDashboard.studentTotal2")} value="320 人" sub="+30 本季" trend={{ label: "+30", up: true }} />
        <MetricCard title={t("page.studentAffairsDashboard.monthlyImport")} value="45 条" sub="成绩单" />
        <MetricCard title={t("page.studentAffairsDashboard.pendingItems")} value="3 项" sub="导入异常" severity="warning" />
      </div>

      <Card title={t("page.studentAffairsDashboard.quickActions")}>
        <div className="px-4 py-4 flex items-center gap-4">
          <Btn icon={Upload} onClick={() => nav("/teacher-management")}>导入教师</Btn>
          <Btn icon={Users} onClick={() => nav("/student-management")}>导入学生</Btn>
          <Btn icon={FileText} onClick={() => nav("/grade-import")}>导入成绩单</Btn>
        </div>
      </Card>

      <Card title={t("page.studentAffairsDashboard.recentImports2")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["时间", "类型", "文件名", "状态"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {importHistory.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{r.time}</td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{r.type}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.file}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
