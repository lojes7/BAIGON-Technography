import { useState } from "react";
import {
  X, Sparkles, Building2, TrendingUp, FileText, BookOpen, RefreshCw,
  Pencil, CheckCircle2, XCircle, Check, Plus,
} from "lucide-react";
import { toast } from "sonner";

/* 深蓝主色系（与数据导入/数据源页一致） */
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
  border: "#E4EAF2",
} as const;

/* ═══════════ Mock 数据 ═══════════ */

type JobStatus = "signal" | "defined" | "adopted" | "rejected";

interface JobDefinition {
  responsibilities: string[];
  requiredSkills: { name: string; level: string }[];
  bonusSkills: string[];
  scenarios: string[];
}

interface EmergingJob {
  id: string;
  name: string;
  firstSeen: string;
  evidenceCount: number;
  platforms: string[];
  growth: number;
  companies: number;
  trend: number[];
  status: JobStatus;
  definedAt?: string;
  definition?: JobDefinition;
}

const STATUS: Record<JobStatus, { label: string; bg: string; color: string }> = {
  signal: { label: "萌芽信号", bg: P.amberBg, color: P.amber },
  defined: { label: "已生成定义", bg: P.skySoft, color: P.primary },
  adopted: { label: "已收录词典", bg: P.greenBg, color: P.green },
  rejected: { label: "已驳回", bg: "#FBEAE7", color: P.red },
};

const INITIAL_JOBS: EmergingJob[] = [
  {
    id: "em_001", name: "大模型应用工程师", firstSeen: "2026-03", evidenceCount: 486,
    platforms: ["智联招聘", "BOSS直聘", "猎聘"], growth: 420, companies: 156,
    trend: [12, 18, 32, 58, 96, 154], status: "defined", definedAt: "2026-08-12",
    definition: {
      responsibilities: [
        "基于 LLM 构建智能应用系统，负责 RAG 检索增强、Agent 编排、模型微调等关键技术落地",
        "设计并优化 Prompt 与知识库问答链路，保障回答质量与幻觉控制",
        "对接业务系统完成大模型能力集成，建设效果评测与持续迭代机制",
      ],
      requiredSkills: [
        { name: "大语言模型", level: "精通" }, { name: "RAG工程化", level: "熟练" },
        { name: "Python", level: "熟练" }, { name: "Prompt工程", level: "熟练" },
        { name: "向量数据库", level: "熟悉" },
      ],
      bonusSkills: ["LangChain", "Agent框架", "LoRA微调", "推理加速"],
      scenarios: ["智能客服与知识库问答", "企业办公自动化助手", "行业垂直大模型应用"],
    },
  },
  {
    id: "em_002", name: "AI Agent 训练师", firstSeen: "2026-05", evidenceCount: 187,
    platforms: ["BOSS直聘", "拉勾"], growth: 260, companies: 64,
    trend: [4, 9, 15, 28, 52, 87], status: "signal",
  },
  {
    id: "em_003", name: "提示词工程师", firstSeen: "2025-11", evidenceCount: 322,
    platforms: ["智联招聘", "猎聘", "BOSS直聘"], growth: 180, companies: 98,
    trend: [18, 30, 42, 66, 90, 118], status: "defined", definedAt: "2026-07-30",
    definition: {
      responsibilities: [
        "设计、评测与迭代面向业务场景的 Prompt 体系与提示词模板库",
        "建立 Prompt 效果评测基准，持续优化模型输出的准确性与稳定性",
        "沉淀提示词工程最佳实践，赋能产品与运营团队",
      ],
      requiredSkills: [
        { name: "Prompt工程", level: "精通" }, { name: "大语言模型", level: "熟练" },
        { name: "Python", level: "熟悉" },
      ],
      bonusSkills: ["A/B评测设计", "CoT思维链", "多模态提示"],
      scenarios: ["营销文案生成", "代码辅助生成", "智能问答优化"],
    },
  },
  {
    id: "em_004", name: "AI 质量评测工程师", firstSeen: "2026-06", evidenceCount: 132,
    platforms: ["BOSS直聘"], growth: 210, companies: 41,
    trend: [3, 6, 11, 20, 34, 55], status: "signal",
  },
  {
    id: "em_005", name: "数据治理工程师", firstSeen: "2025-09", evidenceCount: 568,
    platforms: ["智联招聘", "猎聘", "BOSS直聘", "拉勾"], growth: 95, companies: 212,
    trend: [60, 78, 92, 104, 118, 130], status: "adopted", definedAt: "2026-05-18",
    definition: {
      responsibilities: [
        "建设企业级数据标准与数据质量体系，主导元数据与主数据治理",
        "设计数据资产目录与血缘追踪方案，支撑数据合规与安全审计",
      ],
      requiredSkills: [
        { name: "数据仓库", level: "熟练" }, { name: "数据质量管理", level: "熟练" },
        { name: "SQL", level: "精通" },
      ],
      bonusSkills: ["DataHub", "数据血缘分析", "DCMM体系"],
      scenarios: ["金融数据合规", "制造业数据资产管理", "政务数据共享交换"],
    },
  },
  {
    id: "em_006", name: "工业大模型运维工程师", firstSeen: "2026-07", evidenceCount: 76,
    platforms: ["智联招聘"], growth: 320, companies: 23,
    trend: [2, 4, 7, 12, 22, 38], status: "signal",
  },
];

/* ═══════════ 页面 ═══════════ */

export default function EmergingJobsPage() {
  const [jobs, setJobs] = useState<EmergingJob[]>(INITIAL_JOBS);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JobDefinition | null>(null);

  const drawerJob = jobs.find((j) => j.id === drawerId) ?? null;
  const definedCount = jobs.filter((j) => j.status === "defined" || j.status === "adopted").length;
  const pendingCount = jobs.filter((j) => j.status === "signal").length;
  const adoptedCount = jobs.filter((j) => j.status === "adopted").length;

  /* AI 生成岗位定义（Mock：模拟生成过程后写入定义） */
  const handleGenerate = (job: EmergingJob) => {
    setGeneratingId(job.id);
    setTimeout(() => {
      setJobs((prev) => prev.map((j) => j.id === job.id ? {
        ...j,
        status: "defined" as JobStatus,
        definedAt: new Date().toISOString().slice(0, 10),
        definition: {
          responsibilities: [
            `围绕${job.name.replace("工程师", "")}方向，负责核心业务场景的方案设计与工程化落地`,
            "跟进前沿技术演进，将最新成果转化为可复用的团队实践",
            "与产品、数据团队协作，持续迭代系统效果并保障稳定运行",
          ],
          requiredSkills: [
            { name: "Python", level: "熟练" }, { name: "机器学习", level: "熟练" },
            { name: "大语言模型", level: "熟悉" },
          ],
          bonusSkills: ["分布式系统", "云原生部署"],
          scenarios: ["新一代信息技术企业", "制造业数字化转型"],
        },
      } : j));
      setGeneratingId(null);
      toast.success("岗位定义已生成", { description: `${job.name} 的定义由 AI 基于 ${job.evidenceCount} 条招聘证据生成，可人工优化后收录` });
    }, 1800);
  };

  const openDrawer = (job: EmergingJob) => {
    setDrawerId(job.id);
    setEditing(false);
    setDraft(job.definition ? JSON.parse(JSON.stringify(job.definition)) : null);
  };

  const handleSaveEdit = () => {
    if (!drawerJob || !draft) return;
    setJobs((prev) => prev.map((j) => j.id === drawerJob.id ? { ...j, definition: draft } : j));
    setEditing(false);
    toast.success("定义已更新", { description: "人工优化内容已保存，词条将进入动态更新队列" });
  };

  const handleAdopt = () => {
    if (!drawerJob) return;
    setJobs((prev) => prev.map((j) => j.id === drawerJob.id ? { ...j, status: "adopted" as JobStatus } : j));
    toast.success("已收录岗位词典", { description: `${drawerJob.name} 已进入标准岗位词典，支持后续动态更新演化` });
  };

  const handleReject = () => {
    if (!drawerJob) return;
    setJobs((prev) => prev.map((j) => j.id === drawerJob.id ? { ...j, status: "rejected" as JobStatus } : j));
    setDrawerId(null);
    toast("已驳回该信号", { description: "系统将下调此类岗位信号的发现权重" });
  };

  const handleRegenerate = () => {
    if (!drawerJob) return;
    setEditing(false);
    handleGenerate(drawerJob);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 页头 ===== */}
      <div>
        <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>新岗位发现与定义</h1>
        <p className="text-[13px] mt-1" style={{ color: P.muted }}>
          识别市场上正在萌芽、尚未被标准化的新岗位 · AI 生成岗位定义 · 支持人工优化与动态更新（Mock 演示数据）
        </p>
      </div>

      {/* ===== KPI 统计行 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard featured>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>累计发现新岗位</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
              <Sparkles size={14} color="#fff" />
            </span>
          </div>
          <div className="text-[32px] font-mono font-semibold leading-tight mt-1">{jobs.length}</div>
          <div className="mt-auto flex items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>近 12 个月</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>{jobs.filter(j => j.status === "signal").length} 个信号待处理</span>
          </div>
        </KpiCard>

        {[
          { title: "待生成定义", value: String(pendingCount), icon: TrendingUp, chip: "信号已达生成阈值", bg: P.amberBg, color: P.amber, warn: true },
          { title: "已生成定义", value: String(definedCount), icon: FileText, chip: "含人工优化中词条", bg: P.skySoft, color: P.primary },
          { title: "已收录岗位词典", value: String(adoptedCount), icon: BookOpen, chip: "随图谱持续演化", bg: P.greenBg, color: P.green },
        ].map((k) => (
          <KpiCard key={k.title}>
            <div className="flex items-start justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.title}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </span>
            </div>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <div className="mt-auto flex items-center gap-1.5">
              {k.warn && <TrendingUp size={11} style={{ color: k.color }} />}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
            </div>
          </KpiCard>
        ))}
      </div>

      {/* ===== 萌芽信号列表 ===== */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>萌芽信号监测</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>信号强度 = 招聘证据量 × 企业覆盖 × 增长速率，达标后即可生成岗位定义</div>
          </div>
        </div>
        <div className="flex flex-col">
          {jobs.map((job, idx) => {
            const st = STATUS[job.status];
            const maxV = Math.max(...job.trend);
            return (
              <div key={job.id} className="px-5 py-4" style={{ borderTop: idx ? `1px solid ${P.border}` : "none" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[15px] font-medium" style={{ color: P.ink }}>{job.name}</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <span className="text-[11.5px]" style={{ color: P.faint }}>首次发现 {job.firstSeen}</span>
                    </div>
                    <div className="flex items-center gap-5 mt-2.5 text-[12.5px]" style={{ color: P.muted }}>
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} />招聘证据 <span className="font-mono font-medium" style={{ color: P.ink }}>{job.evidenceCount}</span> 条
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={12} />涉及企业 <span className="font-mono font-medium" style={{ color: P.ink }}>{job.companies}</span> 家
                      </span>
                      <span>{job.platforms.join(" / ")}</span>
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: P.green }}>
                        <TrendingUp size={12} />近90天 +{job.growth}%
                      </span>
                    </div>
                  </div>
                  {/* 近 6 期信号趋势 */}
                  <div className="flex items-end gap-1 h-10 flex-shrink-0" title="近 6 期信号量趋势">
                    {job.trend.map((v, i) => (
                      <div key={i} className="w-2 rounded-sm"
                        style={{ height: `${Math.max(12, (v / maxV) * 100)}%`, background: i === job.trend.length - 1 ? P.primary : P.sky }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  {job.status === "signal" && (
                    <Btn variant="primary" icon={Sparkles} loading={generatingId === job.id}
                      onClick={() => handleGenerate(job)}>
                      {generatingId === job.id ? "AI 生成中..." : "生成岗位定义"}
                    </Btn>
                  )}
                  {job.definition && (
                    <Btn variant="secondary" onClick={() => openDrawer(job)}>
                      {job.status === "adopted" ? "查看定义" : "查看 / 优化定义"}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 定义抽屉 ===== */}
      {drawerJob && drawerJob.definition && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerId(null)} />
          <div className="relative w-[720px] max-w-[92vw] h-full bg-white shadow-2xl flex flex-col">
            {/* 抽屉头 */}
            <div className="px-6 py-4 flex items-start justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[17px] font-semibold" style={{ color: P.ink }}>{drawerJob.name}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: STATUS[drawerJob.status].bg, color: STATUS[drawerJob.status].color }}>
                    {STATUS[drawerJob.status].label}
                  </span>
                </div>
                <div className="text-[12px] mt-1" style={{ color: P.faint }}>
                  定义生成于 {drawerJob.definedAt} · 基于 {drawerJob.evidenceCount} 条招聘证据 · 来源：{drawerJob.platforms.join("、")}
                </div>
              </div>
              <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={() => setDrawerId(null)}>
                <X size={16} style={{ color: P.faint }} />
              </button>
            </div>

            {/* 抽屉内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* 核心职责 */}
              <section>
                <SectionTitle title="核心职责" />
                {editing ? (
                  <textarea
                    className="w-full rounded-lg p-3 text-[13px] leading-relaxed outline-none"
                    style={{ border: `1px solid ${P.border}`, color: P.ink, minHeight: 88 }}
                    value={draft!.responsibilities.join("\n")}
                    onChange={(e) => setDraft({ ...draft!, responsibilities: e.target.value.split("\n").filter(Boolean) })}
                  />
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {drawerJob.definition.responsibilities.map((r, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: P.ink }}>
                        <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white font-mono"
                          style={{ background: P.primary }}>{i + 1}</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 必备技能 */}
              <section>
                <SectionTitle title="必备技能" hint="颗粒度到技能点 · 括号内为熟练度要求" />
                <div className="flex flex-wrap gap-2">
                  {(editing ? draft! : drawerJob.definition).requiredSkills.map((s, i) => (
                    <span key={s.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px]"
                      style={{ background: P.greenBg, color: "#0B6B4B", border: `1px solid #BFE3D4` }}>
                      {editing && (
                        <button onClick={() => setDraft({ ...draft!, requiredSkills: draft!.requiredSkills.filter((_, idx) => idx !== i) })}>
                          <X size={10} />
                        </button>
                      )}
                      <span className="font-medium">{s.name}</span>
                      {editing ? (
                        <input className="w-12 text-[11px] px-1 rounded outline-none"
                          style={{ border: `1px solid ${P.border}`, color: P.ink }}
                          value={s.level}
                          onChange={(e) => {
                            const arr = [...draft!.requiredSkills];
                            arr[i] = { ...arr[i], level: e.target.value };
                            setDraft({ ...draft!, requiredSkills: arr });
                          }} />
                      ) : (
                        <span className="opacity-75">· {s.level}</span>
                      )}
                    </span>
                  ))}
                  {editing && (
                    <AddChipButton onAdd={(name) => setDraft({ ...draft!, requiredSkills: [...draft!.requiredSkills, { name, level: "熟悉" }] })} />
                  )}
                </div>
              </section>

              {/* 加分技能 */}
              <section>
                <SectionTitle title="加分技能" />
                <div className="flex flex-wrap gap-2">
                  {(editing ? draft! : drawerJob.definition).bonusSkills.map((s, i) => (
                    <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px]"
                      style={{ background: P.amberBg, color: "#8A5A10", border: `1px solid #EDD9B4` }}>
                      {editing && (
                        <button onClick={() => setDraft({ ...draft!, bonusSkills: draft!.bonusSkills.filter((_, idx) => idx !== i) })}>
                          <X size={10} />
                        </button>
                      )}
                      {s}
                    </span>
                  ))}
                  {editing && (
                    <AddChipButton onAdd={(name) => setDraft({ ...draft!, bonusSkills: [...draft!.bonusSkills, name] })} />
                  )}
                </div>
              </section>

              {/* 典型行业应用场景 */}
              <section>
                <SectionTitle title="典型行业应用场景" />
                {editing ? (
                  <input
                    className="w-full rounded-lg p-3 text-[13px] outline-none"
                    style={{ border: `1px solid ${P.border}`, color: P.ink }}
                    value={draft!.scenarios.join("；")}
                    onChange={(e) => setDraft({ ...draft!, scenarios: e.target.value.split(/[；;]/).map(s => s.trim()).filter(Boolean) })}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {drawerJob.definition.scenarios.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-[12.5px]"
                        style={{ background: P.skySoft, color: P.primary }}>{s}</span>
                    ))}
                  </div>
                )}
              </section>

              {/* 萌芽证据 */}
              <section>
                <SectionTitle title="萌芽证据" hint="支撑该岗位定义的招聘证据样本" />
                <table className="w-full text-[12.5px]" style={{ border: `1px solid ${P.border}` }}>
                  <thead>
                    <tr style={{ background: P.skySoft }}>
                      {["企业", "招聘岗位", "来源平台", "发布日期"].map((h) => (
                        <th key={h} className="px-3.5 py-2 text-left font-medium text-[11.5px]" style={{ color: P.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { company: "云智汇科技", job: "大模型应用开发专家", platform: "智联招聘", date: "2026-08-20" },
                      { company: "数联智能", job: "LLM 应用工程师", platform: "BOSS直聘", date: "2026-08-17" },
                      { company: "慧算账业", job: "AI 应用工程师（RAG 方向）", platform: "猎聘", date: "2026-08-11" },
                    ].map((e, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${P.border}` }}>
                        <td className="px-3.5 py-2.5 font-medium" style={{ color: P.ink }}>{e.company}</td>
                        <td className="px-3.5 py-2.5" style={{ color: P.muted }}>{e.job}</td>
                        <td className="px-3.5 py-2.5" style={{ color: P.muted }}>{e.platform}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[11.5px]" style={{ color: P.faint }}>{e.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            {/* 抽屉底部操作 */}
            <div className="px-6 py-3.5 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}`, background: "#FAFBFD" }}>
              <div className="text-[12px] truncate min-w-0" style={{ color: P.faint }}>
                {editing ? "人工优化模式：直接编辑字段" : "采纳后词条随图谱演化"}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editing ? (
                  <>
                    <Btn variant="secondary" onClick={() => { setEditing(false); setDraft(drawerJob.definition ? JSON.parse(JSON.stringify(drawerJob.definition)) : null); }}>取消</Btn>
                    <Btn variant="primary" icon={Check} onClick={handleSaveEdit}>保存</Btn>
                  </>
                ) : (
                  <>
                    <Btn variant="ghost" icon={RefreshCw} loading={generatingId === drawerJob.id} onClick={handleRegenerate}>更新</Btn>
                    {drawerJob.status !== "adopted" && <Btn variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>优化</Btn>}
                    {drawerJob.status === "defined" && (
                      <>
                        <Btn variant="ghost" icon={XCircle} onClick={handleReject}>驳回</Btn>
                        <Btn variant="primary" icon={CheckCircle2} onClick={handleAdopt}>采纳收录</Btn>
                      </>
                    )}
                    {drawerJob.status === "adopted" && (
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-medium whitespace-nowrap" style={{ color: P.green }}>
                        <BookOpen size={13} />已收录 · 随图谱演化
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ 小组件（与数据导入页风格一致） ═══════════ */

function KpiCard({ children, featured = false }: { children: React.ReactNode; featured?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all hover:-translate-y-0.5 ${featured ? "text-white" : "bg-white hover:shadow-md"}`}
      style={featured
        ? { background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 132 }
        : { border: `1px solid ${P.border}`, minHeight: 132 }}
    >
      {featured && (
        <>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        </>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2.5">
      <span className="text-[13.5px] font-semibold" style={{ color: P.ink }}>{title}</span>
      {hint && <span className="text-[11.5px]" style={{ color: P.faint }}>{hint}</span>}
    </div>
  );
}

function Btn({ children, icon: Icon, onClick, variant = "primary", loading }: {
  children: React.ReactNode;
  icon?: React.ElementType;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  const style = variant === "primary"
    ? { background: P.primary, color: "#fff" }
    : variant === "secondary"
      ? { background: "#fff", color: P.ink, border: `1px solid ${P.border}` }
      : variant === "danger"
        ? { background: "#fff", color: P.red, border: `1px solid #F3C6BF` }
        : { background: "transparent", color: P.muted };
  return (
    <button
      className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-85 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
      style={style}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <RefreshCw size={13} className="animate-spin" /> : Icon ? <Icon size={13} /> : null}
      {children}
    </button>
  );
}

function AddChipButton({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <button
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12.5px] font-medium transition-colors hover:opacity-80"
      style={{ border: `1px dashed ${P.primary}66`, color: P.primary, background: P.skySoft + "66" }}
      onClick={() => {
        const name = window.prompt("输入技能点名称");
        if (name && name.trim()) onAdd(name.trim());
      }}
    >
      <Plus size={11} />添加
    </button>
  );
}
