import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Download } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card } from "../components/ui";

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

const priorityConfig: Record<string, { color: string; label: string }> = {
  P0: { color: T.risk, label: "P0 紧急" },
  P1: { color: T.pending, label: "P1 重要" },
  P2: { color: T.info, label: "P2 建议" },
};

export default function GapReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("1");
  const report = HISTORY_REPORTS.find((r) => r.id === selectedId)!;
  const data = GAP_DATA[selectedId]!;

  const handleExport = () => {
    toast.success("报告已导出", { description: `${report.job} 差距分析报告已下载` });
  };

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
              className="px-2.5 py-1.5 rounded-md text-[12px] outline-none cursor-pointer"
              style={{ border: `1px solid ${T.border}`, background: T.white, color: T.ink }}
            >
              {HISTORY_REPORTS.map((r) => (
                <option key={r.id} value={r.id}>{r.job} · {r.date}</option>
              ))}
            </select>
            <Btn variant="secondary" size="sm" icon={Download} onClick={handleExport}>导出报告</Btn>
          </div>
        }
      />

      <Card>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-medium" style={{ color: T.ink }}>差距总览</span>
            <span className="font-mono text-[20px] font-medium" style={{ color: T.teal }}>匹配度 {report.match}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: T.cloud }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${report.match}%`, background: T.teal }} />
          </div>
          <div className="flex items-center gap-6 text-[13px]">
            <span style={{ color: T.info }}>
              必备技能缺口：<span className="font-mono font-medium" style={{ color: T.risk }}>{data.missing.required} 项</span>
            </span>
            <span style={{ color: T.info }}>
              加分技能缺口：<span className="font-mono font-medium" style={{ color: T.pending }}>{data.missing.bonus} 项</span>
            </span>
          </div>
        </div>
      </Card>

      <Card title={t("page.gapReport.missingSkills")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["优先级", "技能", "当前水平", "岗位要求", "建议学习资源"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.skills.map((s, i) => {
              const pc = priorityConfig[s.priority];
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3">
                    <span className="text-[12px] px-2 py-0.5 rounded font-medium" style={{ color: pc.color, background: `${pc.color}18` }}>{pc.label}</span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{s.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{s.current}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{s.required}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.teal }}>{s.resource}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title={t("page.gapReport.improvementSuggestion")}>
        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed" style={{ color: T.ink }}>{data.suggestion}</p>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Btn variant="secondary" icon={Download} onClick={handleExport}>导出报告</Btn>
        <Btn icon={ArrowRight} onClick={() => navigate("/learning-path")}>生成学习路径 →</Btn>
      </div>
    </div>
  );
}
