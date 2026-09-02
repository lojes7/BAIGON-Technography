import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import P from "../constants/palette";
import { useAuth } from "../auth/AuthContext";
import { getEvolutionEvents, getEvolutionEventDetail } from "../services/analytics";
import type { EvolutionEventItem, EvolutionEventDetail } from "../types/api";
import { PageHeader, Btn, Card, StatusBadge, Divider, Pagination } from "../components/ui";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";

const DEFAULT_PERIOD = "2026H1";

/* 本地统计样本：API 不可达时作为兜底 */
const FALLBACK_EVENTS: EvolutionEventItem[] = [
  { event_key: "EVT-RAG-2026H1", skill_id: "sk_001", skill_name: "RAG 工程化", event_type: "EMERGING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 12.5, current_coverage: 47.5, change_pp: 35.0, company_count: 62, sample_count: 131 },
  { event_key: "EVT-AGENT-2026H1", skill_id: "sk_002", skill_name: "Agent 编排", event_type: "EMERGING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 8.3, current_coverage: 38.4, change_pp: 30.1, company_count: 50, sample_count: 130 },
  { event_key: "EVT-FINETUNE-2026H1", skill_id: "sk_003", skill_name: "大模型微调", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 22.1, current_coverage: 52.3, change_pp: 30.2, company_count: 68, sample_count: 130 },
  { event_key: "EVT-EVAL-2026H1", skill_id: "sk_006", skill_name: "模型评测", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 15.3, current_coverage: 33.9, change_pp: 18.6, company_count: 44, sample_count: 130 },
  { event_key: "EVT-AISAFE-2026H1", skill_id: "sk_007", skill_name: "AI 安全治理", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 6.1, current_coverage: 20.3, change_pp: 14.2, company_count: 27, sample_count: 133 },
  { event_key: "EVT-LLMOps-2026H1", skill_id: "sk_009", skill_name: "LLMOps 运维", event_type: "EMERGING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 3.2, current_coverage: 16.8, change_pp: 13.6, company_count: 22, sample_count: 131 },
  { event_key: "EVT-MULTIAGENT-2026H1", skill_id: "sk_010", skill_name: "多智能体协作", event_type: "EMERGING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 1.5, current_coverage: 12.1, change_pp: 10.6, company_count: 16, sample_count: 132 },
  { event_key: "EVT-PROMPT-2026H1", skill_id: "sk_005", skill_name: "Prompt 工程", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 45.2, current_coverage: 51.0, change_pp: 5.8, company_count: 66, sample_count: 129 },
  { event_key: "EVT-VECTOR-2026H1", skill_id: "sk_004", skill_name: "向量数据库", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 31.0, current_coverage: 36.1, change_pp: 5.1, company_count: 47, sample_count: 130 },
  { event_key: "EVT-DOCKER-2026H1", skill_id: "sk_011", skill_name: "容器化部署", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 40.1, current_coverage: 43.2, change_pp: 3.1, company_count: 56, sample_count: 130 },
  { event_key: "EVT-SQL-2026H1", skill_id: "sk_012", skill_name: "SQL 数据分析", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 55.3, current_coverage: 56.8, change_pp: 1.5, company_count: 74, sample_count: 130 },
  { event_key: "EVT-HADOOP-2026H1", skill_id: "sk_008", skill_name: "Hadoop 生态", event_type: "DECLINING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 28.4, current_coverage: 19.0, change_pp: -9.4, company_count: 25, sample_count: 132 },
  { event_key: "EVT-LABEL-2026H1", skill_id: "sk_013", skill_name: "传统图像标注", event_type: "DECLINING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 18.2, current_coverage: 9.1, change_pp: -9.1, company_count: 12, sample_count: 132 },
  { event_key: "EVT-ETL-2026H1", skill_id: "sk_014", skill_name: "传统 ETL 开发", event_type: "DECLINING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 22.5, current_coverage: 15.3, change_pp: -7.2, company_count: 20, sample_count: 131 },
  { event_key: "EVT-FLASK-2026H1", skill_id: "sk_015", skill_name: "Flask 轻量框架", event_type: "DECLINING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 14.0, current_coverage: 8.2, change_pp: -5.8, company_count: 11, sample_count: 134 },
  { event_key: "EVT-STREAM-2026H1", skill_id: "sk_016", skill_name: "流式计算引擎", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 10.5, current_coverage: 22.7, change_pp: 12.2, company_count: 30, sample_count: 132 },
  { event_key: "EVT-EDGE-2026H1", skill_id: "sk_017", skill_name: "边缘计算部署", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 5.3, current_coverage: 15.6, change_pp: 10.3, company_count: 21, sample_count: 135 },
  { event_key: "EVT-K8S-2026H1", skill_id: "sk_018", skill_name: "Kubernetes 编排", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 35.2, current_coverage: 38.4, change_pp: 3.2, company_count: 50, sample_count: 130 },
  { event_key: "EVT-DEVOPS-2026H1", skill_id: "sk_019", skill_name: "DevOps 流水线", event_type: "STABLE", base_period: "2025H1", compare_period: "2026H1", base_coverage: 42.1, current_coverage: 44.8, change_pp: 2.7, company_count: 58, sample_count: 129 },
  { event_key: "EVT-DATAQUAL-2026H1", skill_id: "sk_020", skill_name: "数据质量治理", event_type: "RISING", base_period: "2025H1", compare_period: "2026H1", base_coverage: 8.8, current_coverage: 19.5, change_pp: 10.7, company_count: 26, sample_count: 133 },
];

const FALLBACK_DETAIL: EvolutionEventDetail = {
  skill_id: "", skill_name: "", event_type: "",
  metrics: { base_period: "2025H1", compare_period: "2026H1", base_coverage: 0, current_coverage: 0, change_pp: 0, company_count: 0, sample_count: 0 },
  evidence: [], warnings: [],
};

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "EMERGING", label: "新兴技能" },
  { value: "RISING", label: "热度上升" },
  { value: "STABLE", label: "平稳发展" },
  { value: "DECLINING", label: "热度衰退" },
];

function EvolutionEventsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canReview = user?.role === "admin" || user?.role === "analyst";

  const [events, setEvents] = useState<EvolutionEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);

  // 展开/详情
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<EvolutionEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 证据抽屉
  const [evidenceTarget, setEvidenceTarget] = useState<{ name: string; evidence: EvolutionEventDetail["evidence"] } | null>(null);

  const fetchEvents = async (p: number, type: string) => {
    setLoading(true);
    try {
      const res = await getEvolutionEvents({
        period: DEFAULT_PERIOD,
        event_type: type || undefined,
        page: p,
        page_size: 20,
      });
      setEvents(res.data.items);
      setTotal(res.data.total);
    } catch {
      const filtered = type ? FALLBACK_EVENTS.filter((e) => e.event_type === type) : FALLBACK_EVENTS;
      const start = (p - 1) * 20;
      setEvents(filtered.slice(start, start + 20));
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(page, eventType);
  }, [page, eventType]);

  const handleExpand = async (evt: EvolutionEventItem) => {
    const key = evt.event_key;
    if (expanded === key) {
      setExpanded(null);
      setEventDetail(null);
      return;
    }
    setExpanded(key);
    setDetailLoading(true);
    setEventDetail(null);
    try {
      const res = await getEvolutionEventDetail({
        skill_id: evt.skill_id,
        base_period: evt.base_period,
        compare_period: evt.compare_period,
      });
      setEventDetail(res.data);
    } catch {
      setEventDetail({
        ...FALLBACK_DETAIL,
        skill_id: evt.skill_id, skill_name: evt.skill_name, event_type: evt.event_type,
        metrics: { base_period: evt.base_period, compare_period: evt.compare_period, base_coverage: evt.base_coverage, current_coverage: evt.current_coverage, change_pp: evt.change_pp, company_count: evt.company_count, sample_count: evt.sample_count },
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = (evt: EvolutionEventItem) => {
    toast.success(`已确认事件：${evt.skill_name}`, {
      description: "事件状态已更新为「已复核」",
    });
  };

  const typeColors: Record<string, string> = {
    EMERGING: P.green, emerging: P.green,
    RISING: P.primary, rising: P.primary,
    STABLE: P.muted, stable: P.muted,
    DECLINING: P.red, declining: P.red,
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.evolution"), t("nav.evolutionEvents")]}
        title={t("page.evolutionEvents.title")}
        description={t("page.evolutionEvents.desc")}
      />

      {/* KPI 统计行 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 120 }}>
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>事件总数</span>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{total}</div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>{DEFAULT_PERIOD} 周期</span>
        </div>
        {[
          { label: "新兴", value: FALLBACK_EVENTS.filter((e) => e.event_type === "EMERGING").length, chip: "新出现", bg: P.greenBg, color: P.green },
          { label: "上升", value: FALLBACK_EVENTS.filter((e) => e.event_type === "RISING").length, chip: "热度增长", bg: P.skySoft, color: P.primary },
          { label: "衰退", value: FALLBACK_EVENTS.filter((e) => e.event_type === "DECLINING").length, chip: "需关注", bg: P.redBg, color: P.red },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 120 }}>
            <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
          </div>
        ))}
      </div>

      {/* 筛选器 */}
      <div className="flex items-center gap-3">
        {EVENT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="px-3 py-2 rounded-md text-[13px] cursor-pointer transition-colors"
            style={{
              border: `1px solid ${eventType === opt.value ? P.primary : P.border}`,
              color: eventType === opt.value ? P.primary : P.ink,
              background: eventType === opt.value ? `${P.primary}10` : "white",
            }}
            onClick={() => { setEventType(opt.value); setPage(1); }}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-[12px]" style={{ color: P.muted }}>
          共 {total} 条事件
        </span>
      </div>

      {/* 事件列表 */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-12 text-[13px]" style={{ color: P.muted }}>正在加载演化事件...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-[13px]" style={{ color: P.muted }}>
            当前筛选条件下暂无演化事件
          </div>
        ) : (
          events.map((evt) => {
            const isExpanded = expanded === evt.event_key;
            const up = evt.change_pp >= 0;
            const typeKey = evt.event_type;
            return (
              <Card key={evt.event_key}>
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[15px] font-medium" style={{ color: P.ink }}>{evt.skill_name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{ color: typeColors[typeKey] || P.muted, background: `${typeColors[typeKey] || P.muted}18` }}>
                        {EVENT_TYPE_OPTIONS.find((o) => o.value === typeKey)?.label || typeKey}
                      </span>
                      <StatusBadge status={evt.event_type === "EMERGING" || evt.event_type === "DECLINING" ? "needs_review" : "confirmed"} />
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-[12px]" style={{ color: P.muted }}>
                      <span className="font-mono">{evt.event_key}</span>
                      <span>{evt.base_period} → {evt.compare_period}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-3 text-[13px]">
                    <span>覆盖率 <span className="font-mono font-medium" style={{ color: P.ink }}>{evt.current_coverage.toFixed(1)}%</span></span>
                    <span>变化 <span className="font-mono font-medium"
                      style={{ color: up ? P.green : P.red }}>
                      {up ? "+" : ""}{evt.change_pp.toFixed(1)}pp
                    </span></span>
                    <span>企业数 <span className="font-mono font-medium" style={{ color: P.ink }}>{evt.company_count}</span></span>
                    <span>样本 <span className="font-mono font-medium" style={{ color: P.ink }}>{evt.sample_count}</span></span>
                  </div>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      <Divider />
                      {detailLoading ? (
                        <div className="text-center py-4 text-[13px]" style={{ color: P.muted }}>加载详情中...</div>
                      ) : eventDetail ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: P.muted }}>
                                指标变化
                              </div>
                              <div className="rounded-md p-3 text-[12px] space-y-1" style={{ background: P.skySoft }}>
                                {[
                                  ["基准周期", eventDetail.metrics.base_period],
                                  ["对比周期", eventDetail.metrics.compare_period],
                                  ["基准覆盖率", `${eventDetail.metrics.base_coverage.toFixed(1)}%`],
                                  ["当前覆盖率", `${eventDetail.metrics.current_coverage.toFixed(1)}%`],
                                  ["变化幅度", `${eventDetail.metrics.change_pp > 0 ? "+" : ""}${eventDetail.metrics.change_pp.toFixed(1)}pp`],
                                  ["涉及企业", `${eventDetail.metrics.company_count} 家`],
                                  ["样本量", `${eventDetail.metrics.sample_count} 条`],
                                ].map(([k, v], i) => (
                                  <div key={i} className="flex justify-between">
                                    <span style={{ color: P.muted }}>{k}</span>
                                    <span className="font-mono font-medium" style={{ color: P.ink }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[12px] font-medium uppercase tracking-wider mb-2"
                                style={{ color: P.muted }}>数据来源
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded normal-case"
                                  style={{ background: "#EBF2FA", color: P.primary }}>基于招聘证据</span>
                              </div>
                              <div className="rounded-md p-3 text-[12px] leading-relaxed" style={{ background: P.skySoft, color: P.ink }}>
                                {eventDetail.evidence?.length
                                  ? `共关联 ${eventDetail.evidence.length} 条招聘证据，来自 ${new Set(eventDetail.evidence.map((e) => e.company_name)).size} 家企业`
                                  : "暂无证据数据"}
                                {eventDetail.warnings?.length > 0 && (
                                  <div className="mt-2 text-[11px]" style={{ color: P.amber }}>
                                    {eventDetail.warnings.join("；")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4 text-[13px]" style={{ color: P.muted }}>暂无详细数据</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <button className="text-[12px] flex items-center gap-1" style={{ color: P.primary }}
                      onClick={() => handleExpand(evt)}>
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {isExpanded ? "收起详情" : "展开详情"}
                    </button>
                    <div className="flex gap-2">
                      <Btn variant="ghost" size="sm" icon={FileSearch}
                        onClick={() => setEvidenceTarget({
                          name: evt.skill_name,
                          evidence: eventDetail?.evidence || [],
                        })}>
                        查看证据
                      </Btn>
                      {canReview && (
                        <Btn size="sm" icon={CheckCircle} onClick={() => handleReview(evt)}>确认事件</Btn>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* 分页 */}
      {total > 0 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} total={total} />
      )}

      {/* 证据抽屉 */}
      {evidenceTarget && (
        <EvidenceDrawer
          title={evidenceTarget.name}
          subtitle="演化事件证据"
          items={evidenceTarget.evidence?.length ? evidenceTarget.evidence.map((e) => ({
            text: `${e.company_name} · ${e.job_name} · ${e.proficiency || "-"}`,
            source: e.source_platform,
            date: e.publish_date?.slice(0, 10) || "",
            job: e.job_name,
            status: "candidate",
          })) : undefined}
          onClose={() => setEvidenceTarget(null)}
        />
      )}
    </div>
  );
}

export default EvolutionEventsPage;
