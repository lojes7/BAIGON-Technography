import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Upload, Pencil, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import P from "../constants/palette";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";
import ImportVersionModal from "../components/overlay/ImportVersionModal";
import CompareVersionsModal from "../components/overlay/CompareVersionsModal";

function ProgramsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("培养概览");
  const [importOpen, setImportOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const tabs = ["培养概览", "课程体系", "能力覆盖", "证据质量", "修订历史"];

  const coverageData2 = [
    { cat: "技术技能", covered: 38, total: 52, pct: 73 },
    { cat: "工具与平台", covered: 14, total: 22, pct: 64 },
    { cat: "知识领域", covered: 11, total: 18, pct: 61 },
    { cat: "软技能", covered: 8, total: 12, pct: 67 },
    { cat: "基础技能", covered: 9, total: 9, pct: 100 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.curriculum"), t("nav.programs")]}
        title={t("page.programs.title")}
        updated="2026-07-01"
        actions={isAdmin ? (
          <>
            <Btn variant="secondary" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>导入新版本</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setCompareOpen(true)}>比较版本</Btn>
          </>
        ) : undefined}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>培养方案版本</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">2026<span className="text-[16px] ml-0.5">版</span></div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>生效 2026-09</span>
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>覆盖能力点 113</span>
            <span className="inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>关联课程 62</span>
          </div>
        </div>
        {[
          { label: "能力缺口", value: "12", chip: "需优先补充", bg: P.redBg, color: P.red },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      <Card>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[13px]" style={{ color: P.muted }}>当前版本</span>
                <span className="font-mono text-[13px] font-medium" style={{ color: P.ink }}>2026版</span>
                <span style={{ color: P.muted }}>·</span>
                <span className="text-[13px]" style={{ color: P.muted }}>生效 2026-09</span>
                <StatusBadge status="confirmed" />
              </div>
              <div className="flex items-center gap-6 text-[13px] mt-2">
                {[
                  ["课程总数", "62 门"],
                  ["专业核心课", "18 门"],
                  ["实践环节", "9 项"],
                  ["映射能力", "113 项"],
                  ["开设院校", "3 所"],
                ].map(([k, v], i) => (
                  <span key={i}><span style={{ color: P.muted }}>{k} </span>
                    <span className="font-mono font-medium" style={{ color: P.ink }}>{v}</span></span>
                ))}
              </div>
            </div>
            {isAdmin && <Btn variant="secondary" size="sm" icon={Pencil}>编辑</Btn>}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-1 border-b" >
        {tabs.map(tab => (
          <button key={tab}
            className="px-4 py-2.5 text-[13px] transition-colors relative"
            style={{ color: activeTab === tab ? P.primary : P.muted }}
            onClick={() => setActiveTab(tab)}>
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: P.primary }} />
            )}
          </button>
        ))}
      </div>

      {activeTab === "培养概览" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "能力覆盖率", value: "68%", chip: "较上版本 +8%", bg: P.greenBg, color: P.green },
              { label: "有考核证据的能力", value: "54", chip: "占已覆盖 47.8%", bg: P.amberBg, color: P.amber },
              { label: "高需求未覆盖能力", value: "12", chip: "需优先补充", bg: P.redBg, color: P.red },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
                <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
                <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
                <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
              </div>
            ))}
          </div>

          <Card title="能力分类覆盖情况">
            <div className="px-4 pb-4 pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={coverageData2} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.border} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%"
                    tick={{ fontSize: 11, fill: P.muted }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="cat"
                    tick={{ fontSize: 12, fill: P.ink }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 6 }} />
                  <Bar dataKey="pct" name="覆盖率" radius={[0, 3, 3, 0]}>
                    {coverageData2.map((d, i) => (
                      <Cell key={i} fill={d.pct >= 80 ? P.green : d.pct >= 60 ? P.primary : P.amber} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="主要问题">
            <div className="divide-y divide-[#E4EAF2]" >
              {[
                { level: "critical", msg: "7 项高需求能力未被任何课程正式考核（Agent编排、模型评测等）" },
                { level: "warning", msg: "4 项能力仅在课程大纲中声明，无实践或考核记录" },
                { level: "warning", msg: "AI安全治理在培养方案中完全缺失" },
                { level: "info", msg: "RAG工程化有声明证据但尚无考核证据，支撑等级偏低" },
              ].map((p, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  {p.level === "critical" ? <AlertCircle size={14} style={{ color: P.red, marginTop: 1 }} /> :
                    p.level === "warning" ? <AlertTriangle size={14} style={{ color: P.amber, marginTop: 1 }} /> :
                      <Info size={14} style={{ color: P.muted, marginTop: 1 }} />}
                  <span className="text-[13px]" style={{ color: P.ink }}>{p.msg}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeTab === "课程体系" && (
        <Card>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["课程名称", "类别", "学时", "映射能力数", "证据质量", "操作"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "深度学习与神经网络", cat: "专业核心", hours: 64, skills: 12, quality: "高" },
                { name: "Python机器学习实践", cat: "专业核心", hours: 48, skills: 8, quality: "高" },
                { name: "大模型应用开发", cat: "专业选修", hours: 32, skills: 6, quality: "中" },
                { name: "知识图谱与信息检索", cat: "专业选修", hours: 32, skills: 4, quality: "低" },
                { name: "智能应用开发实训", cat: "实践环节", hours: 80, skills: 9, quality: "中" },
                { name: "计算机视觉", cat: "专业核心", hours: 48, skills: 7, quality: "高" },
                { name: "数据工程与治理", cat: "专业选修", hours: 32, skills: 5, quality: "中" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{row.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{row.cat}</td>
                  <td className="px-4 py-3 font-mono">{row.hours} 学时</td>
                  <td className="px-4 py-3 font-mono">{row.skills}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: row.quality === "高" ? P.green : row.quality === "中" ? P.amber : P.red }}>
                      {row.quality}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-[12px] font-medium" style={{ color: P.primary }}>查看证据</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "能力覆盖" && (
        <Card title="能力覆盖明细">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["能力", "类别", "需求强度", "课程数", "最高证据", "覆盖质量", "响应状态"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { skill: "Python工程化", cat: "技术技能", demand: "极高", courses: 4, best: "H", quality: "高", resp: "confirmed" },
                { skill: "深度学习基础", cat: "技术技能", demand: "高", courses: 3, best: "H", quality: "高", resp: "confirmed" },
                { skill: "RAG工程化", cat: "技术技能", demand: "高", courses: 2, best: "L", quality: "低", resp: "needs_review" },
                { skill: "Agent编排", cat: "技术技能", demand: "高", courses: 1, best: "L", quality: "低", resp: "needs_review" },
                { skill: "向量数据库", cat: "工具与平台", demand: "高", courses: 1, best: "L", quality: "低", resp: "needs_review" },
                { skill: "模型评测", cat: "技术技能", demand: "高", courses: 2, best: "M", quality: "中", resp: "pending" },
                { skill: "图像识别", cat: "技术技能", demand: "中", courses: 2, best: "H", quality: "高", resp: "confirmed" },
                { skill: "AI安全治理", cat: "知识领域", demand: "中", courses: 0, best: "-", quality: "无", resp: "failed" },
              ].map((row, i) => {
                const qColor = row.quality === "高" ? P.green : row.quality === "中" ? P.primary :
                  row.quality === "低" ? P.amber : P.red;
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{row.skill}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{row.cat}</td>
                    <td className="px-4 py-3">
                      <span className="text-[12px]" style={{ color: row.demand === "极高" || row.demand === "高" ? P.red : P.amber }}>
                        {row.demand}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-center">{row.courses}</td>
                    <td className="px-4 py-3 text-center">
                      {row.best !== "-" ? (
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                          style={{ color: row.best === "H" ? P.green : row.best === "M" ? P.primary : P.amber,
                            background: row.best === "H" ? `${P.green}18` : row.best === "M" ? `${P.primary}18` : `${P.amber}18` }}>
                          {row.best === "H" ? "实践H" : row.best === "M" ? "教学M" : "声明L"}
                        </span>
                      ) : <span style={{ color: P.skySoft }}>-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[12px]" style={{ color: qColor }}>{row.quality}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.resp} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "证据质量" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "有考核证据（H）", value: "28", chip: "占覆盖 24.8%", bg: P.greenBg, color: P.green },
              { label: "有教学证据（M）", value: "41", chip: "占覆盖 36.3%", bg: P.skySoft, color: P.primary },
              { label: "仅大纲声明（L）", value: "44", chip: "证据最弱", bg: P.amberBg, color: P.amber },
              { label: "完全无覆盖", value: "12", chip: "含3项高需求", bg: P.redBg, color: P.red },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
                <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
                <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
                <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
              </div>
            ))}
          </div>
          <Card title="证据质量分布（按能力类型）">
            <div className="px-4 pb-4 pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical" barSize={12}
                  data={[
                    { cat: "技术技能", H: 18, M: 24, L: 26, none: 6 },
                    { cat: "工具与平台", H: 6, M: 8, L: 12, none: 2 },
                    { cat: "知识领域", H: 2, M: 5, L: 4, none: 3 },
                    { cat: "软技能", H: 2, M: 4, L: 2, none: 1 },
                  ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: P.muted }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="cat" tick={{ fontSize: 12, fill: P.ink }} tickLine={false} axisLine={false} width={65} />
                  <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="H" name="实践/考核" fill={P.green} stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="M" name="正式教学" fill={P.primary} stackId="a" />
                  <Bar dataKey="L" name="大纲声明" fill={P.amber} stackId="a" />
                  <Bar dataKey="none" name="无覆盖" fill={P.red} stackId="a" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "修订历史" && (
        <Card title="培养方案版本历史">
          <div className="divide-y divide-[#E4EAF2]" >
            {[
              { version: "2026版", date: "2026-01-15", editor: "张研究员", changes: ["新增大模型应用开发课程（32学时）", "扩充智能应用开发实训学时（60→80）", "移除大数据处理课程"] },
              { version: "2025版", date: "2025-01-20", editor: "李分析师", changes: ["加入Python机器学习实践课", "增加RAG相关实验内容（知识图谱课）", "调整深度学习课学时（48→64）"] },
              { version: "2024版", date: "2024-02-08", editor: "张研究员", changes: ["首次录入系统，基准版本", "62门课程完整映射", "113项能力初始关联"] },
            ].map((v, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[14px] font-medium" style={{ color: P.ink }}>{v.version}</span>
                    {i === 0 && <StatusBadge status="confirmed" />}
                  </div>
                  <div className="text-[12px]" style={{ color: P.muted }}>
                    {v.date} · {v.editor}
                  </div>
                </div>
                <ul className="space-y-1">
                  {v.changes.map((c, j) => (
                    <li key={j} className="flex items-start gap-2 text-[13px]" style={{ color: P.ink }}>
                      <span style={{ color: P.primary, flexShrink: 0 }}>·</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
      {importOpen && <ImportVersionModal onClose={() => setImportOpen(false)} />}
      {compareOpen && <CompareVersionsModal onClose={() => setCompareOpen(false)} />}
    </div>
  );
}

export default ProgramsPage;
