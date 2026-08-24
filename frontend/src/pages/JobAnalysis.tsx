// 分页查看岗位分析任务，确认专业、职业并逐条审核技能结果。
import { useEffect, useState, type ReactNode } from "react";
import { Eye, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DirectoryPicker from "../components/job-analysis/DirectoryPicker";
import { Btn, Card, PageHeader } from "../components/ui";
import T from "../constants/tokens";
import { isHttpErrorStatus } from "../services/http-error";
import { getJobAnalysisTask, listJobAnalysisTasks, reviewJobAnalysisTask } from "../services/job-analysis";
import type {
  JobAnalysisResult,
  JobAnalysisSkillReviewInput,
  JobAnalysisTaskDetail,
  JobAnalysisTaskSummary,
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

type ReviewAction = "APPROVE" | "APPROVE_WITH_EDIT" | "REJECT";
const PROFICIENCIES = ["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"] as const;

function candidateReviewAction(value: string): ReviewAction {
  return value === "APPROVE_WITH_EDIT" || value === "REJECT" ? value : "APPROVE";
}

export default function JobAnalysisPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JobAnalysisTaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [openingId, setOpeningId] = useState("");

  const [detail, setDetail] = useState<JobAnalysisTaskDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [majorId, setMajorId] = useState<string | number>("");
  const [majorName, setMajorName] = useState("");
  const [occupationId, setOccupationId] = useState<string | number>("");
  const [occupationName, setOccupationName] = useState("");
  const [skillReviews, setSkillReviews] = useState<Record<string, JobAnalysisSkillReviewInput>>({});

  const fetchList = async () => {
    setLoading(true);
    try {
      const response = await listJobAnalysisTasks({
        page: page - 1,
        pageSize: 20,
        reviewStatus: filterStatus || undefined,
      });
      setItems(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "岗位分析任务加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchList(); }, [page, filterStatus]);

  const initializeDetail = (nextDetail: JobAnalysisTaskDetail) => {
    setDetail(nextDetail);

    const selectedMajorId = nextDetail.task.selectedMajorId ?? nextDetail.majorCandidates[0]?.majorId ?? "";
    const selectedMajor = nextDetail.majorCandidates.find((item) => String(item.majorId) === String(selectedMajorId));
    setMajorId(selectedMajorId);
    setMajorName(selectedMajor?.majorName ?? (selectedMajorId ? `专业 #${selectedMajorId}` : ""));

    const selectedOccupationId = nextDetail.task.selectedOccupationId ?? nextDetail.candidates[0]?.occupationId ?? "";
    const selectedOccupation = nextDetail.candidates.find(
      (item) => String(item.occupationId) === String(selectedOccupationId),
    );
    setOccupationId(selectedOccupationId);
    setOccupationName(selectedOccupation?.occupationName ?? (
      selectedOccupationId ? `职业 #${selectedOccupationId}` : ""
    ));

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
      initializeDetail(response.data.analysis);
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
      />

      <div className="flex items-center gap-2">
        {["", "PENDING", "PASSED", "REJECTED"].map((status) => (
          <button
            key={status}
            className="rounded-md px-3 py-1.5 text-[13px] transition-colors"
            style={{
              border: `1px solid ${filterStatus === status ? T.teal : T.border}`,
              color: filterStatus === status ? "white" : T.ink,
              background: filterStatus === status ? T.teal : "white",
            }}
            onClick={() => { setFilterStatus(status); setPage(1); }}
          >
            {status === "" ? "全部" : REVIEW_STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无岗位分析任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["ID", "岗位名称", "岗位原专业", "分析进度", "审核状态", "确认结果", "创建时间", "操作"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.id}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{item.jobName || "—"}</td>
                    <td className="max-w-44 px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.jobMajor || "—"}</td>
                    <td className="px-4 py-3 text-[11px] leading-5" style={{ color: T.info }}>
                      <div>专业：{TASK_STATUS_LABEL[item.majorAnalysisStatus] || item.majorAnalysisStatus || "—"}</div>
                      <div>职业：{TASK_STATUS_LABEL[item.occupationAnalysisStatus] || item.occupationAnalysisStatus || "—"}</div>
                      <div>JD：{TASK_STATUS_LABEL[item.jdAnalysisStatus] || item.jdAnalysisStatus || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ReviewStatus status={item.reviewStatus} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] leading-5" style={{ color: T.info }}>
                      <div>专业：{item.selectedMajorId || "—"}</div>
                      <div>职业：{item.selectedOccupationId || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>
                      {item.createdAt?.slice(0, 10) || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
                        style={{ color: T.teal }}
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

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button
            className="rounded-md px-3 py-1.5 disabled:opacity-30"
            style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >上一页</button>
          <span style={{ color: T.info }}>{page} / {Math.max(1, Math.ceil(total / 20))}</span>
          <button
            className="rounded-md px-3 py-1.5 disabled:opacity-30"
            style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((current) => current + 1)}
          >下一页</button>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div
            className="ml-auto flex h-full w-[720px] flex-col overflow-y-auto bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>
                  {detail.task.jobName || `任务 #${detail.task.id}`}
                </h3>
                <div className="mt-0.5 text-[12px]" style={{ color: T.info }}>
                  任务 {TASK_STATUS_LABEL[detail.task.taskStatus] || detail.task.taskStatus} · 模型 {detail.task.modelName || "—"}
                </div>
              </div>
              <button onClick={closeDetail} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-6 px-5 py-4">
              {!reviewable && (
                <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: T.cloud, color: T.info }}>
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
                  name: candidate.majorName,
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
                  name: candidate.occupationName,
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
                <div className="mb-2 text-[12px] font-medium" style={{ color: T.info }}>
                  技能结果审核（{detail.results.length} 项，提交时需全部覆盖）
                </div>
                {detail.results.length === 0 ? (
                  <div className="py-6 text-center text-[13px]" style={{ color: T.info }}>
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

            <div className="flex shrink-0 justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
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
      {REVIEW_STATUS_LABEL[status] || status || "—"}
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
      <div className="text-[12px] font-medium" style={{ color: T.info }}>{title}</div>
      {!disabled && (
        <div>
          <div className="mb-1 text-[11px]" style={{ color: T.info }}>{candidateLabel}</div>
          <select
            className="w-full rounded-md px-3 py-2 text-[13px] outline-none"
            style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
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
        {!disabled && <div className="mb-1 text-[11px]" style={{ color: T.info }}>完整目录选择</div>}
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
    <div className="space-y-2 rounded-lg p-3" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium" style={{ color: T.ink }}>{result.skillName}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: T.info }}>熟练度：{result.skillProficiency || "—"}</div>
          {result.evidence && <div className="mt-0.5 text-[12px]" style={{ color: T.info }}>证据：{result.evidence}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions.map((item) => (
            <button
              key={item.key}
              className="rounded px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                border: `1px solid ${action === item.key ? T.teal : T.border}`,
                color: action === item.key ? "white" : T.ink,
                background: action === item.key ? T.teal : "white",
              }}
              disabled={disabled}
              onClick={() => onAction(item.key)}
            >{item.label}</button>
          ))}
        </div>
      </div>
      {action === "APPROVE_WITH_EDIT" && (
        <div className="space-y-2 pt-1" style={{ borderTop: `1px dashed ${T.border}` }}>
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
      <label className="mb-1 block text-[11px]" style={{ color: T.info }}>{label}</label>
      <input
        className="w-full rounded px-2 py-1.5 text-[13px] outline-none disabled:opacity-70"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
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
      <label className="mb-1 block text-[11px]" style={{ color: T.info }}>熟练度</label>
      <select
        className="w-full rounded px-2 py-1.5 text-[13px] outline-none disabled:opacity-70"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
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
