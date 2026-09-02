// 分页查看岗位分析任务，确认专业、职业并逐条审核技能结果。
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Eye, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DirectoryPicker from "../components/job-analysis/DirectoryPicker";
import { Btn, Card, PageHeader, UnderlineTabs, Pagination } from "../components/ui";
import P from "../constants/palette";
import { isHttpErrorStatus } from "../services/http-error";
import { getJobAnalysisTask, listJobAnalysisTasks, reviewJobAnalysisTask } from "../services/job-analysis";
import { lookupMajors, lookupOccupations } from "../services/occupation";
import type {
  JobAnalysisResult,
  JobAnalysisSkillReviewInput,
  JobAnalysisTaskDetail,
  JobAnalysisTaskSummary,
  JobData,
} from "../types/api";

const REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  PASSED: "已通过",
  REJECTED: "已拒绝",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING: "等待中",
  RUNNING: "处理中",
  SUCCESS: "已完成",
  FAILED: "失败",
};

const PAGE_SIZE = 20;

type ReviewAction = "APPROVE" | "APPROVE_WITH_EDIT" | "REJECT";
const PROFICIENCIES = ["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"] as const;

function candidateReviewAction(value: string): ReviewAction {
  return value === "APPROVE_WITH_EDIT" || value === "REJECT" ? value : "APPROVE";
}

export default function JobAnalysisPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JobAnalysisTaskSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [taskStatusFilter, setTaskStatusFilter] = useState<"SUCCESS" | "FAILED" | "RUNNING" | "PENDING">("SUCCESS");
  const [reviewFilter, setReviewFilter] = useState<"all" | "PENDING" | "PASSED" | "REJECTED">("all");
  const [openingId, setOpeningId] = useState("");
  const [jobs, setJobs] = useState<Record<string, JobData>>({});
  const [majorNames, setMajorNames] = useState<Record<string, string>>({});
  const [occupationNames, setOccupationNames] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<JobAnalysisTaskDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [majorId, setMajorId] = useState<string | number>("");
  const [majorName, setMajorName] = useState("");
  const [occupationId, setOccupationId] = useState<string | number>("");
  const [occupationName, setOccupationName] = useState("");
  const [skillReviews, setSkillReviews] = useState<Record<string, JobAnalysisSkillReviewInput>>({});

  // 列表始终只加载当前服务端页，任务摘要与目录名称分别走批量详情接口。
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listJobAnalysisTasks({
        page: page - 1,
        pageSize: PAGE_SIZE,
        taskStatus: taskStatusFilter,
        reviewStatus: reviewFilter === "all" ? undefined : reviewFilter,
      });
      const nextItems = response.data.items ?? [];
      setItems(nextItems);
      setTotal(response.data.total ?? 0);
      setJobs(Object.fromEntries((response.data.jobs ?? []).map((job) => [job.id, job])));
      const [majors, occupations] = await Promise.all([
        lookupMajors(nextItems.flatMap((item) => item.selectedMajorId ? [item.selectedMajorId] : [])),
        lookupOccupations(nextItems.flatMap((item) => item.selectedOccupationId ? [item.selectedOccupationId] : [])),
      ]);
      setMajorNames(Object.fromEntries(majors.data.items.map((item) => [String(item.id), item.name])));
      setOccupationNames(Object.fromEntries(occupations.data.items.map((item) => [String(item.id), item.name])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "岗位分析任务加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, reviewFilter, taskStatusFilter]);

  // eslint-disable-next-line react/set-state-in-effect -- 筛选与页码变化时需要同步发起当前服务端页请求。
  useEffect(() => { void fetchList(); }, [fetchList]);

  const initializeDetail = async (nextDetail: JobAnalysisTaskDetail) => {
    setDetail(nextDetail);
    if (nextDetail.job) {
      setJobs((current) => ({ ...current, [nextDetail.job!.id]: nextDetail.job! }));
    }

    const [majors, occupations] = await Promise.all([
      lookupMajors([
        ...nextDetail.majorCandidates.map((item) => item.majorId),
        ...(nextDetail.task.selectedMajorId ? [nextDetail.task.selectedMajorId] : []),
      ]),
      lookupOccupations([
        ...nextDetail.candidates.map((item) => item.occupationId),
        ...(nextDetail.task.selectedOccupationId ? [nextDetail.task.selectedOccupationId] : []),
      ]),
    ]);
    const nextMajorNames = Object.fromEntries(majors.data.items.map((item) => [String(item.id), item.name]));
    const nextOccupationNames = Object.fromEntries(occupations.data.items.map((item) => [String(item.id), item.name]));
    setMajorNames((current) => ({ ...current, ...nextMajorNames }));
    setOccupationNames((current) => ({ ...current, ...nextOccupationNames }));

    const selectedMajorId = nextDetail.task.selectedMajorId ?? nextDetail.majorCandidates[0]?.majorId ?? "";
    setMajorId(selectedMajorId);
    setMajorName(selectedMajorId ? nextMajorNames[String(selectedMajorId)] || `专业 #${selectedMajorId}` : "");

    const selectedOccupationId = nextDetail.task.selectedOccupationId ?? nextDetail.candidates[0]?.occupationId ?? "";
    setOccupationId(selectedOccupationId);
    setOccupationName(selectedOccupationId
      ? nextOccupationNames[String(selectedOccupationId)] || `职业 #${selectedOccupationId}`
      : "");

    const reviews: Record<string, JobAnalysisSkillReviewInput> = {};
    nextDetail.results.forEach((result) => {
      reviews[String(result.id)] = {
        resultId: result.id,
        action: candidateReviewAction(result.reviewAction),
        skillName: result.reviewedSkillName || result.skillName,
        skillProficiency: result.reviewedSkillProficiency || result.skillProficiency,
        evidence: result.reviewedEvidence || result.evidence,
      };
    });
    setSkillReviews(reviews);
  };

  const openDetail = async (id: string | number) => {
    setOpeningId(String(id));
    try {
      const response = await getJobAnalysisTask(id);
      await initializeDetail(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "岗位分析详情加载失败");
    } finally {
      setOpeningId("");
    }
  };

  const setAction = (resultId: string | number, action: ReviewAction) => {
    setSkillReviews((previous) => ({
      ...previous,
      [String(resultId)]: { ...previous[String(resultId)], resultId, action },
    }));
  };

  const updateField = (
    resultId: string | number,
    field: "skillName" | "skillProficiency" | "evidence",
    value: string,
  ) => {
    setSkillReviews((previous) => ({
      ...previous,
      [String(resultId)]: { ...previous[String(resultId)], resultId, [field]: value },
    }));
  };

  const submitReview = async () => {
    if (!detail) return;
    if (!majorId) {
      toast.error("请选择最终专业");
      return;
    }
    if (!occupationId) {
      toast.error("请选择最终职业");
      return;
    }
    const reviews: JobAnalysisSkillReviewInput[] = [];
    for (const result of detail.results) {
      const review = skillReviews[String(result.id)] ?? { resultId: result.id, action: "APPROVE" as const };
      if (review.action === "APPROVE_WITH_EDIT") {
        const proficiency = review.skillProficiency?.trim().toUpperCase() ?? "";
        if (!review.skillName?.trim() || review.skillName.trim().length > 100
          || !PROFICIENCIES.includes(proficiency as typeof PROFICIENCIES[number]) || !review.evidence?.trim()) {
          toast.error("修改后通过的技能需填写不超过 100 字的名称、四档熟练度和证据");
          return;
        }
        reviews.push({
          resultId: review.resultId,
          action: review.action,
          skillName: review.skillName.trim(),
          skillProficiency: proficiency,
          evidence: review.evidence.trim(),
        });
      } else {
        // 非编辑动作不携带后端仅为 APPROVE_WITH_EDIT 定义的字段。
        reviews.push({ resultId: review.resultId, action: review.action });
      }
    }

    setSubmitting(true);
    try {
      await reviewJobAnalysisTask(detail.task.id, {
        majorId,
        occupationId,
        skillReviews: reviews,
      });
      toast.success("岗位分析审核已提交");
      closeDetail();
      await fetchList();
    } catch (error) {
      if (isHttpErrorStatus(error, 409)) {
        toast.error("该任务已被其他审核人处理，已刷新最新状态");
        await openDetail(detail.task.id);
        await fetchList();
      } else {
        toast.error(error instanceof Error ? error.message : "审核提交失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setMajorId("");
    setMajorName("");
    setOccupationId("");
    setOccupationName("");
    setSkillReviews({});
  };

  const reviewable = detail?.task.reviewStatus === "PENDING" && detail.task.taskStatus === "SUCCESS";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), "岗位分析审核"]}
        title="岗位分析审核"
        description="确认岗位对应的专业、职业，并逐条审核 JD 技能分析结果"
        actions={<span className="font-mono text-[13px]" style={{ color: T.info }}>共 {total} 项</span>}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>分析任务总数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{items.length}</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>全量拉取本地分组</span>
        </div>
        {[
          { label: "待复核", value: items.filter((i) => i.reviewStatus === "PENDING").length, chip: "需人工确认", bg: P.amberBg, color: P.amber },
          { label: "已通过", value: items.filter((i) => i.reviewStatus === "PASSED").length, chip: "已归一", bg: P.greenBg, color: P.green },
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
          // 只有成功任务进入岗位分析复核，审核状态使用后端单值筛选。
          ...(taskStatusFilter === "SUCCESS" ? [{
            value: reviewFilter,
            onChange: (value: string) => {
              setReviewFilter(value as "all" | "PENDING" | "PASSED" | "REJECTED");
              setPage(1);
            },
            options: [
              { value: "all", label: "全部" },
              { value: "PENDING", label: "待复核" },
              { value: "PASSED", label: "已通过" },
              { value: "REJECTED", label: "已拒绝" },
            ],
          }] : []),
        ]}
      />

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: P.muted }}>{t("common.loading")}</div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: P.muted }}>暂无岗位分析任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead>
                <tr style={{ background: P.sky }}>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>岗位名称</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>岗位原专业</th>
                  {taskStatusFilter === "processing" && (
                    <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>分析进度</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>确认结果</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>创建时间</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>审核状态</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: P.primaryDeep }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${P.border}` }}>
                    <td className="px-4 py-2 font-medium" style={{ color: P.ink }}>{item.jobName || "-"}</td>
                    <td className="max-w-44 px-4 py-2 text-[12px]" style={{ color: P.muted }}>{item.jobMajor || "-"}</td>
                    {taskStatusFilter === "processing" && (
                      <td className="px-4 py-2 text-[11px] leading-5" style={{ color: P.muted }}>
                        <div>专业：{TASK_STATUS_LABEL[item.majorAnalysisStatus] || item.majorAnalysisStatus || "-"}</div>
                        <div>职业：{TASK_STATUS_LABEL[item.occupationAnalysisStatus] || item.occupationAnalysisStatus || "-"}</div>
                        <div>JD：{TASK_STATUS_LABEL[item.jdAnalysisStatus] || item.jdAnalysisStatus || "-"}</div>
                      </td>
                    )}
                    <td className="px-4 py-2 truncate" title={`专业:${item.selectedMajorId || "-"} / 职业:${item.selectedOccupationId || "-"}`}>
                      <span className="font-mono text-[11px]" style={{ color: P.muted }}>
                        专业:{item.selectedMajorId || "-"}
                      </span>
                      <span className="mx-1.5" style={{ color: P.border }}>/</span>
                      <span className="font-mono text-[11px]" style={{ color: P.muted }}>
                        职业:{item.selectedOccupationId || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[12px]" style={{ color: P.muted }}>
                      {item.createdAt?.slice(0, 10) || "-"}
                    </td>
                    <td className="px-4 py-2">
                      <ReviewStatus status={item.reviewStatus} />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
                        style={{ color: P.primary }}
                        disabled={openingId === item.id}
                        onClick={() => void openDetail(item.id)}
                      >
                        <Eye size={12} />{item.reviewStatus === "PENDING" ? "审核" : "查看"}
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
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          total={total}
          onChange={setPage}
          disabled={loading}
        />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div
            className="ml-auto flex h-full w-[720px] flex-col overflow-y-auto bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-4" style={{ borderBottom: `1px solid ${P.skySoft}` }}>
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: P.ink }}>
                  {detail.task.jobName || `任务 #${detail.task.id}`}
                </h3>
                <div className="mt-0.5 text-[12px]" style={{ color: P.muted }}>
                  专业 {detail.task.jobMajor || "-"} · 任务 {TASK_STATUS_LABEL[detail.task.taskStatus] || detail.task.taskStatus} · 模型 {detail.task.modelName || "-"}
                </div>
              </div>
              <button onClick={closeDetail} style={{ color: P.muted }}><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-6 px-5 py-4">
              {!reviewable && (
                <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: P.skySoft, color: P.muted }}>
                  {detail.task.reviewStatus !== "PENDING"
                    ? "该任务已完成审核，当前为只读状态。"
                    : "分析任务尚未成功完成，暂不能提交审核。"}
                </div>
              )}

              <DirectorySection
                title="确认专业"
                candidateLabel="AI 专业候选"
                value={majorId}
                candidates={detail.majorCandidates.map((candidate) => ({
                  id: candidate.majorId,
                  name: majorNames[candidate.majorId] || `专业 #${candidate.majorId}`,
                  similarity: candidate.similarity,
                }))}
                disabled={!reviewable}
                onCandidate={(id, name) => { setMajorId(id); setMajorName(name); }}
              >
                <DirectoryPicker
                  key={`major-${detail.task.id}`}
                  kind="major"
                  selectedId={majorId || null}
                  selectedName={majorName}
                  disabled={!reviewable}
                  onSelect={(id, name) => { setMajorId(id); setMajorName(name); }}
                />
              </DirectorySection>

              <DirectorySection
                title="确认职业"
                candidateLabel="AI 职业候选"
                value={occupationId}
                candidates={detail.candidates.map((candidate) => ({
                  id: candidate.occupationId,
                  name: occupationNames[candidate.occupationId] || `职业 #${candidate.occupationId}`,
                  similarity: candidate.similarity,
                }))}
                disabled={!reviewable}
                onCandidate={(id, name) => { setOccupationId(id); setOccupationName(name); }}
              >
                <DirectoryPicker
                  key={`occupation-${detail.task.id}`}
                  kind="occupation"
                  selectedId={occupationId || null}
                  selectedName={occupationName}
                  disabled={!reviewable}
                  onSelect={(id, name) => { setOccupationId(id); setOccupationName(name); }}
                />
              </DirectorySection>

              <section>
                <div className="mb-2 text-[12px] font-medium" style={{ color: P.muted }}>
                  技能结果审核（{detail.results.length} 项，提交时需全部覆盖）
                </div>
                {detail.results.length === 0 ? (
                  <div className="py-6 text-center text-[13px]" style={{ color: P.muted }}>
                    本任务没有技能分析结果，可直接确认专业与职业
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.results.map((result) => (
                      <SkillReviewItem
                        key={String(result.id)}
                        result={result}
                        review={skillReviews[String(result.id)]}
                        disabled={!reviewable}
                        onAction={(action) => setAction(result.id, action)}
                        onField={(field, value) => updateField(result.id, field, value)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${P.skySoft}` }}>
              <Btn variant="secondary" onClick={closeDetail}>{reviewable ? "取消" : "关闭"}</Btn>
              {reviewable && (
                <Btn onClick={() => void submitReview()} disabled={submitting}>
                  {submitting ? "提交中…" : "提交审核"}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStatus({ status }: { status: string }) {
  const passed = status === "PASSED";
  const rejected = status === "REJECTED";
  return (
    <span
      className="rounded px-2 py-0.5 text-[12px]"
      style={{
        background: passed ? "#dcfce7" : rejected ? "#fee2e2" : "#fef9c3",
        color: passed ? "#166534" : rejected ? "#991b1b" : "#854d0e",
      }}
    >
      {REVIEW_STATUS_LABEL[status] || status || "-"}
    </span>
  );
}

function DirectorySection({
  title,
  candidateLabel,
  value,
  candidates,
  disabled,
  onCandidate,
  children,
}: {
  title: string;
  candidateLabel: string;
  value: string | number;
  candidates: Array<{ id: string | number; name: string; similarity: number }>;
  disabled: boolean;
  onCandidate: (id: string | number, name: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="text-[12px] font-medium" style={{ color: P.muted }}>{title}</div>
      {!disabled && (
        <div>
          <div className="mb-1 text-[11px]" style={{ color: P.muted }}>{candidateLabel}</div>
          <select
            className="w-full rounded-md px-3 py-2 text-[13px] outline-none"
            style={{ background: P.skySoft, border: `1px solid ${P.border}`, color: P.ink }}
            value={String(value)}
            onChange={(event) => {
              const candidate = candidates.find((item) => String(item.id) === event.target.value);
              if (candidate) onCandidate(candidate.id, candidate.name);
            }}
          >
            <option value="">请选择候选…</option>
            {value && !candidates.some((item) => String(item.id) === String(value)) && (
              <option value={String(value)}>当前目录选择（{value}）</option>
            )}
            {candidates.map((candidate) => (
              <option key={String(candidate.id)} value={String(candidate.id)}>
                {candidate.name}（相似度 {(candidate.similarity * 100).toFixed(1)}%）
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        {!disabled && <div className="mb-1 text-[11px]" style={{ color: P.muted }}>完整目录选择</div>}
        {children}
      </div>
    </section>
  );
}

function SkillReviewItem({ result, review, disabled, onAction, onField }: {
  result: JobAnalysisResult;
  review?: JobAnalysisSkillReviewInput;
  disabled: boolean;
  onAction: (action: ReviewAction) => void;
  onField: (field: "skillName" | "skillProficiency" | "evidence", value: string) => void;
}) {
  const action = review?.action ?? "APPROVE";
  const actions: Array<{ key: ReviewAction; label: string }> = [
    { key: "APPROVE", label: "通过" },
    { key: "APPROVE_WITH_EDIT", label: "修改后通过" },
    { key: "REJECT", label: "拒绝" },
  ];

  return (
    <div className="space-y-2 rounded-lg p-3" style={{ background: P.skySoft, border: `1px solid ${P.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium" style={{ color: P.ink }}>{result.skillName}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: P.muted }}>熟练度：{result.skillProficiency || "-"}</div>
          {result.evidence && <div className="mt-0.5 text-[12px]" style={{ color: P.muted }}>证据：{result.evidence}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions.map((item) => (
            <button
              key={item.key}
              className="rounded px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                border: `1px solid ${action === item.key ? P.primary : P.border}`,
                color: action === item.key ? "white" : P.ink,
                background: action === item.key ? P.primary : "white",
              }}
              disabled={disabled}
              onClick={() => onAction(item.key)}
            >{item.label}</button>
          ))}
        </div>
      </div>
      {action === "APPROVE_WITH_EDIT" && (
        <div className="space-y-2 pt-1" style={{ borderTop: `1px dashed ${P.border}` }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="技能名称" value={review?.skillName ?? ""} maxLength={100} disabled={disabled} onChange={(value) => onField("skillName", value)} />
            <ProficiencyField value={review?.skillProficiency ?? ""} disabled={disabled} onChange={(value) => onField("skillProficiency", value)} />
          </div>
          <Field label="证据" value={review?.evidence ?? ""} disabled={disabled} onChange={(value) => onField("evidence", value)} />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px]" style={{ color: P.muted }}>{label}</label>
      <input
        className="w-full rounded px-2 py-1.5 text-[13px] outline-none disabled:opacity-70"
        style={{ background: "white", border: `1px solid ${P.border}`, color: P.ink }}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProficiencyField({ value, disabled, onChange }: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const normalized = value.toUpperCase();
  return (
    <div>
      <label className="mb-1 block text-[11px]" style={{ color: P.muted }}>熟练度</label>
      <select
        className="w-full rounded px-2 py-1.5 text-[13px] outline-none disabled:opacity-70"
        style={{ background: "white", border: `1px solid ${P.border}`, color: P.ink }}
        value={PROFICIENCIES.includes(normalized as typeof PROFICIENCIES[number]) ? normalized : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择</option>
        {PROFICIENCIES.map((proficiency) => <option key={proficiency} value={proficiency}>{proficiency}</option>)}
      </select>
    </div>
  );
}
