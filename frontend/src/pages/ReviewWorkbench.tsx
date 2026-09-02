import { useEffect, useState } from "react";
import { CheckCircle, Eye, Loader2, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Btn, Card, PageHeader, Pagination, UnderlineTabs } from "../components/ui";
import P from "../constants/palette";
import { isHttpErrorStatus } from "../services/http-error";
import {
  getSkillResolutionTask,
  loadCanonicalSkillPage,
  listSkillResolutionSimilarSkills,
  listSkillResolutionTasks,
  lookupCanonicalSkills,
  reviewSkillResolutionTask,
} from "../services/skill-resolution";
import type {
  CanonicalSkillItem,
  JobSkillData,
  JobSkillResolutionSimilarSkill,
  JobSkillResolutionTaskDetail,
  JobSkillResolutionTaskSummary,
  SkillResolutionAction,
} from "../types/api";

const PAGE_SIZE = 20;
const SKILL_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 1000;

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [jobSkills, setJobSkills] = useState<Record<string, JobSkillData>>({});
  const [taskStatusFilter, setTaskStatusFilter] = useState<"SUCCESS" | "FAILED" | "RUNNING" | "PENDING">("SUCCESS");
  const [reviewFilter, setReviewFilter] = useState<"all" | "PENDING" | "PASSED">("all");
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");

  const [detail, setDetail] = useState<JobSkillResolutionTaskDetail | null>(null);
  const [action, setAction] = useState<SkillResolutionAction>("SELECT_CANDIDATE");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [similarSkills, setSimilarSkills] = useState<JobSkillResolutionSimilarSkill[]>([]);
  const [skillNames, setSkillNames] = useState<Record<string, string>>({});
  const [skillResults, setSkillResults] = useState<CanonicalSkillItem[]>([]);
  const [skillTotal, setSkillTotal] = useState(0);
  const [skillPage, setSkillPage] = useState(1);
  const [skillRefreshKey, setSkillRefreshKey] = useState(0);
  const [loadingSimilarSkills, setLoadingSimilarSkills] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 任务索引、任务摘要与岗位技能正文分别批量解析，但只处理当前服务端页。
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listSkillResolutionTasks({
        page: page - 1,
        pageSize: PAGE_SIZE,
        taskStatus: taskStatusFilter,
        reviewStatus: reviewFilter === "all" ? undefined : reviewFilter,
      });
      setItems(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
      setJobSkills(Object.fromEntries(
        (response.data.jobSkills ?? []).map((jobSkill) => [jobSkill.id, jobSkill]),
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归一任务加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, reviewFilter, taskStatusFilter]);

  // eslint-disable-next-line react/set-state-in-effect -- 筛选与页码变化时需要同步发起当前服务端页请求。
  useEffect(() => { void fetchList(); }, [fetchList]);

  const initializeDetail = (nextDetail: JobSkillResolutionTaskDetail) => {
    setDetail(nextDetail);
    setKeyword("");
    setAppliedKeyword("");
    setSimilarSkills([]);
    setSkillNames(Object.fromEntries(nextDetail.canonicalSkills.map((skill) => [skill.id, skill.name])));
    setSkillResults([]);
    setSkillTotal(0);
    setSkillPage(1);
    setLoadingSimilarSkills(false);
    setSearching(false);
    setNewSkillName("");

    const persistedAction = nextDetail.task.resolutionAction as SkillResolutionAction;
    if (persistedAction === "SELECT_CANDIDATE" || persistedAction === "SELECT_EXISTING" || persistedAction === "CREATE_NEW") {
      setAction(persistedAction);
      setSelectedSkillId(String(nextDetail.task.selectedSkillId ?? ""));
      setLoadingSimilarSkills(persistedAction === "SELECT_EXISTING");
      setSearching(persistedAction === "SELECT_EXISTING");
      return;
    }
    if (nextDetail.task.taskStatus === "SUCCESS" && nextDetail.candidates.length > 0) {
      setAction("SELECT_CANDIDATE");
      setSelectedSkillId(String(nextDetail.candidates[0].skillId));
    } else {
      // AI 失败时后端只允许选择现有技能或新建技能。
      setAction("SELECT_EXISTING");
      setSelectedSkillId("");
      setLoadingSimilarSkills(true);
      setSearching(true);
    }
  };

  const openDetail = async (id: string | number) => {
    setOpeningId(String(id));
    try {
      const response = await getSkillResolutionTask(id);
      initializeDetail(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归一任务详情加载失败");
    } finally {
      setOpeningId("");
    }
  };

  // Top 5 只按待审技能向量计算一次，不与下方普通分页筛选混用。
  useEffect(() => {
    if (!detail || action !== "SELECT_EXISTING") return;
    let active = true;
    listSkillResolutionSimilarSkills(detail.task.id)
      .then(async (response) => {
        const nextSimilarSkills = response.data.items ?? [];
        if (!active) return;
        setSimilarSkills(nextSimilarSkills);
        const details = await lookupCanonicalSkills(nextSimilarSkills.map((skill) => skill.skillId));
        if (!active) return;
        setSkillNames((current) => ({
          ...current,
          ...Object.fromEntries(details.data.items.map((skill) => [skill.id, skill.name])),
        }));
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "相似技能加载失败");
      })
      .finally(() => {
        if (active) setLoadingSimilarSkills(false);
      });
    return () => { active = false; };
  }, [detail, action]);

  // 下方列表复用普通规范技能分页查询，按名称稳定排序，搜索只是可选筛选。
  useEffect(() => {
    if (!detail || action !== "SELECT_EXISTING") return;
    let active = true;
    loadCanonicalSkillPage({
      page: skillPage - 1,
      pageSize: SKILL_PAGE_SIZE,
      keyword: appliedKeyword || undefined,
    })
      .then((response) => {
        if (!active) return;
        setSkillResults(response.data.items ?? []);
        setSkillTotal(response.data.total ?? 0);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "规范技能列表加载失败");
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => { active = false; };
  }, [detail, action, skillPage, appliedKeyword, skillRefreshKey]);

  const filterSkills = () => {
    setSearching(true);
    setSkillPage(1);
    setAppliedKeyword(keyword.trim());
    setSelectedSkillId("");
    setSkillRefreshKey((value) => value + 1);
  };

  const changeSkillPage = (nextPage: number) => {
    setSearching(true);
    setSkillPage(nextPage);
    setSelectedSkillId("");
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
      // Top 5 与普通分页列表都可能包含 AI 候选，提交时保留后端的候选动作审计语义。
      const selectedSkillIsCandidate = detail.candidates.some(
        (candidate) => String(candidate.skillId) === String(selectedSkillId),
      );
      const effectiveAction = action === "SELECT_EXISTING" && selectedSkillIsCandidate
        ? "SELECT_CANDIDATE"
        : action;
      const body = effectiveAction === "CREATE_NEW"
        ? { resolutionAction: effectiveAction, newSkillName: newSkillName.trim() } as const
        : { resolutionAction: effectiveAction, skillId: selectedSkillId } as const;
      await reviewSkillResolutionTask(detail.task.id, body);
      toast.success("技能归一审核已提交");
      await openDetail(detail.task.id);
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
    setSimilarSkills([]);
    setSkillNames({});
    setSkillResults([]);
    setSkillTotal(0);
  };

  const canReview = detail?.task.reviewStatus === "PENDING"
    && (detail.task.taskStatus === "SUCCESS" || detail.task.taskStatus === "FAILED");
  const canSelectCandidate = detail?.task.taskStatus === "SUCCESS" && detail.candidates.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const skillPageCount = Math.max(1, Math.ceil(skillTotal / SKILL_PAGE_SIZE));

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), t("nav.reviewQueue")]}
        title="技能归一审核"
        description="将岗位分析产出的原始技能映射为规范技能，或创建新的规范技能"
        actions={<span className="font-mono text-[13px]" style={{ color: P.muted }}>共 {visibleItems.length} 项</span>}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>归一任务总数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{items.length}</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>全量拉取本地分组</span>
        </div>
        {[
          { label: "待审核", value: items.filter((i) => i.reviewStatus === "PENDING").length, chip: "需人工确认", bg: P.amberBg, color: P.amber },
          { label: "已归一", value: items.filter((i) => i.reviewStatus === "PASSED").length, chip: "已归一", bg: P.greenBg, color: P.green },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      <UnderlineTabs
        sections={[
          {
            value: taskStatusFilter,
            onChange: (value) => {
              setTaskStatusFilter(value as "SUCCESS" | "FAILED" | "RUNNING" | "PENDING");
              setReviewFilter("all");
              setPage(1);
            },
            options: [
              { value: "SUCCESS", label: "成功" },
              { value: "FAILED", label: "失败" },
              { value: "RUNNING", label: "处理中" },
              { value: "PENDING", label: "等待中" },
            ],
          },
          // 成功与失败任务可审核；运行中与等待中任务只展示执行状态。
          ...((taskStatusFilter === "SUCCESS" || taskStatusFilter === "FAILED") ? [{
            value: reviewFilter,
            onChange: (value: string) => {
              setReviewFilter(value as "all" | "PENDING" | "PASSED");
              setPage(1);
            },
            options: [
              { value: "all", label: "全部" },
              { value: "PENDING", label: "待复核" },
              { value: "PASSED", label: "已复核" },
            ],
          }] : []),
        ]}
      />

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: P.muted }}>加载中…</div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: P.muted }}>暂无符合条件的技能归一任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr style={{ background: P.sky }}>
                  {["任务 ID", "岗位 ID", "原始技能", "AI 状态", "审核状态", "归一结果", "尝试次数", "创建时间", "操作"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${P.border}` }}>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: P.muted }}>{item.id}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: P.muted }}>{item.jobId}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: P.ink }}>{item.skillName || "-"}</td>
                    <td className="px-4 py-3"><TaskStatus status={item.taskStatus} /></td>
                    <td className="px-4 py-3"><ReviewStatus status={item.reviewStatus} /></td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>
                      {item.resolutionAction ? `${ACTION_LABEL[item.resolutionAction] || item.resolutionAction} · ${item.selectedSkillId || "新建"}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: P.muted }}>{item.attempts}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: P.muted }}>{item.createdAt?.slice(0, 10) || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
                        style={{ color: P.primary }}
                        disabled={openingId === item.id}
                        onClick={() => void openDetail(item.id)}
                      >
                        {openingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                        {item.reviewStatus === "PENDING" ? "审核" : "查看"}
                      </button>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {visibleItems.length > 0 && (
        <Pagination page={page} totalPages={pageCount} onChange={setPage} total={visibleItems.length} />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div className="ml-auto flex h-full w-[680px] flex-col overflow-y-auto bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-4" style={{ borderBottom: `1px solid ${P.skySoft}` }}>
              <div>
                <h2 className="text-[15px] font-medium" style={{ color: P.ink }}>技能归一任务 #{detail.task.id}</h2>
                <div className="mt-1 flex items-center gap-2"><TaskStatus status={detail.task.taskStatus} /><ReviewStatus status={detail.task.reviewStatus} /></div>
              </div>
              <button onClick={closeDetail} style={{ color: P.muted }}><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-5 px-5 py-4">
              <Card title="岗位技能原始信息">
                <div className="space-y-3 px-4 py-3">
                  <InfoRow label="技能名称" value={detail.jobSkill.skillName || detail.task.skillName || "-"} />
                  <InfoRow label="熟练度" value={detail.jobSkill.skillProficiency || "-"} />
                  <InfoRow label="证据" value={detail.jobSkill.evidence || "-"} />
                  <InfoRow label="岗位 ID" value={detail.task.jobId || "-"} mono />
                  {detail.task.errorMsg && <InfoRow label="AI 错误" value={detail.task.errorMsg} danger />}
                </div>
              </Card>

              {!canReview && (
                <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: P.skySoft, color: P.muted }}>
                  {detail.task.reviewStatus === "PASSED"
                    ? `该任务已按“${ACTION_LABEL[detail.task.resolutionAction] || detail.task.resolutionAction}”完成归一，当前为只读状态。`
                    : "AI 任务仍在等待或运行中，候选生成完成后才能审核。"}
                </div>
              )}

              <section className="space-y-3">
                <div className="text-[12px] font-medium" style={{ color: P.muted }}>归一动作</div>
                <div className="grid grid-cols-3 gap-2">
                  <ActionButton
                    active={action === "SELECT_CANDIDATE"}
                    disabled={!canReview || !canSelectCandidate}
                    icon={CheckCircle}
                    label="选择 AI 候选"
                    onClick={() => {
                      setAction("SELECT_CANDIDATE");
                    }}
                  />
                  <ActionButton
                    active={action === "SELECT_EXISTING"}
                    disabled={!canReview}
                    icon={Search}
                    label="选择现有技能"
                    onClick={() => {
                      if (action !== "SELECT_EXISTING") setLoadingSimilarSkills(true);
                      setAction("SELECT_EXISTING");
                      setSelectedSkillId("");
                      setSearching(true);
                      setSkillRefreshKey((value) => value + 1);
                    }}
                  />
                  <ActionButton
                    active={action === "CREATE_NEW"}
                    disabled={!canReview}
                    icon={Plus}
                    label="新建规范技能"
                    onClick={() => {
                      setAction("CREATE_NEW");
                      setSelectedSkillId("");
                    }}
                  />
                </div>
                {detail.task.taskStatus === "FAILED" && detail.task.reviewStatus === "PENDING" && (
                  <div className="text-[12px]" style={{ color: P.muted }}>AI 处理失败，仍可选择现有规范技能或新建规范技能。</div>
                )}
              </section>

              {action === "SELECT_CANDIDATE" && (
                <section className="space-y-2">
                  <div className="text-[12px] font-medium" style={{ color: P.muted }}>AI 候选（按相似度排序）</div>
                  {detail.candidates.length === 0 ? (
                    <div className="rounded-md px-3 py-6 text-center text-[13px]" style={{ background: P.skySoft, color: P.muted }}>暂无候选</div>
                  ) : detail.candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.id}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left disabled:cursor-not-allowed"
                      style={{
                        border: `1px solid ${String(selectedSkillId) === String(candidate.skillId) ? P.primary : P.border}`,
                        background: String(selectedSkillId) === String(candidate.skillId) ? `${P.primary}10` : "white",
                      }}
                      disabled={!canReview}
                      onClick={() => {
                        setSelectedSkillId(String(candidate.skillId));
                      }}
                    >
                      <span className="font-mono text-[11px]" style={{ color: P.muted }}>#{candidate.rank}</span>
                      <span className="flex-1 text-[13px] font-medium" style={{ color: P.ink }}>{candidate.skillName}</span>
                      <span className="font-mono text-[12px]" style={{ color: P.muted }}>{(candidate.similarity * 100).toFixed(1)}%</span>
                    </button>
                  ))}
                </section>
              )}

              {action === "SELECT_EXISTING" && (
                <section className="space-y-4">
                  {detail.task.reviewStatus === "PASSED" && detail.task.selectedSkillId && (
                    <div className="rounded-md px-3 py-2 font-mono text-[12px]" style={{ background: P.skySoft, color: P.ink }}>
                      已选规范技能 ID：{detail.task.selectedSkillId}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <div className="text-[12px] font-medium" style={{ color: P.muted }}>相似技能 Top 5</div>
                      <div className="mt-1 text-[11px]" style={{ color: P.muted }}>
                        仅使用待审技能向量计算最相似的 5 个已向量化规范技能。
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-md" style={{ border: `1px solid ${P.border}` }}>
                      {loadingSimilarSkills ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-[12px]" style={{ color: P.muted }}>
                          <Loader2 size={13} className="animate-spin" />正在计算 Top 5…
                        </div>
                      ) : similarSkills.length === 0 ? (
                        <div className="px-3 py-8 text-center text-[12px]" style={{ color: P.muted }}>
                          待审技能暂无可用向量，无法计算相似技能
                        </div>
                      ) : similarSkills.map((skill) => (
                        <button
                          type="button"
                          key={skill.skillId}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed"
                          style={{
                            background: String(selectedSkillId) === String(skill.skillId) ? `${P.primary}10` : "transparent",
                            borderBottom: `1px solid ${P.skySoft}`,
                          }}
                          disabled={!canReview}
                          onClick={() => setSelectedSkillId(String(skill.skillId))}
                        >
                          <span className="w-6 font-mono text-[11px]" style={{ color: P.muted }}>#{skill.rank}</span>
                          <span className="flex-1 text-[13px] font-medium" style={{ color: P.ink }}>{skill.skillName}</span>
                          {detail.candidates.some((candidate) => String(candidate.skillId) === String(skill.skillId)) && (
                            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${P.primary}12`, color: P.primary }}>
                              AI 候选
                            </span>
                          )}
                          <span className="w-14 text-right font-mono text-[11px]" style={{ color: P.muted }}>
                            {(skill.similarity * 100).toFixed(1)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4" style={{ borderColor: P.skySoft }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-medium" style={{ color: P.muted }}>全部规范技能</div>
                        <div className="mt-1 text-[11px]" style={{ color: P.muted }}>
                          普通分页列表按技能名称稳定排序，可直接浏览；搜索仅用于可选筛选。
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px]" style={{ color: P.muted }}>共 {skillTotal} 项</span>
                    </div>
                    {canReview && (
                      <div className="flex gap-2">
                        <input
                          className="h-9 flex-1 rounded-md px-3 text-[13px] outline-none"
                          style={{ border: `1px solid ${P.border}`, color: P.ink }}
                          placeholder="可选：按技能名称筛选"
                          value={keyword}
                          onChange={(event) => setKeyword(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") filterSkills(); }}
                        />
                        <Btn size="sm" icon={Search} disabled={searching} onClick={filterSkills}>
                          筛选
                        </Btn>
                      </div>
                    )}
                    <div className="max-h-72 overflow-y-auto rounded-md" style={{ border: `1px solid ${P.border}` }}>
                      {searching ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-[12px]" style={{ color: P.muted }}>
                          <Loader2 size={13} className="animate-spin" />正在加载规范技能…
                        </div>
                      ) : skillResults.length === 0 ? (
                        <div className="px-3 py-8 text-center text-[12px]" style={{ color: P.muted }}>暂无符合条件的规范技能</div>
                      ) : skillResults.map((skill) => (
                          <button
                            type="button"
                            key={skill.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed"
                            style={{
                              background: String(selectedSkillId) === String(skill.id) ? `${P.primary}10` : "transparent",
                              borderBottom: `1px solid ${P.skySoft}`,
                            }}
                            disabled={!canReview}
                            onClick={() => setSelectedSkillId(String(skill.id))}
                          >
                            <span className="flex-1 text-[13px]" style={{ color: P.ink }}>{skill.name}</span>
                            {detail.candidates.some((candidate) => String(candidate.skillId) === String(skill.id)) && (
                              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${P.primary}12`, color: P.primary }}>
                                AI 候选
                              </span>
                            )}
                            <span className="font-mono text-[10px]" style={{ color: P.muted }}>ID {skill.id}</span>
                            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{
                              background: skill.is_embed ? `${P.green}12` : `${P.amber}12`,
                              color: skill.is_embed ? P.green : P.amber,
                            }}>
                              {skill.isEmbed ? "已向量化" : "未向量化"}
                            </span>
                          </button>
                        ))}
                    </div>
                    {skillTotal > 0 && (
                      <div className="pt-1">
                        <Pagination page={skillPage} totalPages={skillPageCount} onChange={changeSkillPage} disabled={searching} total={skillTotal} />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {action === "CREATE_NEW" && (
                <section className="space-y-2">
                  <div className="text-[12px] font-medium" style={{ color: P.muted }}>新规范技能名称</div>
                  {canReview ? (
                    <input
                      className="h-9 w-full rounded-md px-3 text-[13px] outline-none"
                      style={{ border: `1px solid ${P.border}`, color: P.ink }}
                      placeholder="请输入明确、去重后的规范技能名称"
                      value={newSkillName}
                      maxLength={100}
                      onChange={(event) => setNewSkillName(event.target.value)}
                    />
                  ) : (
                    <div className="rounded-md px-3 py-2 text-[13px]" style={{ background: P.skySoft, color: P.ink }}>
                      已通过本任务创建新规范技能
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${P.skySoft}` }}>
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

function TaskStatus({ status }: { status: string }) {
  const failed = status === "FAILED";
  const success = status === "SUCCESS";
  return (
    <span className="rounded px-2 py-0.5 text-[11px]" style={{
      background: failed ? "#fee2e2" : success ? "#dcfce7" : "#fef9c3",
      color: failed ? "#991b1b" : success ? "#166534" : "#854d0e",
    }}>
      {TASK_STATUS_LABEL[status] || status || "-"}
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
      {REVIEW_STATUS_LABEL[status] || status || "-"}
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
        border: `1px solid ${active ? P.primary : P.border}`,
        color: active ? "white" : P.ink,
        background: active ? P.primary : "white",
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
      <span style={{ color: P.muted }}>{label}</span>
      <span className={mono ? "font-mono" : ""} style={{ color: danger ? P.red : P.ink }}>{value}</span>
    </div>
  );
}

export default ReviewWorkbenchPage;
