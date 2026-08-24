// 岗位技能归一审核工作台：只暴露后端支持的三种互斥审核动作。
import { useEffect, useState } from "react";
import { CheckCircle, Eye, Loader2, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Btn, Card, PageHeader } from "../components/ui";
import T from "../constants/tokens";
import { isHttpErrorStatus } from "../services/http-error";
import {
  getSkillResolutionTask,
  listSkillResolutionTasks,
  reviewSkillResolutionTask,
  searchCanonicalSkills,
} from "../services/skill-resolution";
import type {
  CanonicalSkillItem,
  JobSkillResolutionTaskDetail,
  JobSkillResolutionTaskSummary,
  SkillResolutionAction,
} from "../types/api";

const PAGE_SIZE = 20;

const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING: "等待处理",
  RUNNING: "AI 处理中",
  SUCCESS: "候选已生成",
  FAILED: "AI 处理失败",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  PASSED: "已归一",
};

const ACTION_LABEL: Record<string, string> = {
  SELECT_CANDIDATE: "选择 AI 候选",
  SELECT_EXISTING: "选择现有规范技能",
  CREATE_NEW: "新建规范技能",
};

function ReviewWorkbenchPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JobSkillResolutionTaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [taskStatus, setTaskStatus] = useState("");
  const [reviewStatus, setReviewStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");

  const [detail, setDetail] = useState<JobSkillResolutionTaskDetail | null>(null);
  const [action, setAction] = useState<SkillResolutionAction>("SELECT_CANDIDATE");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [skillResults, setSkillResults] = useState<CanonicalSkillItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const response = await listSkillResolutionTasks({
        page: page - 1,
        pageSize: PAGE_SIZE,
        taskStatus: taskStatus || undefined,
        reviewStatus: reviewStatus || undefined,
      });
      setItems(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归一任务加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchList(); }, [page, taskStatus, reviewStatus]);

  const initializeDetail = (nextDetail: JobSkillResolutionTaskDetail) => {
    setDetail(nextDetail);
    setKeyword("");
    setSkillResults([]);
    setSearched(false);
    setNewSkillName("");

    const persistedAction = nextDetail.task.resolutionAction as SkillResolutionAction;
    if (persistedAction === "SELECT_CANDIDATE" || persistedAction === "SELECT_EXISTING" || persistedAction === "CREATE_NEW") {
      setAction(persistedAction);
      setSelectedSkillId(String(nextDetail.task.selectedSkillId ?? ""));
      return;
    }
    if (nextDetail.task.taskStatus === "SUCCESS" && nextDetail.candidates.length > 0) {
      setAction("SELECT_CANDIDATE");
      setSelectedSkillId(String(nextDetail.candidates[0].skillId));
    } else {
      // AI 失败时后端只允许选择现有技能或新建技能。
      setAction("SELECT_EXISTING");
      setSelectedSkillId("");
    }
  };

  const openDetail = async (id: string | number) => {
    setOpeningId(String(id));
    try {
      const response = await getSkillResolutionTask(id);
      initializeDetail(response.data.resolution);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归一任务详情加载失败");
    } finally {
      setOpeningId("");
    }
  };

  const searchSkills = async () => {
    if (!detail) return;
    setSearching(true);
    try {
      const response = await searchCanonicalSkills({ page: 0, pageSize: 50, keyword });
      const candidateIds = new Set(detail.candidates.map((candidate) => String(candidate.skillId)));
      // 后端要求候选技能只能走 SELECT_CANDIDATE；现有技能搜索中排除当前任务候选。
      setSkillResults((response.data.items ?? []).filter((skill) => !candidateIds.has(String(skill.id))));
      setSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "规范技能查询失败");
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!detail) return;
    if ((action === "SELECT_CANDIDATE" || action === "SELECT_EXISTING") && !selectedSkillId) {
      toast.error("请选择一个规范技能");
      return;
    }
    if (action === "CREATE_NEW" && !newSkillName.trim()) {
      toast.error("请输入新规范技能名称");
      return;
    }

    setSubmitting(true);
    try {
      const body = action === "CREATE_NEW"
        ? { resolutionAction: action, newSkillName: newSkillName.trim() } as const
        : { resolutionAction: action, skillId: selectedSkillId } as const;
      const response = await reviewSkillResolutionTask(detail.task.id, body);
      initializeDetail(response.data.resolution);
      toast.success("技能归一审核已提交");
      await fetchList();
    } catch (error) {
      if (isHttpErrorStatus(error, 409)) {
        toast.error("提交发生并发或技能身份冲突，已刷新最新状态");
        await openDetail(detail.task.id);
        await fetchList();
      } else {
        toast.error(error instanceof Error ? error.message : "归一审核提交失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setSkillResults([]);
    setSearched(false);
  };

  const canReview = detail?.task.reviewStatus === "PENDING"
    && (detail.task.taskStatus === "SUCCESS" || detail.task.taskStatus === "FAILED");
  const canSelectCandidate = detail?.task.taskStatus === "SUCCESS" && detail.candidates.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), t("nav.reviewQueue")]}
        title="技能归一审核"
        description="将岗位分析产出的原始技能映射为规范技能，或创建新的规范技能"
        actions={<span className="font-mono text-[13px]" style={{ color: T.info }}>共 {total} 项</span>}
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="AI 任务状态"
          value={taskStatus}
          options={[
            ["", "全部"],
            ["PENDING", "等待处理"],
            ["RUNNING", "AI 处理中"],
            ["SUCCESS", "候选已生成"],
            ["FAILED", "AI 处理失败"],
          ]}
          onChange={(value) => { setTaskStatus(value); setPage(1); }}
        />
        <FilterSelect
          label="审核状态"
          value={reviewStatus}
          options={[["", "全部"], ["PENDING", "待审核"], ["PASSED", "已归一"]]}
          onChange={(value) => { setReviewStatus(value); setPage(1); }}
        />
      </div>

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>加载中…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无符合条件的技能归一任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["任务 ID", "岗位 ID", "原始技能", "AI 状态", "审核状态", "归一结果", "尝试次数", "创建时间", "操作"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.id}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.jobId}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{item.skillName || "—"}</td>
                    <td className="px-4 py-3"><TaskStatus status={item.taskStatus} /></td>
                    <td className="px-4 py-3"><ReviewStatus status={item.reviewStatus} /></td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>
                      {item.resolutionAction ? `${ACTION_LABEL[item.resolutionAction] || item.resolutionAction} · ${item.selectedSkillId || "新建"}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.attempts}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.createdAt?.slice(0, 10) || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
                        style={{ color: T.teal }}
                        disabled={openingId === item.id}
                        onClick={() => void openDetail(item.id)}
                      >
                        {openingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                        {item.reviewStatus === "PENDING" ? "审核" : "查看"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Btn>
          <span style={{ color: T.info }}>{page} / {pageCount}</span>
          <Btn variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</Btn>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div className="ml-auto flex h-full w-[680px] flex-col overflow-y-auto bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <h2 className="text-[15px] font-medium" style={{ color: T.ink }}>技能归一任务 #{detail.task.id}</h2>
                <div className="mt-1 flex items-center gap-2"><TaskStatus status={detail.task.taskStatus} /><ReviewStatus status={detail.task.reviewStatus} /></div>
              </div>
              <button onClick={closeDetail} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-5 px-5 py-4">
              <Card title="岗位技能原始信息">
                <div className="space-y-3 px-4 py-3">
                  <InfoRow label="技能名称" value={detail.jobSkill.skillName || detail.task.skillName || "—"} />
                  <InfoRow label="熟练度" value={detail.jobSkill.skillProficiency || "—"} />
                  <InfoRow label="证据" value={detail.jobSkill.evidence || "—"} />
                  <InfoRow label="岗位 ID" value={detail.task.jobId || "—"} mono />
                  {detail.task.errorMsg && <InfoRow label="AI 错误" value={detail.task.errorMsg} danger />}
                </div>
              </Card>

              {!canReview && (
                <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: T.cloud, color: T.info }}>
                  {detail.task.reviewStatus === "PASSED"
                    ? `该任务已按“${ACTION_LABEL[detail.task.resolutionAction] || detail.task.resolutionAction}”完成归一，当前为只读状态。`
                    : "AI 任务仍在等待或运行中，候选生成完成后才能审核。"}
                </div>
              )}

              <section className="space-y-3">
                <div className="text-[12px] font-medium" style={{ color: T.info }}>归一动作</div>
                <div className="grid grid-cols-3 gap-2">
                  <ActionButton
                    active={action === "SELECT_CANDIDATE"}
                    disabled={!canReview || !canSelectCandidate}
                    icon={CheckCircle}
                    label="选择 AI 候选"
                    onClick={() => setAction("SELECT_CANDIDATE")}
                  />
                  <ActionButton
                    active={action === "SELECT_EXISTING"}
                    disabled={!canReview}
                    icon={Search}
                    label="选择现有技能"
                    onClick={() => { setAction("SELECT_EXISTING"); setSelectedSkillId(""); }}
                  />
                  <ActionButton
                    active={action === "CREATE_NEW"}
                    disabled={!canReview}
                    icon={Plus}
                    label="新建规范技能"
                    onClick={() => { setAction("CREATE_NEW"); setSelectedSkillId(""); }}
                  />
                </div>
                {detail.task.taskStatus === "FAILED" && detail.task.reviewStatus === "PENDING" && (
                  <div className="text-[12px]" style={{ color: T.info }}>AI 处理失败，仍可选择现有规范技能或新建规范技能。</div>
                )}
              </section>

              {action === "SELECT_CANDIDATE" && (
                <section className="space-y-2">
                  <div className="text-[12px] font-medium" style={{ color: T.info }}>AI 候选（按相似度排序）</div>
                  {detail.candidates.length === 0 ? (
                    <div className="rounded-md px-3 py-6 text-center text-[13px]" style={{ background: T.cloud, color: T.info }}>暂无候选</div>
                  ) : detail.candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.skillId}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left disabled:cursor-not-allowed"
                      style={{
                        border: `1px solid ${String(selectedSkillId) === String(candidate.skillId) ? T.teal : T.border}`,
                        background: String(selectedSkillId) === String(candidate.skillId) ? `${T.teal}10` : "white",
                      }}
                      disabled={!canReview}
                      onClick={() => setSelectedSkillId(String(candidate.skillId))}
                    >
                      <span className="font-mono text-[11px]" style={{ color: T.info }}>#{candidate.rank}</span>
                      <span className="flex-1 text-[13px] font-medium" style={{ color: T.ink }}>{candidate.skillName}</span>
                      <span className="font-mono text-[12px]" style={{ color: T.info }}>{(candidate.similarity * 100).toFixed(1)}%</span>
                    </button>
                  ))}
                </section>
              )}

              {action === "SELECT_EXISTING" && (
                <section className="space-y-2">
                  <div className="text-[12px] font-medium" style={{ color: T.info }}>全局规范技能搜索</div>
                  {canReview && (
                    <div className="flex gap-2">
                      <input
                        className="h-9 flex-1 rounded-md px-3 text-[13px] outline-none"
                        style={{ border: `1px solid ${T.border}`, color: T.ink }}
                        placeholder="输入技能名称关键词；当前 AI 候选会自动排除"
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") void searchSkills(); }}
                      />
                      <Btn size="sm" icon={Search} disabled={searching} onClick={() => void searchSkills()}>
                        {searching ? "搜索中…" : "搜索"}
                      </Btn>
                    </div>
                  )}
                  {detail.task.reviewStatus === "PASSED" && detail.task.selectedSkillId && (
                    <div className="rounded-md px-3 py-2 font-mono text-[12px]" style={{ background: T.cloud, color: T.ink }}>
                      已选规范技能 ID：{detail.task.selectedSkillId}
                    </div>
                  )}
                  {searched && (
                    <div className="max-h-60 overflow-y-auto rounded-md" style={{ border: `1px solid ${T.border}` }}>
                      {skillResults.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[12px]" style={{ color: T.info }}>未找到规范技能</div>
                      ) : skillResults.map((skill) => (
                        <button
                          type="button"
                          key={skill.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                          style={{
                            background: selectedSkillId === skill.id ? `${T.teal}10` : "transparent",
                            borderBottom: `1px solid ${T.cloud}`,
                          }}
                          onClick={() => setSelectedSkillId(skill.id)}
                        >
                          <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{skill.name}</span>
                          <span className="font-mono text-[11px]" style={{ color: T.info }}>{skill.id}</span>
                          <span className="rounded px-1.5 py-0.5 text-[10px]" style={{
                            background: skill.is_embed ? `${T.emerging}12` : `${T.pending}12`,
                            color: skill.is_embed ? T.emerging : T.pending,
                          }}>
                            {skill.is_embed ? "已向量化" : "未向量化"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {action === "CREATE_NEW" && (
                <section className="space-y-2">
                  <div className="text-[12px] font-medium" style={{ color: T.info }}>新规范技能名称</div>
                  {canReview ? (
                    <input
                      className="h-9 w-full rounded-md px-3 text-[13px] outline-none"
                      style={{ border: `1px solid ${T.border}`, color: T.ink }}
                      placeholder="请输入明确、去重后的规范技能名称"
                      value={newSkillName}
                      maxLength={100}
                      onChange={(event) => setNewSkillName(event.target.value)}
                    />
                  ) : (
                    <div className="rounded-md px-3 py-2 text-[13px]" style={{ background: T.cloud, color: T.ink }}>
                      已通过本任务创建新规范技能
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" onClick={closeDetail}>{canReview ? "取消" : "关闭"}</Btn>
              {canReview && (
                <Btn disabled={submitting} onClick={() => void submit()}>
                  {submitting ? "提交中…" : "确认归一"}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px]" style={{ color: T.info }}>{label}</span>
      <select
        className="h-9 min-w-44 rounded-md bg-white px-3 text-[13px] outline-none"
        style={{ border: `1px solid ${T.border}`, color: T.ink }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function TaskStatus({ status }: { status: string }) {
  const failed = status === "FAILED";
  const success = status === "SUCCESS";
  return (
    <span className="rounded px-2 py-0.5 text-[11px]" style={{
      background: failed ? "#fee2e2" : success ? "#dcfce7" : "#fef9c3",
      color: failed ? "#991b1b" : success ? "#166534" : "#854d0e",
    }}>
      {TASK_STATUS_LABEL[status] || status || "—"}
    </span>
  );
}

function ReviewStatus({ status }: { status: string }) {
  const passed = status === "PASSED";
  return (
    <span className="rounded px-2 py-0.5 text-[11px]" style={{
      background: passed ? "#dcfce7" : "#fef9c3",
      color: passed ? "#166534" : "#854d0e",
    }}>
      {REVIEW_STATUS_LABEL[status] || status || "—"}
    </span>
  );
}

function ActionButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof CheckCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        border: `1px solid ${active ? T.teal : T.border}`,
        color: active ? "white" : T.ink,
        background: active ? T.teal : "white",
      }}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={13} />{label}
    </button>
  );
}

function InfoRow({ label, value, mono = false, danger = false }: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 text-[12px]">
      <span style={{ color: T.info }}>{label}</span>
      <span className={mono ? "font-mono" : ""} style={{ color: danger ? T.risk : T.ink }}>{value}</span>
    </div>
  );
}

export default ReviewWorkbenchPage;
