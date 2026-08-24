// 分页查看岗位分析任务，进入详情确认职业并逐条审核技能结果。
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Eye } from "lucide-react";
import T from "../constants/tokens";
import { listJobAnalysisTasks, getJobAnalysisTask, reviewJobAnalysisTask } from "../services/job-analysis";
import type {
  JobAnalysisTaskSummary, JobAnalysisTaskDetail, JobAnalysisResult, JobAnalysisSkillReviewInput,
} from "../types/api";
import { PageHeader, Card, Btn } from "../components/ui";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  PASSED: "已通过",
  REJECTED: "已拒绝",
};

type ReviewAction = "APPROVE" | "APPROVE_WITH_EDIT" | "REJECT";

export default function JobAnalysisPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JobAnalysisTaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  // 详情抽屉
  const [detail, setDetail] = useState<JobAnalysisTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 审核状态：职业 + 每条技能结果的动作
  const [occupationId, setOccupationId] = useState<string | number>("");
  const [skillReviews, setSkillReviews] = useState<Record<string, JobAnalysisSkillReviewInput>>({});

  const fetchList = () => {
    setLoading(true);
    listJobAnalysisTasks({ page: page - 1, pageSize: 20, reviewStatus: filterStatus || undefined })
      .then((res) => { setItems(res.data.items ?? []); setTotal(res.data.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [page, filterStatus]);

  const openDetail = async (id: string | number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await getJobAnalysisTask(id);
      const d = res.data.analysis;
      setDetail(d);
      // 预填职业：优先已选，否则取 AI 候选第一
      const chosen = d.task.selectedOccupationId || d.candidates[0]?.occupationId || "";
      setOccupationId(chosen);
      // 预填技能审核：沿用已有 reviewAction，默认 APPROVE
      const map: Record<string, JobAnalysisSkillReviewInput> = {};
      d.results.forEach((r) => {
        map[String(r.id)] = {
          resultId: r.id,
          action: (r.reviewAction as ReviewAction) || "APPROVE",
          skillName: r.reviewedSkillName || r.skillName,
          skillProficiency: r.reviewedSkillProficiency || r.skillProficiency,
          evidence: r.reviewedEvidence || r.evidence,
        };
      });
      setSkillReviews(map);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const setAction = (resultId: string | number, action: ReviewAction) => {
    setSkillReviews(prev => ({ ...prev, [String(resultId)]: { ...prev[String(resultId)], action } }));
  };

  const updateField = (resultId: string | number, field: "skillName" | "skillProficiency" | "evidence", value: string) => {
    setSkillReviews(prev => ({ ...prev, [String(resultId)]: { ...prev[String(resultId)], [field]: value } }));
  };

  const submitReview = async () => {
    if (!detail) return;
    if (!occupationId) { toast.error("请选择最终职业"); return; }
    const reviews = detail.results.map((r) => skillReviews[String(r.id)] ?? { resultId: r.id, action: "APPROVE" });
    // 校验 APPROVE_WITH_EDIT 的三字段必填
    for (const rev of reviews) {
      if (rev.action === "APPROVE_WITH_EDIT" && (!rev.skillName || !rev.skillProficiency || !rev.evidence)) {
        toast.error("修改后通过的技能需完整填写名称、熟练度和证据");
        return;
      }
    }
    setSubmitting(true);
    try {
      await reviewJobAnalysisTask(detail.task.id, { occupationId, skillReviews: reviews });
      toast.success("审核已提交");
      setDetail(null);
      fetchList();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetail = () => { setDetail(null); setOccupationId(""); setSkillReviews({}); };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), "岗位分析审核"]}
        title="岗位分析审核"
        description="确认岗位对应的职业，并逐条审核 JD 技能分析结果"
      />

      {/* 筛选 */}
      <div className="flex items-center gap-2">
        {["", "PENDING", "PASSED", "REJECTED"].map(s => (
          <button key={s}
            className="px-3 py-1.5 rounded-md text-[13px] transition-colors"
            style={{
              border: `1px solid ${filterStatus === s ? T.teal : T.border}`,
              color: filterStatus === s ? "white" : T.ink,
              background: filterStatus === s ? T.teal : "white",
            }}
            onClick={() => { setFilterStatus(s); setPage(1); }}
          >{s === "" ? "全部" : STATUS_LABEL[s]}</button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无岗位分析任务</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["ID", "岗位名称", "模型", "任务状态", "审核状态", "已选职业", "尝试次数", "创建时间", "操作"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.id}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{item.jobName || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.modelName || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.taskStatus || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[12px]"
                      style={{
                        background: item.reviewStatus === "PASSED" ? "#dcfce7" : item.reviewStatus === "REJECTED" ? "#fee2e2" : "#fef9c3",
                        color: item.reviewStatus === "PASSED" ? "#166534" : item.reviewStatus === "REJECTED" ? "#991b1b" : "#854d0e",
                      }}>
                      {STATUS_LABEL[item.reviewStatus] || item.reviewStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.selectedOccupationId || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{item.attempts}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.createdAt?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3">
                    <button className="text-[12px] font-medium flex items-center gap-1" style={{ color: T.teal }}
                      onClick={() => openDetail(item.id)}>
                      <Eye size={12} />审核
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span style={{ color: T.info }}>{page} / {Math.max(1, Math.ceil(total / 20))}</span>
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}

      {/* 详情抽屉 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div className="ml-auto w-[640px] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{detail.task.jobName || `任务 #${detail.task.id}`}</h3>
                <div className="text-[12px] mt-0.5" style={{ color: T.info }}>
                  模型 {detail.task.modelName || "—"} · 尝试 {detail.task.attempts} 次
                </div>
              </div>
              <button onClick={closeDetail} style={{ color: T.info }}><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: T.info }}>加载中…</div>
            ) : (
              <div className="px-5 py-4 space-y-5">
                {/* 职业选择 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>确认职业（AI 候选）</div>
                  <select className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
                    style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                    value={String(occupationId)} onChange={e => setOccupationId(e.target.value)}>
                    <option value="">请选择职业…</option>
                    {detail.candidates.map(c => (
                      <option key={String(c.occupationId)} value={String(c.occupationId)}>
                        {c.occupationName}（相似度 {(c.similarity * 100).toFixed(0)}%）
                      </option>
                    ))}
                  </select>
                </section>

                {/* 技能审核 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>
                    技能结果审核（{detail.results.length} 项，需全部覆盖）
                  </div>
                  {detail.results.length === 0 ? (
                    <div className="text-[13px] py-6 text-center" style={{ color: T.info }}>暂无技能分析结果</div>
                  ) : (
                    <div className="space-y-3">
                      {detail.results.map((r) => (
                        <SkillReviewItem
                          key={String(r.id)}
                          result={r}
                          review={skillReviews[String(r.id)]}
                          onAction={(a) => setAction(r.id, a)}
                          onField={(f, v) => updateField(r.id, f, v)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {detail && !detailLoading && (
              <div className="flex justify-end gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <Btn variant="secondary" onClick={closeDetail}>取消</Btn>
                <Btn onClick={submitReview} disabled={submitting || detail.results.length === 0}>
                  {submitting ? "提交中…" : "提交审核"}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 单条技能审核项
function SkillReviewItem({ result, review, onAction, onField }: {
  result: JobAnalysisResult;
  review?: JobAnalysisSkillReviewInput;
  onAction: (a: ReviewAction) => void;
  onField: (f: "skillName" | "skillProficiency" | "evidence", v: string) => void;
}) {
  const action = review?.action ?? "APPROVE";
  const ACTIONS: { key: ReviewAction; label: string }[] = [
    { key: "APPROVE", label: "通过" },
    { key: "APPROVE_WITH_EDIT", label: "修改后通过" },
    { key: "REJECT", label: "拒绝" },
  ];

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium" style={{ color: T.ink }}>{result.skillName}</div>
          <div className="text-[12px] mt-0.5" style={{ color: T.info }}>熟练度：{result.skillProficiency || "—"}</div>
          {result.evidence && <div className="text-[12px] mt-0.5" style={{ color: T.info }}>证据：{result.evidence}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {ACTIONS.map(a => (
            <button key={a.key}
              className="px-2 py-1 rounded text-[11px] transition-colors"
              style={{
                border: `1px solid ${action === a.key ? T.teal : T.border}`,
                color: action === a.key ? "white" : T.ink,
                background: action === a.key ? T.teal : "white",
              }}
              onClick={() => onAction(a.key)}>{a.label}</button>
          ))}
        </div>
      </div>
      {action === "APPROVE_WITH_EDIT" && (
        <div className="space-y-2 pt-1" style={{ borderTop: `1px dashed ${T.border}` }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="技能名称" value={review?.skillName ?? ""} onChange={v => onField("skillName", v)} />
            <Field label="熟练度" value={review?.skillProficiency ?? ""} onChange={v => onField("skillProficiency", v)} />
          </div>
          <Field label="证据" value={review?.evidence ?? ""} onChange={v => onField("evidence", v)} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] block mb-1" style={{ color: T.info }}>{label}</label>
      <input className="w-full px-2 py-1.5 rounded text-[13px] outline-none"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
