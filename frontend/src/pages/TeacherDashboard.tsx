import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Users, Eye, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";

const pieData = [
  { name: "后端开发", value: 15, color: T.teal },
  { name: "算法工程", value: 8, color: T.stable },
  { name: "数据工程", value: 5, color: T.emerging },
  { name: "AI应用", value: 7, color: "#B26A3C" },
  { name: "其他", value: 5, color: T.info },
];

const skillGaps = [
  { skill: "Docker", students: 22, gap: "严重" },
  { skill: "K8s", students: 18, gap: "严重" },
  { skill: "分布式系统", students: 15, gap: "严重" },
  { skill: "微服务架构", students: 12, gap: "中等" },
  { skill: "Redis进阶", students: 10, gap: "中等" },
];

const gapColors: Record<string, string> = { 严重: T.risk, 中等: T.pending, 轻微: T.info };

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name?.replace("老师", "") ?? ""}老师`}
        description="所属教研室 · 人工智能技术专业"
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.teacherDashboard.totalStudents")} value="40" sub="+5 本学期新增" trend={{ label: "+5", up: true }} />
        <MetricCard title={t("page.teacherDashboard.avgMatch")} value="68%" sub="↑4% 较上月" trend={{ label: "↑4%", up: true }} />
        <MetricCard title={t("page.teacherDashboard.gapDirections")} value="8 项" sub="3 项严重缺口" severity="critical" />
        <MetricCard title={t("page.teacherDashboard.pendingCourses")} value="4 门" sub="+2 本月新增" severity="warning" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={t("page.teacherDashboard.employmentDist")}>
          <div className="px-4 pb-4 pt-2 flex items-center gap-4">
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-[13px]">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span style={{ color: T.info }}>{d.name}</span>
                  <span className="font-mono font-medium" style={{ color: T.ink }}>{d.value}人</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t("page.teacherDashboard.topSkillGaps")}>
          <div className="divide-y" style={{ borderColor: T.cloud }}>
            {skillGaps.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <span className="w-5 font-mono text-[12px]" style={{ color: T.info }}>{i + 1}</span>
                <span className="flex-1 text-[13px] font-medium" style={{ color: T.ink }}>{s.skill}</span>
                <span className="text-[12px] px-1.5 py-0.5 rounded"
                  style={{ color: gapColors[s.gap], background: `${gapColors[s.gap]}18` }}>
                  {s.gap}
                </span>
                <span className="font-mono text-[12px]" style={{ color: T.info }}>{s.students} 人</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t("page.teacherDashboard.todoItems")}>
        <div className="divide-y" style={{ borderColor: T.cloud }}>
          {[
            { text: "Docker 技能缺口影响 22 名学生，建议优先纳入实训课程", type: "critical" },
            { text: "人工智能专业培养方案覆盖率偏低，3 项高需求技能未覆盖", type: "warning" },
            { text: "毕业生就业方向中后端开发占比最高，建议增加相关课程比重", type: "info" },
            { text: "学生张三匹配度提升至 72%，学习路径进展良好", type: "success" },
          ].map((item, i) => {
            const colors = { critical: T.risk, warning: T.pending, info: T.info, success: T.emerging };
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors[item.type] }} />
                <span className="text-[13px]" style={{ color: T.ink }}>{item.text}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Btn icon={Users} onClick={() => nav("/gap-analysis")}>查看全体学生情况</Btn>
        <Btn variant="secondary" icon={ArrowRight} onClick={() => nav("/programs")}>进入培养响应</Btn>
      </div>
    </div>
  );
}
