import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, Download, Gauge, ShieldAlert, Star,
  BookOpen, Lightbulb, FileCheck, Target,
} from "lucide-react";
import { PageHeader, Btn } from "../components/ui";

/* 深蓝主色系（与其他改造页一致） */
const P = {
  primary: "#1E4C8F",
  primaryDeep: "#12305E",
  sky: "#A9C8EC",
  skySoft: "#DCE8F6",
  ink: "#16283E",
  muted: "#5E6E82",
  faint: "#8B99AB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  redBg: "#FBEAE7",
  purple: "#7C3AED",
  purpleBg: "#EDE9FE",
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

const HISTORY_REPORTS = [
  { id: "1", job: "后端开发工程师", date: "2026-07-12", match: 72 },
  { id: "2", job: "前端开发工程师", date: "2026-06-28", match: 80 },
  { id: "3", job: "数据分析师", date: "2026-06-15", match: 65 },
];

const GAP_DATA: Record<string, {
  skills: { priority: string; name: string; current: string; required: string; resource: string }[];
  missing: { required: number; bonus: number };
  suggestion: string;
}> = {
  "1": {
    missing: { required: 3, bonus: 2 },
    suggestion: "建议优先补齐容器化与云原生能力（Docker / K8s），这是当前后端开发岗位最普遍的必备要求缺口。分布式系统设计是本岗位的高级要求，建议在容器化基础扎实后再深入学习。",
    skills: [
      { priority: "P0", name: "Docker", current: "无", required: "必备", resource: "阿里云容器课程" },
      { priority: "P0", name: "分布式系统设计", current: "无", required: "必备", resource: "MIT 6.824" },
      { priority: "P0", name: "微服务架构", current: "了解", required: "必备", resource: "Spring Cloud 实战" },
      { priority: "P1", name: "K8s", current: "了解", required: "加分", resource: "K8s 官方文档" },
      { priority: "P1", name: "Redis", current: "掌握", required: "熟练", resource: "Redis 实战" },
    ],
  },
  "2": {
    missing: { required: 2, bonus: 1 },
    suggestion: "前端岗位的核心缺口在 TypeScript 和构建工具，建议优先深入 TypeScript 类型系统，并掌握 Vite 或 Webpack 配置。",
    skills: [
      { priority: "P0", name: "TypeScript", current: "了解", required: "必备", resource: "TS 官方手册" },
      { priority: "P0", name: "Vite", current: "无", required: "必备", resource: "Vite 官方文档" },
      { priority: "P1", name: "Next.js", current: "无", required: "加分", resource: "Next.js 教程" },
    ],
  },
  "3": {
    missing: { required: 2, bonus: 3 },
    suggestion: "数据分析方向的核心差距在 Spark 和可视化工具，建议先掌握 Spark 基础操作，再补充 Tableau 等 BI 工具。",
    skills: [
      { priority: "P0", name: "Spark", current: "无", required: "必备", resource: "Spark 官方文档" },
      { priority: "P0", name: "Hive", current: "了解", required: "必备", resource: "Hive 实战" },
      { priority: "P1", name: "Tableau", current: "无", required: "加分", resource: "Tableau 入门" },
      { priority: "P1", name: "Flink", current: "无", required: "加分", resource: "Flink 教程" },
      { priority: "P1", name: "机器学习", current: "了解", required: "加分", resource: "吴恩达 ML 课程" },
    ],
  },
};

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  P0: { color: P.red, bg: P.redBg, label: "P0 紧急" },
  P1: { color: P.amber, bg: P.amberBg, label: "P1 重要" },
  P2: { color: P.primary, bg: P.skySoft, label: "P2 建议" },
};

function matchColor(match: number) {
  if (match >= 80) return P.green;
  if (match >= 60) return P.amber;
  return P.red;
}

export default function GapReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("1");
  const report = HISTORY_REPORTS.find((r) => r.id === selectedId)!;
  const data = GAP_DATA[selectedId]!;
  const mc = matchColor(report.match);

  const handleExport = () => {
    toast.success("报告已导出", { description: `${report.job} 差距分析报告已下载` });
  };

  const kpiCards = [
    { label: "综合匹配度", value: `${report.match}%`, chip: "对比目标岗位能力基准", icon: Gauge, iconBg: P.skySoft, iconColor: P.primary },
    { label: "必备技能缺口", value: `${data.missing.required} 项`, chip: "P0 级 · 优先补齐", icon: ShieldAlert, iconBg: P.redBg, iconColor: P.red },
    { label: "加分技能缺口", value: `${data.missing.bonus} 项`, chip: "P1 级 · 择机补强", icon: Star, iconBg: P.amberBg, iconColor: P.amber },
    { label: "建议学习资源", value: `${data.skills.length} 个`, chip: "按优先级排序", icon: BookOpen, iconBg: P.greenBg, iconColor: P.green },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.gapReport")]}
        title={t("page.gapReport.title")}
        description={`${report.job} · 诊断时间：${report.date}`}
        actions={
          <div className="flex items-center gap-2">
            <select value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[12.5px] outline-none cursor-pointer whitespace-nowrap"
              style={{ border: `1px solid ${P.border}`, background: "#fff", color: P.ink }}
            >
              {HISTORY_REPORTS.map((r) => (
                <option key={r.id} value={r.id}>{r.job} · {r.date}</option>
              ))}
            </select>
            <Btn variant="secondary" size="sm" icon={Download} onClick={handleExport}>导出报告</Btn>
          </div>
        }
      />

      {/* KPI 统计卡区 */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                <k.icon size={14} style={{ color: k.iconColor }} />
              </span>
            </div>
            <div className="text-[26px] font-mono font-semibold mt-1 leading-tight" style={{ color: k.label === "必备技能缺口" ? P.red : P.ink }}>
              {k.value}
            </div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: P.skySoft, color: P.primary }}>
              {k.chip}
            </span>
          </div>
        ))}
      </div>

      {/* 差距总览：匹配度进度条 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${P.border}` }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: P.skySoft }}>
            <Target size={13} style={{ color: P.primary }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>差距总览</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>你的现有技能与「{report.job}」岗位基准的匹配情况</div>
          </div>
          <span className="font-mono text-[22px] font-semibold" style={{ color: mc }}>{report.match}%</span>
        </div>
        <div className="px-5 py-5">
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${report.match}%`, background: `linear-gradient(90deg, ${P.sky}, ${P.primary})` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: P.faint }}>
            <span>0%</span>
            <span>60% 达标线</span>
            <span>100%</span>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1 rounded-full" style={{ background: P.redBg, color: P.red }}>
              <ShieldAlert size={13} /> 必备技能缺口 <span className="font-mono font-medium">{data.missing.required} 项</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1 rounded-full" style={{ background: P.amberBg, color: P.amber }}>
              <Star size={13} /> 加分技能缺口 <span className="font-mono font-medium">{data.missing.bonus} 项</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1 rounded-full" style={{ background: P.greenBg, color: P.green }}>
              <FileCheck size={13} /> 已具备技能 <span className="font-mono font-medium">{Math.max(0, 10 - data.missing.required - data.missing.bonus)} 项</span>
            </span>
          </div>
        </div>
      </div>

      {/* 差距技能明细表 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.gapReport.missingSkills")}</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>按优先级排序 · P0 为入职硬性要求，建议最先补齐</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["优先级", "技能", "当前水平", "岗位要求", "建议学习资源"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.skills.map((s, i) => {
                const pc = priorityConfig[s.priority] ?? priorityConfig["P2"]!;
                return (
                  <tr key={i} className="hover:bg-[#FAFBFD] transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ color: pc.color, background: pc.bg }}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{s.name}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{s.current}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{s.required}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.primary }}>{s.resource}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI 改进建议 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${P.border}` }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: P.amberBg }}>
            <Lightbulb size={13} style={{ color: P.amber }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.gapReport.improvementSuggestion")}</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>基于差距明细自动生成的针对性建议</div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed" style={{ color: P.ink }}>{data.suggestion}</p>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3">
        <Btn variant="secondary" icon={Download} onClick={handleExport}>导出报告</Btn>
        <Btn icon={ArrowRight} className="whitespace-nowrap" onClick={() => navigate("/learning-path")}>生成学习路径</Btn>
      </div>
    </div>
  );
}
