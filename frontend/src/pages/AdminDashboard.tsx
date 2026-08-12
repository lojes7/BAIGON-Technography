import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Upload, Activity, RefreshCw, AlertTriangle, Info,
  TrendingUp, TrendingDown, Eye, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import T from "../constants/tokens";
import { useNav } from "../context/NavContext";
import { coverageData } from "../data";
import { PageHeader, Btn, Card, MetricCard, StatusBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

function AdminDashboard() {
  const { t } = useTranslation();
  const nav = useNav();
  const [confirmAnalysis, setConfirmAnalysis] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("page.adminDashboard.title")]}
        title={t("page.adminDashboard.title")}
        updated="2026-07-01"
        actions={
          <>
            <Btn variant="secondary" icon={Upload} onClick={() => nav("import-batches")}>{t("page.adminDashboard.newImport")}</Btn>
            <Btn icon={Activity} onClick={() => setConfirmAnalysis(true)}>{t("page.adminDashboard.runAnalysis")}</Btn>
          </>
        }
      />
      {confirmAnalysis && (
        <ConfirmDialog
          title={t("page.adminDashboard.runEvoTitle")}
          body={t("page.adminDashboard.runEvoBody")}
          confirmLabel={t("page.adminDashboard.startRun")}
          onConfirm={() => toast.success(t("msg.analysisStarted"), { description: t("msg.analysisStartedDesc") })}
          onClose={() => setConfirmAnalysis(false)}
        />
      )}

      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t("page.adminDashboard.jobSamples")} value="486" sub="+52 本月新增" trend={{ label: "本月 +52", up: true }} />
        <MetricCard title={t("page.adminDashboard.standardSkills")} value="162" sub="+11 本月新增" trend={{ label: "本月 +11", up: true }} />
        <MetricCard title={t("page.adminDashboard.pendingReview")} value="37" sub="9 项高优先级" severity="warning" />
        <MetricCard title={t("page.adminDashboard.identifiedEvo")} value="24" sub="6 项待专家确认" severity="warning" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title={t("page.adminDashboard.monthlyDist")} className="col-span-3" action={
          <Btn variant="ghost" size="sm" icon={RefreshCw}>{t("page.adminDashboard.refresh")}</Btn>
        }>
          <div className="px-4 pb-4 pt-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={coverageData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cloud} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 6 }}
                  cursor={{ fill: T.cloud }}
                />
                <Bar dataKey="n" name="岗位数" radius={[2, 2, 0, 0]}>
                  {coverageData.map((_, i) => (
                    <Cell key={i} fill={i === coverageData.length - 1 ? T.teal : `${T.teal}60`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t("page.adminDashboard.todos")} className="col-span-2" action={
          <span className="text-[12px] font-mono font-medium px-2 py-0.5 rounded"
            style={{ background: "#FDF6E3", color: T.pending }}>3 项</span>
        }>
          <div className="divide-y" style={{ borderColor: T.cloud }}>
            {[
              { text: "37 项AI结果待人工复核", type: "warning", action: "前往复核", target: "review-queue" },
              { text: "2 个导入批次存在重复数据", type: "warning", action: "查看批次", target: "import-batches" },
              { text: "培养方案缺少考核证据（7项能力）", type: "info", action: "查看证据", target: "course-evidence" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => nav(item.target)}>
                <div className="mt-0.5 flex-shrink-0">
                  {item.type === "warning"
                    ? <AlertTriangle size={14} style={{ color: T.pending }} />
                    : <Info size={14} style={{ color: T.info }} />}
                </div>
                <div className="flex-1 text-[13px]" style={{ color: T.ink }}>{item.text}</div>
                <button className="text-[12px] flex-shrink-0 font-medium" style={{ color: T.teal }}>
                  {item.action} →
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title={t("page.adminDashboard.signalChanges")} className="col-span-2">
          <div className="divide-y" style={{ borderColor: T.cloud }}>
            {[
              { name: "RAG应用工程", dir: "up", pct: "+8.7%", period: "2026H1", conf: "高" },
              { name: "Agent编排", dir: "up", pct: "+12.8%", period: "2026H1", conf: "高" },
              { name: "AI安全治理", dir: "up", pct: "+4.2%", period: "2026H1", conf: "中" },
              { name: "传统图像标注", dir: "down", pct: "-6.1%", period: "2026H1", conf: "中" },
              { name: "Hadoop生态", dir: "down", pct: "-9.4%", period: "2026H1", conf: "高" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-shrink-0">
                  {s.dir === "up"
                    ? <TrendingUp size={14} style={{ color: T.emerging }} />
                    : <TrendingDown size={14} style={{ color: T.declining }} />}
                </div>
                <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{s.name}</span>
                <span className="font-mono text-[12px]"
                  style={{ color: s.dir === "up" ? T.emerging : T.declining }}>
                  {s.pct}
                </span>
                <span className="text-[11px] font-mono" style={{ color: T.info }}>{s.period}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("page.adminDashboard.recentTasks")} className="col-span-3">
          <div className="divide-y" style={{ borderColor: T.cloud }}>
            {[
              { id: "#102", name: "AI抽取任务", desc: "招聘岗位批次 JOB-202607-006", status: "running", pct: 78 },
              { id: "#21", name: "数据导出", desc: "2025H1—2026H1", status: "succeeded", pct: 100, target: "export-tasks" },
              { id: "#46", name: "指标重算", desc: "能力覆盖率 · 常州市", status: "succeeded", pct: 100, target: "evolution-trends" },
              { id: "#101", name: "AI抽取任务", desc: "招聘岗位批次 JOB-202606-015", status: "partially_succeeded", pct: 100, target: "extraction-tasks" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => t.target && nav(t.target)}>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: T.ink }}>
                    {t.name} <span className="font-mono font-normal" style={{ color: T.info }}>{t.id}</span>
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: T.info }}>{t.desc}</div>
                  {t.status === "running" && (
                    <div className="mt-1.5 h-1 w-40 rounded-full overflow-hidden" style={{ background: T.cloud }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${t.pct}%`, background: T.teal }} />
                    </div>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <Eye size={14} style={{ color: T.info }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 py-3 flex items-center gap-8">
          <div>
            <div className="text-[13px] font-medium mb-3" style={{ color: T.ink }}>培养响应概览</div>
            <div className="flex items-center gap-6 flex-wrap">
              {[
                { label: "高需求低供给", value: "12 项", color: T.risk },
                { label: "高需求高供给", value: "31 项", color: T.emerging },
                { label: "低需求高供给", value: "9 项", color: T.info },
                { label: "未响应能力", value: "7 项", color: T.declining },
                { label: "平均方案响应时滞", value: "9.4 个月", color: T.pending },
                { label: "平均证据响应时滞", value: "16.8 个月", color: T.declining },
              ].map((item, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="text-[18px] font-mono font-medium" style={{ color: item.color }}>{item.value}</span>
                  <span className="text-[12px]" style={{ color: T.info }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <Btn variant="secondary" size="sm" icon={ArrowRight} onClick={() => nav("gap-analysis")}>{t("page.adminDashboard.viewGap")}</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default AdminDashboard;
