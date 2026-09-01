import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";

const pendingQueue = [
  { priority: "P0", type: "技能抽取", content: "后端工程师 · Docker", wait: "3 天", color: T.risk },
  { priority: "P0", type: "岗位分类", content: "AI产品经理 归入产品", wait: "2 天", color: T.risk },
  { priority: "P1", type: "技能关联", content: "数据分析师 · Python", wait: "1 天", color: T.pending },
  { priority: "P2", type: "词典新增", content: '"LLM应用开发" 待审核', wait: "当天", color: T.info },
];

export default function ReviewerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "刘复核员"}`}
        description="AI 数据复核 · 标准词典管理"
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.reviewerDashboard.pendingTasks")} value="47 条" sub="12条逾期" severity="warning" />
        <MetricCard title={t("page.reviewerDashboard.todayComplete")} value="23 条" sub="↑比昨日 +5 条" trend={{ label: "+5", up: true }} />
        <MetricCard title={t("page.reviewerDashboard.dictChanges")} value="5 条" sub="待发布" />
        <MetricCard title={t("page.reviewerDashboard.reviewAccuracy")} value="96%" sub="本月" />
      </div>

      <Card title={t("page.reviewerDashboard.pendingQueue")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: P.sky }}>
              {["优先级", "类型", "内容", "等待时间"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendingQueue.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3">
                  <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                    style={{ color: item.color, background: `${item.color}18` }}>{item.priority}</span>
                </td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.type}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{item.content}</td>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.wait}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-3">
        <Btn icon={ArrowRight} onClick={() => nav("/review-queue")}>进入复核队列 →</Btn>
        <Btn variant="secondary" icon={ArrowRight} onClick={() => nav("/job-dict")}>管理标准词典 →</Btn>
      </div>
    </div>
  );
}
