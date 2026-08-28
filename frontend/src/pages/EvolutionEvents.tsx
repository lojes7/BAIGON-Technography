import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getEvolutionEvents, getEvolutionEventDetail } from "../services/analytics";
import type { EvolutionEventItem, EvolutionEventDetail } from "../types/api";
import { PageHeader, Btn, Card, StatusBadge, Divider, Pagination } from "../components/ui";
import EvidenceDrawer from "../components/overlay/EvidenceDrawer";

const DEFAULT_PERIOD = "2026H1";

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
      setEvents([]);
      setTotal(0);
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
      // 详情获取失败，使用列表中的基础数据
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = (evt: EvolutionEventItem) => {
    // TODO: 等待后端提供演化事件复核 API
    toast.success(`已确认事件：${evt.skill_name}`, {
      description: "复核操作需后端提供 /api/analytics/evolution/events/{skill_id}/review 接口",
    });
  };

  const typeColors: Record<string, string> = {
    EMERGING: T.emerging, emerging: T.emerging,
    RISING: T.stable, rising: T.stable,
    STABLE: T.info, stable: T.info,
    DECLINING: T.declining, declining: T.declining,
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.evolution"), t("nav.evolutionEvents")]}
        title={t("page.evolutionEvents.title")}
        description={t("page.evolutionEvents.desc")}
      />

      {/* 筛选器 */}
      <div className="flex items-center gap-3">
        {EVENT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="px-3 py-2 rounded-md text-[13px] cursor-pointer transition-colors"
            style={{
              border: `1px solid ${eventType === opt.value ? T.teal : T.border}`,
              color: eventType === opt.value ? T.teal : T.ink,
              background: eventType === opt.value ? `${T.teal}10` : "white",
            }}
            onClick={() => { setEventType(opt.value); setPage(1); }}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-[12px]" style={{ color: T.info }}>
          共 {total} 条事件
        </span>
      </div>

      {/* 事件列表 */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-12 text-[13px]" style={{ color: T.info }}>正在加载演化事件...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-[13px]" style={{ color: T.info }}>
            暂无演化事件数据，请确认后端统计分析服务已接入
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
                      <span className="text-[15px] font-medium" style={{ color: T.ink }}>{evt.skill_name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{ color: typeColors[typeKey] || T.info, background: `${typeColors[typeKey] || T.info}18` }}>
                        {EVENT_TYPE_OPTIONS.find((o) => o.value === typeKey)?.label || typeKey}
                      </span>
                      <StatusBadge status={evt.event_type === "EMERGING" || evt.event_type === "DECLINING" ? "needs_review" : "confirmed"} />
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-[12px]" style={{ color: T.info }}>
                      <span className="font-mono">{evt.event_key}</span>
                      <span>{evt.base_period} → {evt.compare_period}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-3 text-[13px]">
                    <span>覆盖率 <span className="font-mono font-medium" style={{ color: T.ink }}>{evt.current_coverage.toFixed(1)}%</span></span>
                    <span>变化 <span className="font-mono font-medium"
                      style={{ color: up ? T.emerging : T.declining }}>
                      {up ? "+" : ""}{evt.change_pp.toFixed(1)}pp
                    </span></span>
                    <span>企业数 <span className="font-mono font-medium" style={{ color: T.ink }}>{evt.company_count}</span></span>
                    <span>样本 <span className="font-mono font-medium" style={{ color: T.ink }}>{evt.sample_count}</span></span>
                  </div>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      <Divider />
                      {detailLoading ? (
                        <div className="text-center py-4 text-[13px]" style={{ color: T.info }}>加载详情中...</div>
                      ) : eventDetail ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                                指标变化
                              </div>
                              <div className="rounded-md p-3 text-[12px] space-y-1" style={{ background: T.cloud }}>
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
                                    <span style={{ color: T.info }}>{k}</span>
                                    <span className="font-mono font-medium" style={{ color: T.ink }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[12px] font-medium uppercase tracking-wider mb-2"
                                style={{ color: T.info }}>数据来源
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded normal-case"
                                  style={{ background: "#EBF2FA", color: T.stable }}>基于招聘证据</span>
                              </div>
                              <div className="rounded-md p-3 text-[12px] leading-relaxed" style={{ background: T.cloud, color: T.ink }}>
                                {eventDetail.evidence?.length
                                  ? `共关联 ${eventDetail.evidence.length} 条招聘证据，来自 ${new Set(eventDetail.evidence.map((e) => e.company_name)).size} 家企业`
                                  : "暂无证据数据"}
                                {eventDetail.warnings?.length > 0 && (
                                  <div className="mt-2 text-[11px]" style={{ color: T.pending }}>
                                    {eventDetail.warnings.join("；")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4 text-[13px]" style={{ color: T.info }}>暂无详细数据</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <button className="text-[12px] flex items-center gap-1" style={{ color: T.teal }}
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
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} total={total} />
      )}

      {/* 证据抽屉 */}
      {evidenceTarget && (
        <EvidenceDrawer
          title={evidenceTarget.name}
          subtitle="演化事件证据"
          items={evidenceTarget.evidence?.length ? evidenceTarget.evidence.map((e) => ({
            text: `${e.company_name} · ${e.job_name} · ${e.proficiency || "—"}`,
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
