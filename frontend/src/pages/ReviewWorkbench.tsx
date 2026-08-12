import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Plus, Pencil, AlertTriangle, X } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Btn, StatusBadge, ConfidenceBadge, Divider } from "../components/ui";
import SkillFormModal from "../components/overlay/SkillFormModal";

function ReviewWorkbenchPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isReviewer = user?.role === "reviewer";
  const [current, setCurrent] = useState(12);
  const [selected, setSelected] = useState<number | null>(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const total = 37;

  const advance = (action: string) => {
    setDone(prev => new Set([...prev, current]));
    const next = current < total ? current + 1 : current;
    setCurrent(next);
    setSelected(0);
    const msgs: Record<string, string> = {
      accept: t("msg.acceptedDesc"), reject: t("msg.rejectedDesc"),
      later: t("msg.postponedDesc"), edit: t("msg.modifiedAndAccepted"),
    };
    if (action === "reject") toast(msgs[action]);
    else toast.success(msgs[action] || "已处理");
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), t("nav.reviewQueue")]}
        title={t("page.reviewWorkbench.title")}
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px]" style={{ color: T.info }}>
              {current} / {total}
            </span>
            <StatusBadge status="needs_review" />
          </div>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Filter panel */}
        <div className="w-48 flex-shrink-0 flex flex-col gap-3">
          <Card>
            <div className="px-4 py-3">
              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                复核类型
              </div>
              {[
                { label: "能力归一", count: 24, checked: true },
                { label: "岗位映射", count: 9, checked: true },
                { label: "图谱关系", count: 4, checked: true },
              ].map((t, i) => (
                <label key={i} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: t.checked ? T.teal : T.border,
                      background: t.checked ? T.teal : "transparent" }}>
                    {t.checked && <CheckCircle size={8} color="white" />}
                  </div>
                  <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{t.label}</span>
                  <span className="font-mono text-[11px]" style={{ color: T.info }}>{t.count}</span>
                </label>
              ))}
            </div>
            <Divider />
            <div className="px-4 py-3">
              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                置信度范围
              </div>
              <div className="flex items-center justify-between text-[12px] font-mono" style={{ color: T.ink }}>
                <span>0.00</span><span>—</span><span>0.75</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full" style={{ background: T.cloud }}>
                <div className="h-full w-3/4 rounded-full" style={{ background: T.teal }} />
              </div>
            </div>
            <Divider />
            <div className="px-4 py-3">
              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                产业
              </div>
              <div className="flex items-center justify-between text-[13px]" style={{ color: T.ink }}>
                <span>全部</span>
                <ChevronDown size={13} style={{ color: T.info }} />
              </div>
            </div>
            <Divider />
            <div className="px-4 py-3">
              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                来源
              </div>
              <div className="flex items-center justify-between text-[13px]" style={{ color: T.ink }}>
                <span>招聘岗位</span>
                <ChevronDown size={13} style={{ color: T.info }} />
              </div>
            </div>
          </Card>
        </div>

        {/* Review panel */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Current item header */}
          <Card>
            <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <span className="text-[12px]" style={{ color: T.info }}>当前复核项</span>
              <span className="font-mono text-[13px] font-medium" style={{ color: T.ink }}>{current} / {total}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden mx-4" style={{ background: T.cloud }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${done.size / total * 100}%`, background: T.teal }} />
              </div>
              <span className="text-[11px] font-mono" style={{ color: T.info }}>已处理 {done.size}</span>
              <button onClick={() => setCurrent(Math.max(1, current - 1))} style={{ color: T.info }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrent(Math.min(total, current + 1))} style={{ color: T.info }}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                原始能力文本
              </div>
              <div className="text-[16px] font-medium" style={{ color: T.ink }}>
                Agent Framework
              </div>
            </div>
          </Card>

          {/* Candidates */}
          <Card title="标准能力候选">
            <div className="divide-y" style={{ borderColor: T.cloud }}>
              {[
                { name: "智能体框架", en: "Agent Framework", sim: 0.91, jobs: 28, confirmed: true },
                { name: "智能体编排", en: "Agent Orchestration", sim: 0.76, jobs: 22, confirmed: false },
                { name: "新建标准能力", en: "", sim: null, jobs: null, confirmed: false, create: true },
              ].map((c, i) => (
                <div key={i}
                  className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors"
                  style={{ background: selected === i ? "#EBF2FA" : "transparent" }}
                  onClick={() => { setSelected(i); if (c.create) setCreateSkillOpen(true); }}>
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors"
                    style={{
                      borderColor: selected === i ? T.teal : T.border,
                      background: selected === i ? T.teal : "transparent",
                    }} />
                  <div className="flex-1">
                    {c.create
                      ? <span className="text-[13px] flex items-center gap-1.5" style={{ color: T.teal }}>
                          <Plus size={13} /> 新建标准能力
                          <span className="text-[11px] ml-1 px-1.5 py-0.5 rounded" style={{ background: `${T.teal}15`, color: T.teal }}>
                            将打开创建表单
                          </span>
                        </span>
                      : (
                        <div>
                          <span className="text-[14px] font-medium" style={{ color: T.ink }}>{c.name}</span>
                          <span className="text-[12px] ml-2" style={{ color: T.info }}>{c.en}</span>
                        </div>
                      )}
                  </div>
                  {c.sim !== null && (
                    <div className="flex items-center gap-4 text-[12px]">
                      <span style={{ color: T.info }}>关联岗位 <span className="font-mono font-medium" style={{ color: T.ink }}>{c.jobs}</span></span>
                      <span style={{ color: T.info }}>相似度</span>
                      <ConfidenceBadge value={c.sim} />
                      {c.confirmed && <CheckCircle size={13} style={{ color: T.emerging }} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Evidence */}
          <Card title="原始证据与上下文">
            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-[12px] font-medium mb-1.5" style={{ color: T.info }}>证据原句</div>
                <div className="text-[13px] p-3 rounded leading-relaxed" style={{ background: T.cloud, color: T.ink }}>
                  "熟悉LangChain、AutoGen等
                  <span className="px-1 py-0.5 rounded font-medium" style={{ background: `${T.teal}20`, color: T.teal }}>
                    Agent Framework
                  </span>
                  ，有多Agent协作系统设计经验，了解Memory、Tool、Planner模块化架构。"
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div style={{ color: T.info }}>关联岗位</div>
                  <div className="font-medium mt-0.5" style={{ color: T.ink }}>大模型应用工程师</div>
                </div>
                <div>
                  <div style={{ color: T.info }}>来源企业</div>
                  <div className="font-medium mt-0.5" style={{ color: T.ink }}>已脱敏（企业#0047）</div>
                </div>
                <div>
                  <div style={{ color: T.info }}>发布时间</div>
                  <div className="font-mono font-medium mt-0.5" style={{ color: T.ink }}>2026-05-12</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
              {isReviewer ? (
                <>
                  <div className="flex gap-2">
                    <Btn size="sm" icon={CheckCircle} onClick={() => advance("accept")}>审核通过</Btn>
                    <Btn variant="secondary" size="sm" icon={Pencil} onClick={() => advance("edit")}>修改后通过</Btn>
                    <Btn variant="ghost" size="sm" icon={X} onClick={() => advance("reject")}>驳回</Btn>
                    <Btn variant="ghost" size="sm" icon={AlertTriangle} onClick={() => toast("已标记为需更多证据")}>标记需更多证据</Btn>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className="flex-1 px-3 py-1.5 rounded-md text-[12px] outline-none"
                      style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                      placeholder="驳回原因（可选）"
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => advance("reject")}>拒绝</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => advance("later")}>稍后处理</Btn>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="secondary" size="sm" icon={Pencil} onClick={() => advance("edit")}>编辑后接受</Btn>
                    {selected === 2
                      ? <Btn size="sm" icon={Plus} onClick={() => setCreateSkillOpen(true)}>新建标准能力</Btn>
                      : <Btn size="sm" icon={CheckCircle} onClick={() => advance("accept")}>接受候选①</Btn>}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      {createSkillOpen && (
        <SkillFormModal
          onClose={() => setCreateSkillOpen(false)}
          onSave={(data) => {
            advance("accept");
            toast.success(`标准能力"${data.name}"已创建并接受`, { description: "已写入能力词典，等待词典审核" });
          }}
        />
      )}
    </div>
  );
}

export default ReviewWorkbenchPage;
