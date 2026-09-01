import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Download, ChevronDown, CheckCircle, FileSearch, Pencil } from "lucide-react";
import P from "../constants/palette";
import { recommendations } from "../data";
import { PageHeader, Btn, Card, StatusBadge, ConfidenceBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";

function RecommendationsPage() {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const priorityColors: Record<string, string> = {
    high: P.red, medium: P.amber, low: P.muted,
  };
  const priorityLabels: Record<string, string> = {
    high: "高优先级", medium: "中优先级", low: "低优先级",
  };

  const highCount = recommendations.filter((r) => r.priority === "high").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.curriculum"), t("nav.recommendations")]}
        title={t("page.recommendations.title")}
        description={t("page.recommendations.desc")}
        actions={
          <>
            <Btn variant="secondary" icon={Sparkles} onClick={() => setConfirmGenerate(true)}>批量生成草案</Btn>
            <Btn icon={Download}>导出报告</Btn>
          </>
        }
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>建议总数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{recommendations.length}</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>AI 草案 + 专家维护</span>
        </div>
        {[
          { label: "高优先级", value: highCount, chip: "需响应", bg: P.redBg, color: P.red },
          { label: "已采纳", value: accepted.size, chip: "已确认", bg: P.greenBg, color: P.green },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        {[
          { label: "优先级", value: "高" },
          { label: "状态", value: "待确认" },
          { label: "建议类型", value: "全部" },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[13px] cursor-pointer"
            style={{ border: `1px solid ${P.border}`, color: P.ink }}>
            <span style={{ color: P.muted }}>{f.label}：</span>
            <span>{f.value}</span>
            <ChevronDown size={12} style={{ color: P.muted }} />
          </div>
        ))}
        <span className="text-[12px] font-mono ml-2" style={{ color: P.muted }}>
          {recommendations.length} 条建议 · {accepted.size} 已采纳
        </span>
      </div>

      {/* Recommendations grouped by priority */}
      {["high", "medium"].map(priority => {
        const items = recommendations.filter(r => r.priority === priority);
        if (!items.length) return null;
        return (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: priorityColors[priority] }} />
              <span className="text-[13px] font-medium" style={{ color: priorityColors[priority] }}>
                {priorityLabels[priority]}
              </span>
              <span className="text-[12px]" style={{ color: P.muted }}>{items.length} 条</span>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((rec, i) => {
                const idx = recommendations.indexOf(rec);
                const isAccepted = accepted.has(idx);
                const isRejected = rejected.has(idx);
                return (
                  <Card key={i}>
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[14px] font-medium" style={{ color: P.ink }}>{rec.title}</h3>
                          {rec.aiGenerated && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                              style={{ background: P.skySoft, color: P.primary, border: `1px solid ${P.primary}25` }}>
                              <Sparkles size={10} />模型生成
                            </span>
                          )}
                          {isAccepted && <StatusBadge status="confirmed" />}
                          {isRejected && <StatusBadge status="rejected" />}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-[12px]" style={{ color: P.muted }}>
                          <span>{rec.type}</span>
                          <span style={{ color: P.border }}>|</span>
                          <span>{rec.level}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: P.muted }}>
                            数据依据
                          </div>
                          <p className="text-[13px] leading-relaxed" style={{ color: P.ink }}>{rec.rationale}</p>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: P.muted }}>
                            改进建议
                          </div>
                          <p className="text-[13px] leading-relaxed" style={{ color: P.ink }}>{rec.suggestion}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[12px]" style={{ color: P.muted }}>
                          <span>置信度 <ConfidenceBadge value={rec.conf} /></span>
                        </div>
                        {!isAccepted && !isRejected && (
                          <div className="flex gap-2">
                            <Btn variant="ghost" size="sm" icon={FileSearch} onClick={() => setEvidenceFor(rec.title)}>查看依据</Btn>
                            <Btn variant="ghost" size="sm" icon={Pencil} onClick={() => toast("进入建议编辑模式")}>修改</Btn>
                            <Btn variant="secondary" size="sm"
                              onClick={() => setRejected(prev => new Set([...prev, idx]))}>
                              不采纳
                            </Btn>
                            <Btn size="sm" icon={CheckCircle}
                              onClick={() => setAccepted(prev => new Set([...prev, idx]))}>
                              采纳
                            </Btn>
                          </div>
                        )}
                        {(isAccepted || isRejected) && (
                          <button className="text-[12px]" style={{ color: P.muted }}
                            onClick={() => {
                              setAccepted(prev => { const n = new Set(prev); n.delete(idx); return n; });
                              setRejected(prev => { const n = new Set(prev); n.delete(idx); return n; });
                            }}>
                            撤销
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      {confirmGenerate && (
        <ConfirmDialog
          title="批量生成改进建议草案"
          body="系统将基于当前供需缺口数据和课程证据矩阵，自动为所有高优先级能力缺口生成改进建议草案，预计生成 4—8 条。已存在的建议不受影响。"
          confirmLabel="开始生成"
          onConfirm={() => toast.success("建议生成已启动", { description: "完成后将推送通知，请稍后刷新查看" })}
          onClose={() => setConfirmGenerate(false)}
        />
      )}
      {evidenceFor && (
        <EvidenceDrawer
          title={evidenceFor}
          subtitle="培养方案证据来源"
          onClose={() => setEvidenceFor(null)}
        />
      )}
    </div>
  );
}

export default RecommendationsPage;
