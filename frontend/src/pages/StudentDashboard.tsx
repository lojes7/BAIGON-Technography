import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Upload, ClipboardCheck, ArrowRight } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "同学"}`}
        description={t("page.studentDashboard.desc")}
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.studentDashboard.matchRate")} value="72%" sub="↑3% 较上次" trend={{ label: "↑3%", up: true }} />
        <MetricCard title={t("page.studentDashboard.masteredSkills")} value="18 项" sub="+2 本月新增" trend={{ label: "+2", up: true }} />
        <MetricCard title={t("page.studentDashboard.skillGap")} value="5 项" sub="2项 P0 优先" severity="warning" />
        <MetricCard title={t("page.studentDashboard.learningProgress")} value="60%" sub="第 2 阶段进行中" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <Card title={t("page.studentDashboard.quickActions")}>
            <div className="px-4 py-4 flex items-center gap-4">
              <Btn icon={Upload} onClick={() => navigate("/my-resume")}>上传简历</Btn>
              <Btn icon={ClipboardCheck} onClick={() => navigate("/skill-compare")}>开始能力诊断</Btn>
              <Btn icon={ArrowRight} onClick={() => navigate("/learning-path")}>查看学习路径</Btn>
            </div>
          </Card>

          <Card title={t("page.studentDashboard.recentActivity")}>
            <div className="divide-y" style={{ borderColor: T.cloud }}>
              {[
                { date: "07-12", text: '完成"后端开发工程师"能力对比诊断' },
                { date: "07-10", text: "更新简历" },
                { date: "07-05", text: '完成"Spring Boot"课程学习 · 进度 80%' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <span className="font-mono text-[12px] flex-shrink-0" style={{ color: T.info }}>{item.date}</span>
                  <span className="text-[13px]" style={{ color: T.ink }}>{item.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="目标岗位">
          <div className="px-4 py-4 space-y-4">
            <div>
              <div className="text-[14px] font-medium mb-1" style={{ color: T.ink }}>后端开发工程师</div>
              <div className="text-[12px]" style={{ color: T.info }}>软件开发 · 中级</div>
            </div>
            <div className="space-y-2">
              {[
                { label: "必备技能", value: "8 项", color: T.ink },
                { label: "已掌握", value: "5 项", color: T.emerging },
                { label: "待提升", value: "3 项", color: T.risk },
              ].map((s) => (
                <div key={s.label} className="flex justify-between text-[13px]">
                  <span style={{ color: T.info }}>{s.label}</span>
                  <span className="font-mono font-medium" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
            <Btn variant="secondary" size="sm" onClick={() => navigate("/skill-compare")}>
              重新诊断
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
