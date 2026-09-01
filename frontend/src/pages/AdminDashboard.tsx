import { useState } from "react";
import { toast } from "sonner";
import {
  Upload, Activity, ArrowUpRight, RefreshCw, Eye,
  TrendingUp, TrendingDown, BookOpen, Sparkles, Network,
  Target, Cpu, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { useNav } from "../context/NavContext";
import { DEMO_STATS } from "../services/demo-pool";
import { StatusBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

/* ---- 深蓝主色 + 和谐辅助色（确认后沉淀到 tokens.ts） ---- */
const P = {
  primary: "#1E4C8F",      // 深蓝主色
  primaryDeep: "#12305E",  // 深蓝渐变深端
  sky: "#A9C8EC",          // 浅蓝（柱状图底色）
  skySoft: "#DCE8F6",      // 更浅蓝
  ink: "#16283E",          // 标题
  muted: "#5E6E82",        // 正文次级
  faint: "#8B99AB",        // 弱化
  bg: "#F3F6FB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  violet: "#7468CE",
  violetBg: "#ECEAFA",
  teal: "#2E9E9A",
  tealBg: "#E0F2F1",
  border: "#E4EAF2",
} as const;

/* 与数据源 / 数据导入页共用 DEMO_STATS 统计口径（合计恒等于样本总量） */
const trendData = DEMO_STATS.trend;

const signals = [
  { name: "RAG 应用工程", dir: "up", pct: "+8.7%", chip: "热度上升", chipBg: P.greenBg, chipColor: P.green },
  { name: "Agent 编排", dir: "up", pct: "+12.8%", chip: "热度上升", chipBg: P.greenBg, chipColor: P.green },
  { name: "AI 安全治理", dir: "up", pct: "+4.2%", chip: "观察期", chipBg: P.violetBg, chipColor: P.violet },
  { name: "传统图像标注", dir: "down", pct: "-6.1%", chip: "逐步退出", chipBg: P.amberBg, chipColor: P.amber },
  { name: "Hadoop 生态", dir: "down", pct: "-9.4%", chip: "逐步退出", chipBg: P.amberBg, chipColor: P.amber },
];

const quickLinks = [
  { title: "岗位字典", meta: "1,024 个标准岗位", icon: BookOpen, bg: P.primary, target: "job-dict" },
  { title: "技能词典", meta: "162 项标准技能", icon: Sparkles, bg: P.violet, target: "skill-dict" },
  { title: "能力图谱", meta: "3,254 条关系边", icon: Network, bg: P.teal, target: "graph-browser" },
  { title: "Gap 分析", meta: "12 项高需求缺口", icon: Target, bg: P.amber, target: "gap-analysis" },
];

const recentTasks = [
  { id: "#102", name: "AI 抽取任务", desc: "招聘岗位批次 JOB-202608-004", status: "running", pct: 78, target: "job-analysis" },
  { id: "#21", name: "数据导出", desc: "2026-08 全量词典快照", status: "succeeded", pct: 100, target: "export-tasks" },
  { id: "#46", name: "指标重算", desc: "能力覆盖率 · 武汉市", status: "succeeded", pct: 100, target: "evolution-trends" },
  { id: "#101", name: "AI 抽取任务", desc: "招聘岗位批次 JOB-202608-002", status: "partially_succeeded", pct: 100, target: "job-analysis" },
];

const gaugeData = [
  { name: "已响应", value: 31, fill: P.primary },
  { name: "推进中", value: 12, fill: P.sky },
  { name: "未响应", value: 7, fill: P.skySoft },
];
const gaugeTotal = gaugeData.reduce((s, d) => s + d.value, 0);
const gaugePct = Math.round((gaugeData[0].value / gaugeTotal) * 100);

function Pill({ children, onClick, variant = "primary", icon: Icon }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary"; icon?: React.ComponentType<{ size?: number }>;
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full font-medium text-[14px] px-5 py-2.5 cursor-pointer transition-all active:scale-[0.98] ${variant === "primary" ? "text-white hover:opacity-90" : "hover:bg-gray-50"}`}
      style={variant === "primary"
        ? { background: P.primary, boxShadow: "0 8px 16px -6px rgba(30,76,143,0.45)" }
        : { background: "#fff", color: P.ink, border: `1px solid ${P.border}` }}
      onClick={onClick}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function CircleIcon({ color = P.faint, bg = "transparent", border }: { color?: string; bg?: string; border?: string }) {
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: bg, border: border ? `1px solid ${border}` : "none" }}>
      <ArrowUpRight size={14} style={{ color }} />
    </span>
  );
}

function TrendChip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{label}</span>
  );
}

function AdminDashboard() {
  const nav = useNav();
  const [confirmAnalysis, setConfirmAnalysis] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 头部：大标题 + 胶囊按钮 ===== */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>工作台</h1>
          <p className="text-[13px] mt-1" style={{ color: P.muted }}>
            岗位样本 → AI 抽取 → 人工复核 → 词典沉淀 → 培养响应，全链路概览
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Pill variant="secondary" icon={Upload} onClick={() => nav("import-batches")}>新建导入批次</Pill>
          <Pill icon={Activity} onClick={() => setConfirmAnalysis(true)}>启动演进分析</Pill>
        </div>
      </div>
      {confirmAnalysis && (
        <ConfirmDialog
          title="启动演进分析"
          body="将基于最新岗位样本与技能词典重新计算演进信号，任务在后台执行，完成后可在此查看结果。"
          confirmLabel="开始计算"
          onConfirm={() => toast.success("演进分析已启动", { description: "可在「最近任务」中查看进度" })}
          onClose={() => setConfirmAnalysis(false)}
        />
      )}

      {/* ===== KPI 行：1 张特色深蓝卡 + 3 张白卡 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
          style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 148 }}
          onClick={() => nav("jobs")}>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>岗位样本总量</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
              <ArrowUpRight size={14} color="#fff" />
            </span>
          </div>
          <div className="text-[36px] font-mono font-semibold leading-tight mt-1">{DEMO_STATS.total}</div>
          <div className="mt-auto flex items-center gap-2">
            <TrendChip label={`+${DEMO_STATS.todayNew} 今日入库`} bg="rgba(255,255,255,0.16)" color="#fff" />
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>覆盖 {DEMO_STATS.directions} 大技术方向</span>
          </div>
        </div>

        {[
          { title: "标准技能", value: "162", chip: "+11 本月新增", bg: P.greenBg, color: P.green, target: "skill-dict" },
          { title: "待人工复核", value: String(DEMO_STATS.pending), chip: `${DEMO_STATS.pendingHigh} 项高优先级`, bg: P.amberBg, color: P.amber, target: "raw-records", warn: true },
          { title: "已识别演进信号", value: "24", chip: "6 项待专家确认", bg: P.violetBg, color: P.violet, target: "evolution-trends" },
        ].map((k) => (
          <div key={k.title} className="bg-white rounded-2xl p-5 flex flex-col cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ border: `1px solid ${P.border}`, minHeight: 148 }}
            onClick={() => nav(k.target)}>
            <div className="flex items-start justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.title}</span>
              <CircleIcon border={P.border} />
            </div>
            <div className="text-[34px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <div className="mt-auto flex items-center gap-1.5">
              {k.warn && <AlertTriangle size={11} style={{ color: k.color }} />}
              <TrendChip label={k.chip} bg={k.bg} color={k.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ===== 第二行：月度导入趋势（胶囊柱状图） + 复核提醒 ===== */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>岗位样本导入趋势</div>
              <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>近 1 个月 · 单位：条清洗后样本</div>
            </div>
            <button className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors hover:bg-gray-50"
              style={{ color: P.muted, border: `1px solid ${P.border}` }}
              onClick={() => toast.info("数据已是最新")}>
              <RefreshCw size={12} /> 刷新
            </button>
          </div>
          <div className="px-5 pb-4 pt-2">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={trendData} barSize={8}>
                <CartesianGrid strokeDasharray="4 6" stroke={P.skySoft} vertical={false} />
                <XAxis dataKey="dt" tick={{ fontSize: 11, fill: P.faint }} tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.slice(8)} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: P.faint }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12, boxShadow: "0 8px 20px rgba(22,40,62,0.08)" }}
                  cursor={{ fill: P.skySoft, radius: 8 }}
                />
                <Bar dataKey="n" name="岗位样本" radius={[4, 4, 4, 4]}>
                  {trendData.map((d, i) => (
                    <Cell key={i} fill={
                      i === trendData.length - 1 ? P.primary
                        : d.n >= 5 ? "#4A79C2"
                          : P.sky
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}` }}>
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>复核提醒</div>
          <div className="mt-3 text-[20px] font-semibold leading-snug" style={{ color: P.primary }}>
            {DEMO_STATS.pending} 项清洗样本待人工复核
          </div>
          <div className="mt-1.5 text-[13px] flex items-center gap-2" style={{ color: P.muted }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: P.amber }} />
            批次 JOB-202608-004 · 高优先级 {DEMO_STATS.pendingHigh} 项
          </div>
          <div className="mt-2 text-[12px]" style={{ color: P.faint }}>SLA 剩余 2 天 · 超时将自动降级抽样</div>
          <button
            className="mt-auto inline-flex items-center justify-center gap-2 w-full rounded-full text-white text-[14px] font-medium py-2.5 cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: P.primary, boxShadow: "0 8px 16px -6px rgba(30,76,143,0.45)" }}
            onClick={() => nav("raw-records")}>
            <Eye size={15} /> 前往数据源复核
          </button>
        </div>
      </div>

      {/* ===== 第三行：演进信号 + 方案响应仪表盘 + 快捷入口 ===== */}
      <div className="grid grid-cols-12 gap-4">
        {/* 演进信号 */}
        <div className="col-span-5 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>技能演进信号</div>
            <span className="text-[12px] cursor-pointer font-medium" style={{ color: P.primary }} onClick={() => nav("evolution-trends")}>查看全部 →</span>
          </div>
          <div className="divide-y divide-[#E4EAF2]" >
            {signals.map((s) => (
              <div key={s.name} className="flex items-center gap-3 px-5 py-[10px]">
                {s.dir === "up"
                  ? <TrendingUp size={15} style={{ color: P.green }} />
                  : <TrendingDown size={15} style={{ color: P.amber }} />}
                <span className="flex-1 text-[13px] font-medium" style={{ color: P.ink }}>{s.name}</span>
                <TrendChip label={s.chip} bg={s.chipBg} color={s.chipColor} />
                <span className="font-mono text-[12px] w-14 text-right" style={{ color: s.dir === "up" ? P.green : P.amber }}>{s.pct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 方案响应仪表盘 */}
        <div className="col-span-4 bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>培养方案响应</div>
            <span className="text-[12px] cursor-pointer font-medium" style={{ color: P.primary }} onClick={() => nav("gap-analysis")}>Gap 分析 →</span>
          </div>
          <div className="relative flex-1 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData} dataKey="value" innerRadius="72%" outerRadius="100%"
                  startAngle={220} endAngle={-40} cornerRadius={14} paddingAngle={2} stroke="none"
                >
                  {gaugeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4 pointer-events-none">
              <div className="text-[32px] font-mono font-semibold leading-none" style={{ color: P.ink }}>{gaugePct}%</div>
              <div className="text-[11px] mt-1" style={{ color: P.faint }}>高需求能力响应率</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap mt-1">
            {gaugeData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: P.muted }}>
                <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                {d.name} {d.value} 项
              </span>
            ))}
          </div>
          <div className="text-center text-[11px] mt-2 pt-2" style={{ color: P.faint, borderTop: `1px dashed ${P.border}` }}>
            平均方案响应时滞 9.4 个月 · 证据时滞 16.8 个月
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="col-span-3 bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}` }}>
          <div className="text-[15px] font-semibold mb-2" style={{ color: P.ink }}>快捷入口</div>
          <div className="flex flex-col -mx-2">
            {quickLinks.map((q) => (
              <button key={q.title}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={() => nav(q.target)}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: q.bg }}>
                  <q.icon size={16} color="#fff" />
                </span>
                <span className="overflow-hidden">
                  <span className="block text-[13px] font-medium" style={{ color: P.ink }}>{q.title}</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: P.faint }}>{q.meta}</span>
                </span>
                <ArrowUpRight size={14} style={{ color: P.faint, marginLeft: "auto" }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 第四行：最近任务 + AI 引擎深色卡 ===== */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>最近任务</div>
            <span className="text-[12px] cursor-pointer font-medium" style={{ color: P.primary }} onClick={() => nav("job-analysis")}>任务中心 →</span>
          </div>
          <div className="divide-y divide-[#E4EAF2]" >
            {recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => nav(t.target)}>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: P.ink }}>
                    {t.name} <span className="font-mono font-normal" style={{ color: P.faint }}>{t.id}</span>
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: P.muted }}>{t.desc}</div>
                  {t.status === "running" && (
                    <div className="mt-1.5 h-1.5 w-44 rounded-full overflow-hidden" style={{ background: P.skySoft }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${t.pct}%`, background: P.primary }} />
                    </div>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={t.status} />
                  <Eye size={14} style={{ color: P.faint }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI 引擎状态（深色卡） */}
        <div className="col-span-4 rounded-2xl p-5 flex flex-col text-white relative overflow-hidden"
          style={{ background: `linear-gradient(150deg, #16345E 0%, ${P.primaryDeep} 55%, #0C1F3C 100%)`, minHeight: 220 }}>
          <div className="absolute -right-10 -bottom-14 w-44 h-44 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.06)" }} />
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
              <Cpu size={15} /> AI 抽取引擎
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.14)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#5EEAB5" }} />
              运行中
            </span>
          </div>
          <div className="text-[38px] font-mono font-semibold mt-3 leading-none">78<span className="text-[20px] font-normal" style={{ color: "rgba(255,255,255,0.6)" }}>%</span></div>
          <div className="text-[12px] mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
            任务 #102 · 批次 JOB-202607-006 · 已处理 379/486
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.14)" }}>
            <div className="h-full rounded-full" style={{ width: "78%", background: "linear-gradient(90deg,#5B8FD9,#8FB6EA)" }} />
          </div>
          <button className="mt-auto pt-3 text-[12px] font-medium text-left inline-flex items-center gap-1 cursor-pointer"
            style={{ color: "#9DBCE4" }} onClick={() => nav("job-analysis")}>
            查看任务详情 →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
