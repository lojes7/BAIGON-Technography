import { useState } from "react";
import {
  History, ArrowUpRight, ArrowDownRight, ArrowRightLeft,
  Pencil, CheckCircle2, XCircle, Check,
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

type ChangeType = "added" | "modified" | "removed";
type UpdateStatus = "pending" | "applied" | "rejected";

interface CapabilityChange {
  type: ChangeType;
  skill: string;
  before?: string;
  after: string;
  reason: string;
  companies: number;
  evidence: number;
}

interface JobUpdate {
  id: string;
  jobName: string;
  period: string;
  status: UpdateStatus;
  confidence: number;
  summary: string;
  platforms: string[];
  sampleCount: number;
  changes: CapabilityChange[];
  updatedAt: string;
  history: { period: string; added: number; modified: number; removed: number }[];
}

const CHANGE_INFO: Record<ChangeType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  added: { label: "新增", color: P.green, bg: P.greenBg, icon: ArrowUpRight },
  modified: { label: "修改", color: P.amber, bg: P.amberBg, icon: ArrowRightLeft },
  removed: { label: "删除", color: P.red, bg: "#FBEAE7", icon: ArrowDownRight },
};

const INITIAL_UPDATES: JobUpdate[] = [
  {
    id: "ju_001", jobName: "Java 开发工程师", period: "2025H2 → 2026H1", status: "pending",
    confidence: 92, sampleCount: 4820, updatedAt: "2026-08-25",
    platforms: ["智联招聘", "BOSS直聘", "猎聘"],
    summary:
      "云原生能力已成主流必备要求：K8s 与容器化部署在头部企业 JD 中出现率由 41% 升至 68%；传统 SSH 框架体系（Struts2/Hibernate）加速退出；微服务技术栈整体由 Spring 5 迁移至 Spring Boot 3 + GraalVM 原生镜像方向。建议按「新增 → 修改」顺序完成词条更新。",
    changes: [
      { type: "added", skill: "Kubernetes", after: "熟练", reason: "云原生部署要求普及，容器编排进入必备清单", companies: 187, evidence: 934 },
      { type: "added", skill: "GraalVM 原生镜像", after: "了解", reason: "云成本优化驱动，原生编译成为加分新方向", companies: 46, evidence: 152 },
      { type: "modified", skill: "Spring 生态", before: "熟练（Spring 5 / Spring MVC）", after: "熟练（Spring Boot 3 / WebFlux）", reason: "主流版本换代，响应式编程要求上升", companies: 231, evidence: 1180 },
      { type: "removed", skill: "Struts2", after: "移除", reason: "安全与维护成本原因，JD 出现率降至 2% 以下", companies: 8, evidence: 21 },
    ],
    history: [
      { period: "2024H2", added: 1, modified: 2, removed: 0 },
      { period: "2025H1", added: 2, modified: 1, removed: 1 },
      { period: "2025H2", added: 2, modified: 3, removed: 1 },
    ],
  },
  {
    id: "ju_002", jobName: "前端开发工程师", period: "2025H2 → 2026H1", status: "pending",
    confidence: 89, sampleCount: 3960, updatedAt: "2026-08-22",
    platforms: ["BOSS直聘", "拉勾"],
    summary:
      "TypeScript 已从加分项跃升为硬性必备（出现率 89%）；构建工具由 Webpack 向 Vite/Rspack 迁移明显；AI 辅助研发工具（Copilot 等）协作能力首次进入 JD 要求。",
    changes: [
      { type: "modified", skill: "TypeScript", before: "加分 · 熟悉", after: "必备 · 熟练", reason: "中大型项目全面 TS 化，类型能力成为筛选门槛", companies: 264, evidence: 1520 },
      { type: "added", skill: "Vite / Rspack", after: "熟悉", reason: "构建工具换代，冷启动性能成为团队选型关键", companies: 142, evidence: 508 },
      { type: "added", skill: "AI 辅助研发协作", after: "熟悉", reason: "Copilot/Cursor 等工具进入研发流程规范", companies: 67, evidence: 189 },
      { type: "removed", skill: "jQuery", after: "移除", reason: "遗留项目维护为主，新项目 JD 已基本不再要求", companies: 11, evidence: 26 },
    ],
    history: [
      { period: "2025H1", added: 1, modified: 2, removed: 0 },
      { period: "2025H2", added: 2, modified: 1, removed: 1 },
    ],
  },
  {
    id: "ju_003", jobName: "数据库工程师", period: "2025H2 → 2026H1", status: "applied",
    confidence: 94, sampleCount: 2140, updatedAt: "2026-08-10",
    platforms: ["智联招聘", "猎聘"],
    summary:
      "国产数据库（OceanBase/openGauss/TiDB）运维与调优能力需求显著上升；传统 Oracle DBA 要求收缩；云数据库运维与 IaC 化管理成为新增必备。",
    changes: [
      { type: "added", skill: "国产数据库（OceanBase/TiDB）", after: "熟练", reason: "信创替代加速，金融/政企项目全面转向国产栈", companies: 98, evidence: 402 },
      { type: "modified", skill: "云数据库运维", before: "熟悉", after: "熟练（含 IaC 化管理）", reason: "数据库即代码（Terraform）成为云上标配", companies: 121, evidence: 465 },
      { type: "modified", skill: "Oracle", before: "必备 · 精通", after: "加分 · 熟悉", reason: "存量系统为主，新增要求占比下降", companies: 54, evidence: 173 },
    ],
    history: [
      { period: "2025H1", added: 0, modified: 1, removed: 0 },
      { period: "2025H2", added: 1, modified: 2, removed: 0 },
    ],
  },
  {
    id: "ju_004", jobName: "测试软件工程师", period: "2025H2 → 2026H1", status: "rejected",
    confidence: 71, sampleCount: 1620, updatedAt: "2026-08-05",
    platforms: ["BOSS直聘"],
    summary:
      "AI 生成用例评审能力出现在少量头部企业 JD 中，样本量尚不足以支撑词条变更，建议下期复核。",
    changes: [
      { type: "added", skill: "AI 用例生成与评审", after: "了解", reason: "仅 14 家企业提及，证据不足", companies: 14, evidence: 31 },
    ],
    history: [
      { period: "2025H2", added: 1, modified: 1, removed: 0 },
    ],
  },
];

/* ═══════════ 页面 ═══════════ */

export default function JobUpdatesPage() {
  const [updates, setUpdates] = useState<JobUpdate[]>(INITIAL_UPDATES);
  const [expandedId, setExpandedId] = useState<string | null>("ju_001");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSummary, setDraftSummary] = useState("");

  const pendingCount = updates.filter((u) => u.status === "pending").length;
  const appliedCount = updates.filter((u) => u.status === "applied").length;
  const totalChanges = updates.reduce((sum, u) => sum + u.changes.length, 0);

  const countBy = (u: JobUpdate, type: ChangeType) => u.changes.filter((c) => c.type === type).length;

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const setStatus = (id: string, status: UpdateStatus, msg: string, desc: string) => {
    setUpdates((prev) => prev.map((u) => u.id === id ? { ...u, status } : u));
    toast[status === "rejected" ? "info" : "success"](msg, { description: desc });
  };

  const handleApply = (u: JobUpdate) =>
    setStatus(u.id, "applied", "岗位能力更新已应用", `${u.jobName} 的 ${u.changes.length} 项能力变更已写入图谱，进入动态演化流程`);

  const handleReject = (u: JobUpdate) =>
    setStatus(u.id, "rejected", "已驳回本次更新", "系统将保留原始能力要求，并在下期采集后重新评估");

  const handleSaveEdit = (u: JobUpdate) => {
    setUpdates((prev) => prev.map((x) => x.id === u.id ? { ...x, summary: draftSummary } : x));
    setEditingId(null);
    toast.success("更新说明已人工优化", { description: "修订内容将随本次更新一并写入图谱" });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 页头 ===== */}
      <div>
        <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>既有岗位能力动态更新</h1>
        <p className="text-[13px] mt-1" style={{ color: P.muted }}>
          识别现有岗位能力要求变化 · 明确标注新增 / 删除 / 修改 · 提供更新说明与数据源 · 支持人工优化与动态演化（Mock 演示数据）
        </p>
      </div>

      {/* ===== KPI 统计行 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard featured>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>监测岗位</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
              <History size={14} color="#fff" />
            </span>
          </div>
          <div className="text-[32px] font-mono font-semibold leading-tight mt-1">128</div>
          <div className="mt-auto flex items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>新一代信息技术</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>重点岗位全覆盖</span>
          </div>
        </KpiCard>

        {[
          { title: "本月能力变更", value: String(totalChanges), icon: ArrowRightLeft, chip: `覆盖 ${updates.length} 个岗位`, bg: P.skySoft, color: P.primary },
          { title: "待人工确认", value: String(pendingCount), icon: Pencil, chip: "AI 识别 · 待复核写入", bg: P.amberBg, color: P.amber, warn: true },
          { title: "已应用更新", value: String(appliedCount), icon: CheckCircle2, chip: "已进入图谱动态演化", bg: P.greenBg, color: P.green },
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
              {k.warn && <Pencil size={11} style={{ color: k.color }} />}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
            </div>
          </KpiCard>
        ))}
      </div>

      {/* ===== 岗位更新卡片列表 ===== */}
      <div className="flex flex-col gap-4">
        {updates.map((u) => {
          const open = expandedId === u.id;
          const statusStyle = u.status === "pending"
            ? { label: "待人工确认", bg: P.amberBg, color: P.amber }
            : u.status === "applied"
              ? { label: "已应用", bg: P.greenBg, color: P.green }
              : { label: "已驳回", bg: "#FBEAE7", color: P.red };
          return (
            <div key={u.id} className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
              <div className="px-5 py-4">
                {/* 头部 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[15px] font-medium" style={{ color: P.ink }}>{u.jobName}</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                      <span className="font-mono text-[11.5px]" style={{ color: P.faint }}>{u.period}</span>
                      {/* 变更统计胶囊 */}
                      <span className="flex items-center gap-1.5 text-[11.5px]">
                        {(Object.keys(CHANGE_INFO) as ChangeType[]).map((t) => {
                          const n = countBy(u, t);
                          if (!n) return null;
                          const info = CHANGE_INFO[t];
                          const Icon = info.icon;
                          return (
                            <span key={t} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-medium"
                              style={{ background: info.bg, color: info.color }}>
                              <Icon size={10} />{info.label} {n}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                    {/* AI 更新说明 */}
                    <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: P.ink }}>{u.summary}</p>
                    <div className="flex items-center gap-4 mt-2 text-[12px]" style={{ color: P.faint }}>
                      <span>AI 置信度 <span className="font-mono font-medium" style={{ color: u.confidence >= 85 ? P.green : P.amber }}>{u.confidence}%</span></span>
                      <span>样本 <span className="font-mono">{u.sampleCount.toLocaleString()}</span> 条</span>
                      <span>{u.platforms.join(" / ")}</span>
                      <span>更新时间 {u.updatedAt}</span>
                    </div>
                  </div>
                  <button className="text-[12px] font-medium flex-shrink-0 mt-1 cursor-pointer" style={{ color: P.primary }}
                    onClick={() => toggleExpand(u.id)}>
                    {open ? "收起明细" : "展开明细"} →
                  </button>
                </div>

                {/* 展开明细 */}
                {open && (
                  <div className="mt-4 flex flex-col gap-4" style={{ borderTop: `1px solid ${P.border}`, paddingTop: 14 }}>
                    {/* 编辑说明模式 */}
                    {editingId === u.id ? (
                      <div>
                        <div className="text-[12.5px] font-semibold mb-2" style={{ color: P.ink }}>人工优化 · 更新说明</div>
                        <textarea
                          className="w-full rounded-lg p-3 text-[13px] leading-relaxed outline-none"
                          style={{ border: `1px solid ${P.border}`, color: P.ink, minHeight: 80 }}
                          value={draftSummary}
                          onChange={(e) => setDraftSummary(e.target.value)}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Btn variant="secondary" onClick={() => setEditingId(null)}>取消</Btn>
                          <Btn variant="primary" icon={Check} onClick={() => handleSaveEdit(u)}>保存说明</Btn>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 变更明细表 */}
                        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${P.border}` }}>
                          <table className="w-full min-w-[680px] text-[13px]">
                            <thead>
                              <tr style={{ background: P.skySoft }}>
                                {["变更类型", "能力项", "能力要求变化", "变更依据", "数据来源"].map((h) => (
                                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.muted }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {u.changes.map((c, i) => {
                                const info = CHANGE_INFO[c.type];
                                const Icon = info.icon;
                                return (
                                  <tr key={i} style={{ borderTop: `1px solid ${P.border}` }}>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium"
                                        style={{ background: info.bg, color: info.color }}>
                                        <Icon size={10} />{info.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium" style={{ color: c.type === "removed" ? P.faint : P.ink }}>{c.skill}</td>
                                    <td className="px-4 py-3 text-[12.5px]">
                                      {c.before ? (
                                        <>
                                          <span style={{ color: P.faint, textDecoration: "line-through" }}>{c.before}</span>
                                          <span className="mx-1.5" style={{ color: P.sky }}>→</span>
                                        </>
                                      ) : null}
                                      <span className="font-medium" style={{ color: info.color }}>{c.after}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[12.5px]" style={{ color: P.muted }}>{c.reason}</td>
                                    <td className="px-4 py-3 text-[12px] font-mono whitespace-nowrap" style={{ color: P.faint }}>
                                      {c.companies} 家企业 · {c.evidence} 条证据
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 更新历史 + 操作 */}
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold mb-2" style={{ color: P.ink }}>
                              <History size={13} style={{ color: P.faint }} />动态更新演化
                            </div>
                            <div className="flex items-center gap-2">
                              {u.history.map((h, i) => (
                                <div key={h.period} className="flex items-center gap-2">
                                  {i > 0 && <div className="w-5 h-px" style={{ background: P.border }} />}
                                  <div className="px-2.5 py-1.5 rounded-lg text-[11.5px] text-center" style={{ background: P.skySoft, color: P.ink }}>
                                    <div className="font-mono font-medium">{h.period}</div>
                                    <div style={{ color: P.muted }}>+{h.added} · ~{h.modified} · -{h.removed}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {u.status === "pending" && (
                              <>
                                <Btn variant="ghost" icon={Pencil} onClick={() => { setEditingId(u.id); setDraftSummary(u.summary); }}>优化说明</Btn>
                                <Btn variant="ghost" icon={XCircle} onClick={() => handleReject(u)}>驳回</Btn>
                                <Btn variant="primary" icon={CheckCircle2} onClick={() => handleApply(u)}>采纳并应用更新</Btn>
                              </>
                            )}
                            {u.status === "applied" && (
                              <span className="inline-flex items-center gap-1 text-[12.5px] font-medium" style={{ color: P.green }}>
                                <CheckCircle2 size={13} />已应用 · 词条随图谱动态演化
                              </span>
                            )}
                            {u.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: P.faint }}>
                                <XCircle size={13} />已驳回 · 下期采集后重新评估
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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

function Btn({ children, icon: Icon, onClick, variant = "primary" }: {
  children: React.ReactNode;
  icon?: React.ElementType;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const style = variant === "primary"
    ? { background: P.primary, color: "#fff" }
    : variant === "secondary"
      ? { background: "#fff", color: P.ink, border: `1px solid ${P.border}` }
      : { background: "transparent", color: P.muted };
  return (
    <button
      className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-85"
      style={style}
      onClick={onClick}
    >
      {Icon ? <Icon size={13} /> : null}
      {children}
    </button>
  );
}
