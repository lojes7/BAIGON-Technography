import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Upload, Plus, Search, ChevronDown, ChevronLeft, Pencil, AlertTriangle, Trash2, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getAbilityList, createAbility, updateAbility, deleteAbility, reviewAbility } from "../services/dict";
import type { AbilityItem } from "../types/api";
import { evolutionData } from "../data";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";
import SkillFormModal from "../components/overlay/SkillFormModal";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";

function SkillDictionaryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "reviewer";
  const [selected, setSelected] = useState<AbilityItem | null>(null);
  const [activeTab, setActiveTab] = useState("基本信息");
  const [skillModal, setSkillModal] = useState<null | "create" | "edit">(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchSkills = () => {
    setLoading(true);
    getAbilityList(1, 100).then((res) => { setApiSkills(res.data.items); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  const [apiSkills, setApiSkills] = useState<AbilityItem[]>([]);

  useEffect(() => { fetchSkills(); }, []);

  const handleSkillSave = async (d: { name: string; en: string; type: string; description: string }) => {
    try {
      if (skillModal === "create") await createAbility({ name: d.name });
      else if (selected) await updateAbility(selected.id, { name: d.name });
      toast.success(t(skillModal === "create" ? "msg.skillCreated" : "msg.skillUpdated"));
      setSkillModal(null); fetchSkills();
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleSkillDelete = async () => {
    if (deleteId === null) return;
    try { await deleteAbility(deleteId); toast.success(t("msg.rejected")); setDeleteId(null); fetchSkills(); }
    catch (err) { toast.error((err as Error).message); }
  };

  const handleSkillReview = async (skillId: string, status: string) => {
    try { await reviewAbility(skillId, { review_status: status }); toast.success(t(status === "REVIEW_PASSED" ? "msg.auditPassed" : "msg.auditRejected")); fetchSkills(); }
    catch (err) { toast.error((err as Error).message); }
  };

  const tabs = ["基本信息", "别名与映射", "岗位需求", "图谱关系", "演化趋势", "课程支撑", "变更历史"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.skillDict")]}
        title={t("page.skillDict.title")}
        actions={canEdit ? (
          <>
            <Btn variant="secondary" icon={Upload} onClick={() => toast("导入词典功能：支持 CSV/XLSX 格式，请上传标准词典文件")}>导入词典</Btn>
            <Btn icon={Plus} onClick={() => setSkillModal("create")}>新建标准能力</Btn>
          </>
        ) : undefined}
      />

      {!selected ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white flex-1 max-w-64"
              style={{ border: `1px solid ${T.border}` }}>
              <Search size={14} style={{ color: T.info }} />
              <input className="bg-transparent text-[13px] flex-1 outline-none"
                placeholder="搜索能力名称或别名…" style={{ color: T.ink }} />
            </div>
            {[
              { label: "类型", value: "全部" },
              { label: "状态", value: "有效" },
              { label: "来源", value: "全部" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[13px] cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.ink }}>
                <span style={{ color: T.info }}>{f.label}</span>
                <span>{f.value}</span>
                <ChevronDown size={12} style={{ color: T.info }} />
              </div>
            ))}
          </div>

          <Card>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["标准能力", "复核状态", "复核时间", "创建时间", "操作"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]"
                      style={{ color: T.info }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiSkills.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-gray-50 cursor-pointer"
                    style={{ borderTop: `1px solid ${T.cloud}` }}
                    onClick={() => setSelected(row)}>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.review_status} /></td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{row.reviewed_at?.slice(0, 10) || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{row.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-[12px] font-medium" style={{ color: T.teal }} onClick={() => setSelected(row)}>
                          {row.review_status === "needs_review" ? "复核" : "查看"}
                        </button>
                        {canEdit && (
                          <>
                            <button className="text-[12px] font-medium" style={{ color: T.risk }} onClick={() => setDeleteId(row.id)} title={t("common.delete")}><Trash2 size={13} /></button>
                            {row.review_status !== "REVIEW_PASSED" && (
                              <button className="text-[12px] font-medium" style={{ color: T.emerging }} onClick={() => handleSkillReview(row.id, "REVIEW_PASSED")}><CheckCircle size={13} /></button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <button className="flex items-center gap-1.5 text-[13px] self-start" style={{ color: T.teal }}
            onClick={() => setSelected(null)}>
            <ChevronLeft size={14} />返回列表
          </button>

          <Card>
            <div className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-[20px] font-medium" style={{ color: T.ink }}>{selected.name}</h2>
                    <StatusBadge status={selected.review_status} />
                  </div>
                  <div className="flex items-center gap-4 text-[13px] mt-2">
                    <span><span style={{ color: T.info }}>ID：</span>
                      <span className="font-mono font-medium">{selected.id}</span></span>
                    <span><span style={{ color: T.info }}>复核时间：</span>
                      <span className="font-mono font-medium">{selected.reviewed_at?.slice(0, 10) || "—"}</span></span>
                    <span><span style={{ color: T.info }}>复核人：</span>
                      <span className="font-mono font-medium">{selected.reviewed_by || "—"}</span></span>
                    <span><span style={{ color: T.info }}>创建时间：</span>
                      <span className="font-mono font-medium">{selected.created_at.slice(0, 10)}</span></span>
                  </div>
                </div>
                {canEdit && <Btn variant="secondary" size="sm" icon={Pencil} onClick={() => setSkillModal("edit")}>编辑</Btn>}
              </div>
            </div>
          </Card>

          <div className="flex items-center gap-1 border-b" style={{ borderColor: T.border }}>
            {tabs.map(tab => (
              <button key={tab}
                className="px-4 py-2.5 text-[13px] transition-colors relative"
                style={{ color: activeTab === tab ? T.teal : T.info }}
                onClick={() => setActiveTab(tab)}>
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: T.teal }} />
                )}
              </button>
            ))}
          </div>

          {activeTab === "演化趋势" && (
            <Card title="覆盖率趋势（岗位占比 %）">
              <div className="px-4 pb-4 pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.cloud} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} unit="%" width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 6 }} />
                    <Line type="monotone" dataKey="agent" name="Agent编排" stroke={T.teal}
                      strokeWidth={2} dot={{ r: 3, fill: T.teal }} />
                    <Line type="monotone" dataKey="rag" name="RAG工程化" stroke={T.emerging}
                      strokeWidth={2} dot={{ r: 3, fill: T.emerging }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {activeTab === "基本信息" && (
            <Card>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <div className="text-[12px] font-medium mb-1.5" style={{ color: T.info }}>能力描述</div>
                  <div className="text-[13px] leading-relaxed" style={{ color: T.ink }}>
                    {selected.name === "Agent编排"
                      ? "设计和实现多智能体协作工作流，包括任务规划、工具调用、Memory管理和多Agent通信，熟悉LangChain、AutoGen等主流框架。"
                      : `${selected.name}是人工智能领域的核心技术能力，广泛应用于相关岗位的日常工作中。`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-[13px]">
                  {[
                    ["来源", "AI抽取 + 人工确认"],
                    ["首次识别", "2024-09"],
                    ["最近更新", "2026-06-28"],
                    ["词典版本", "v2.3.1"],
                    ["审核人", "张研究员"],
                    ["可信度", "高"],
                  ].map(([k, v], i) => (
                    <div key={i}>
                      <div style={{ color: T.info }}>{k}</div>
                      <div className="font-medium mt-0.5" style={{ color: T.ink }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {activeTab === "别名与映射" && (
            <Card title="别名与原始文本映射" action={canEdit ? <Btn size="sm" icon={Plus}>添加别名</Btn> : undefined}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: T.cloud }}>
                    {["别名 / 原始文本", "类型", "来源", "出现次数", "状态", "操作"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { alias: selected.name, type: "标准名称", source: "人工确认", count: "—", status: "confirmed" },
                    { alias: "Agent Framework", type: "原始文本", source: "AI抽取", count: 38, status: "confirmed" },
                    { alias: "智能体编排", type: "中文别名", source: "AI抽取", count: 21, status: "needs_review" },
                    { alias: "多Agent协作", type: "原始文本", source: "AI抽取", count: 14, status: "confirmed" },
                    { alias: "AgentOps", type: "原始文本", source: "AI抽取", count: 6, status: "needs_review" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                      <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.alias}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: T.cloud, color: T.info }}>{row.type}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{row.source}</td>
                      <td className="px-4 py-3 font-mono text-center">{row.count}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-[12px]" style={{ color: T.teal }}>确认</button>
                          <button className="text-[12px]" style={{ color: T.risk }}>移除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === "岗位需求" && (
            <>
              <Card title="需求趋势（岗位占比 %）">
                <div className="px-4 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.cloud} vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: T.info }} tickLine={false} axisLine={false} unit="%" width={35} />
                      <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 6 }} />
                      <Line type="monotone" dataKey="agent" name={selected.name} stroke={T.teal} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="需要此能力的岗位">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ background: T.cloud }}>
                      {["岗位名称", "岗位族", "提及频率", "样本数", "关联强度"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { job: "大模型应用工程师", family: "大模型应用", freq: "84%", samples: 38, strength: "核心" },
                      { job: "AI平台工程师", family: "大模型应用", freq: "56%", samples: 24, strength: "重要" },
                      { job: "算法工程师（通用）", family: "算法工程", freq: "28%", samples: 12, strength: "一般" },
                      { job: "机器学习工程师", family: "AI基础设施", freq: "22%", samples: 9, strength: "一般" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                        <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.job}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{row.family}</td>
                        <td className="px-4 py-3 font-mono">{row.freq}</td>
                        <td className="px-4 py-3 font-mono">{row.samples}</td>
                        <td className="px-4 py-3">
                          <span className="text-[12px]" style={{
                            color: row.strength === "核心" ? T.risk : row.strength === "重要" ? T.stable : T.info
                          }}>{row.strength}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {activeTab === "图谱关系" && (
            <Card title="关联节点">
              <div className="divide-y" style={{ borderColor: T.cloud }}>
                {[
                  { type: "前置能力", nodes: ["Python工程化", "大模型基础"] },
                  { type: "共现能力", nodes: ["RAG工程化", "向量数据库", "模型评测", "LangChain"] },
                  { type: "衍生关系", nodes: ["AI平台工程", "多模态理解"] },
                  { type: "使用工具", nodes: ["LangChain", "AutoGen", "LlamaIndex"] },
                  { type: "相关课程", nodes: ["大模型应用开发", "智能应用开发实训"] },
                ].map((group, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                      {group.type}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.nodes.map((n, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}>
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === "课程支撑" && (
            <Card title="课程证据覆盖">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: T.cloud }}>
                    {["课程名称", "证据类型", "支撑等级", "课时占比", "复核状态", "操作"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { course: "大模型应用开发", type: "教学内容", level: "M", hours: "约8学时", status: "confirmed" },
                    { course: "智能应用开发实训", type: "大纲声明", level: "L", hours: "未明确", status: "needs_review" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                      <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.course}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{row.type}</td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                          style={{ color: row.level === "H" ? T.emerging : row.level === "M" ? T.stable : T.pending,
                            background: row.level === "H" ? `${T.emerging}18` : row.level === "M" ? `${T.stable}18` : `${T.pending}18` }}>
                          {row.level === "M" ? "教学M" : row.level === "H" ? "实践H" : "声明L"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{row.hours}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <button className="text-[12px] font-medium" style={{ color: T.teal }}>查看证据</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: T.risk }}>
                  <AlertTriangle size={13} />
                  此能力缺少实践（H级）证据 — 建议在"智能应用开发实训"中增加Agent工作流项目
                </div>
              </div>
            </Card>
          )}

          {activeTab === "变更历史" && (
            <Card title="变更记录">
              <div className="divide-y" style={{ borderColor: T.cloud }}>
                {[
                  { date: "2026-06-28", user: "张研究员", action: "状态更新", detail: "由候选（candidate）变更为有效（valid）" },
                  { date: "2026-06-15", user: "李分析师", action: "添加别名", detail: '新增别名"Agent Framework"（AI抽取来源）' },
                  { date: "2026-05-10", user: "AI系统", action: "首次识别", detail: "由AI抽取任务 #EXT-202605-008 首次抽取" },
                  { date: "2026-04-22", user: "李分析师", action: "添加别名", detail: '新增别名"智能体编排"（待复核）' },
                  { date: "2026-03-15", user: "张研究员", action: "描述更新", detail: "补充了LangChain、AutoGen等主流框架说明" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-4 px-4 py-3">
                    <div className="flex-shrink-0 text-right" style={{ width: 96 }}>
                      <div className="font-mono text-[11px]" style={{ color: T.info }}>{row.date}</div>
                    </div>
                    <div className="w-2 mt-1.5 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full" style={{ background: T.teal }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: T.ink }}>{row.action}</span>
                        <span className="text-[12px]" style={{ color: T.info }}>· {row.user}</span>
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: T.info }}>{row.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
      {skillModal && (
        <SkillFormModal
          initial={skillModal === "edit" && selected
            ? { name: selected.name, en: "", type: "", description: "" }
            : undefined}
          onClose={() => setSkillModal(null)}
          onSave={handleSkillSave}
        />
      )}
      {evidenceOpen && (
        <EvidenceDrawer
          title={selected?.name ?? "能力"}
          subtitle="关联岗位来源证据"
          onClose={() => setEvidenceOpen(false)}
        />
      )}
{deleteId !== null && (
        <ConfirmDialog title={t("common.confirmDelete")} body={t("common.confirmDelete") + "？"} confirmLabel={t("common.delete")} danger onConfirm={handleSkillDelete} onClose={() => setDeleteId(null)} />
      )}
    </div>
  );
}
export default SkillDictionaryPage;
