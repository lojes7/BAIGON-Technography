import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef, useCallback } from "react";
import { X, ExternalLink, Pencil, ShieldCheck, CheckCircle, XCircle, Minus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getDataSourceList, reviewDataSource, getCrawlerStatus, cleanDataSources } from "../services/engineer";
import type { DataSourceItem } from "../types/api";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";

type CleanPhase = "idle" | "confirm" | "progress" | "result";
type ReviewPhase = "idle" | "confirm" | "progress" | "result";

interface CleanLog {
  id: string;
  name: string;
  status: "pending" | "success" | "fail";
  error?: string;
}

export default function RawRecordsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isEngineer = user?.role === "admin"; // 新版中 admin 承接原 engineer 的数据治理职责

  const [records, setRecords] = useState<DataSourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DataSourceItem | null>(null);
  const [crawlerRunning, setCrawlerRunning] = useState(false);

  // 清洗选中
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);

  // 清洗弹窗
  const [cleanPhase, setCleanPhase] = useState<CleanPhase>("idle");
  const [cleanProgress, setCleanProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
  const [cleanLogs, setCleanLogs] = useState<CleanLog[]>([]);
  const [cleanMinimized, setCleanMinimized] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 批量审核状态
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>("idle");
  const [reviewing, setReviewing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"REVIEW_PASSED" | "REVIEW_REJECT">("REVIEW_PASSED");
  const [reviewProgress, setReviewProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
  const [reviewLogs, setReviewLogs] = useState<{ id: string; name: string; status: "pending" | "success" | "fail"; error?: string }[]>([]);

  const fetchRecords = (silent = false) => {
    if (!silent) setLoading(true);
    getDataSourceList({ page, page_size: 20 })
      .then((res) => { setRecords(res.data.items); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => { fetchRecords(); }, [page]);

  // 仅在爬虫运行时轮询，停止后自动取消
  useEffect(() => {
    let pollRef: ReturnType<typeof setInterval> | null = null;

    const check = () => {
      getCrawlerStatus()
        .then((res) => {
          setCrawlerRunning(res.data.running);
          if (res.data.running) {
            fetchRecords(true);
          } else if (pollRef) {
            clearInterval(pollRef);
            pollRef = null;
          }
        })
        .catch(() => {});
    };

    check();
    pollRef = setInterval(check, 5000);

    return () => { if (pollRef) clearInterval(pollRef); };
  }, [page]);

  const handleReview = async (dsId: string, status: string) => {
    try {
      const res = await reviewDataSource(dsId, status);
      toast.success("审核完成", { description: res.data.source_platform });
      setDetail(null);
      fetchRecords();
    } catch (err) { toast.error((err as Error).message); }
  };

  // ==================== 勾选逻辑 ====================

  const passedRecords = records.filter(r => r.review_status === "REVIEW_PASSED");
  const pendingRecords = records.filter(r => r.review_status !== "REVIEW_PASSED");
  const passedCount = passedRecords.length;
  const pendingCount = pendingRecords.length;

  // 当前选中中的分类统计
  const selectedPassed = records.filter(r => selectedIds.has(r.id) && r.review_status === "REVIEW_PASSED");
  const selectedPending = records.filter(r => selectedIds.has(r.id) && r.review_status !== "REVIEW_PASSED");

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (records.length === 0) return;
    const allSelected = records.every(r => selectedIds.has(r.id));
    setSelectedIds(allSelected ? new Set() : new Set(records.map(r => r.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ==================== 批量审核流程 ====================

  const [reviewSubAction, setReviewSubAction] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");

  const startBatchReview = (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setReviewSubAction(action);
    setRejectReason("");

    if (action === "approve") {
      // 批量通过：仅待复核有效
      if (selectedPending.length === 0) {
        toast.error("仅待复核记录可执行审核通过，请重新勾选");
        return;
      }
    }
    // 批量驳回：全部有效，无需过滤
    setReviewStatus(action === "approve" ? "REVIEW_PASSED" : "REVIEW_REJECT");
    setReviewPhase("confirm");
  };

  const executeBatchReview = async () => {
    let ids: string[];
    if (reviewSubAction === "approve") {
      // 批量通过：过滤掉已确认，只处理待复核
      ids = selectedPending.map(r => r.id);
    } else {
      // 批量驳回：全部勾选
      ids = Array.from(selectedIds);
    }

    const totalCount = ids.length;
    const logs = ids.map(id => {
      const r = records.find(rc => rc.id === id);
      return { id, name: r ? `${r.source_platform} #${r.id}` : `ID:${id}`, status: "pending" as const };
    });

    setReviewPhase("progress");
    setReviewProgress({ done: 0, total: totalCount, success: 0, fail: 0 });
    setReviewLogs(logs);
    setReviewing(true);

    let success = 0;
    let fail = 0;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      try {
        await reviewDataSource(id, reviewStatus);
        success++;
        setReviewLogs(prev => prev.map(l => l.id === id ? { ...l, status: "success" as const } : l));
      } catch (err) {
        fail++;
        const msg = (err as Error).message || "未知错误";
        setReviewLogs(prev => prev.map(l => l.id === id ? { ...l, status: "fail" as const, error: msg } : l));
      }
      setReviewProgress({ done: i + 1, total: totalCount, success, fail });
    }

    setReviewing(false);
    setReviewPhase("result");
    clearSelection();
    fetchRecords();
  };

  const closeReviewModal = () => {
    setReviewPhase("idle");
    setRejectReason("");
  };

  // ==================== 清洗流程 ====================

  const startCleanFlow = () => {
    if (selectedIds.size === 0) return;
    // 过滤：仅已确认可清洗
    if (selectedPassed.length === 0) {
      toast.error("仅已确认记录支持清洗，请重新勾选");
      return;
    }
    // 混合勾选 → 提示过滤
    if (selectedPending.length > 0) {
      setCleanPhase("confirm");
    } else {
      setCleanPhase("confirm");
    }
  };

  const executeClean = async () => {
    // 仅使用已确认的记录
    const ids = selectedPassed.map(r => r.id);
    const totalCount = ids.length;

    const logs: CleanLog[] = ids.map(id => {
      const r = records.find(rc => rc.id === id);
      return { id, name: r ? `${r.source_platform} #${r.id}` : `ID:${id}`, status: "pending" };
    });

    setCleanPhase("progress");
    setCleanProgress({ done: 0, total: totalCount, success: 0, fail: 0 });
    setCleanLogs(logs);
    setCleanMinimized(false);
    setCleaning(true);

    // 模拟进度推进（后端异步，前端给用户感知）
    progressTimer.current = setInterval(() => {
      setCleanProgress(prev => {
        const inc = Math.min(prev.total - prev.done, Math.max(1, Math.floor(prev.total / 10)));
        return { ...prev, done: prev.done + inc };
      });
    }, 600);

    try {
      await cleanDataSources(ids);
      // 成功
      if (progressTimer.current) clearInterval(progressTimer.current);
      setCleanProgress(prev => ({ ...prev, done: prev.total, success: prev.total }));
      setCleanLogs(prev => prev.map(l => ({ ...l, status: "success" as const })));
      setCleanPhase("result");
      if (autoRefresh) { fetchRecords(); clearSelection(); }
    } catch (err) {
      // 失败
      if (progressTimer.current) clearInterval(progressTimer.current);
      const msg = (err as Error).message || "未知错误";
      setCleanLogs(prev => prev.map(l => ({ ...l, status: "fail" as const, error: msg })));
      setCleanProgress(prev => ({ ...prev, done: prev.total, fail: prev.total }));
      setCleanPhase("result");
    } finally {
      setCleaning(false);
    }
  };

  const handleRetryFailed = async () => {
    const failedIds = cleanLogs.filter(l => l.status === "fail").map(l => l.id);
    if (failedIds.length === 0) return;
    setSelectedIds(new Set(failedIds));
    // 重新走确认流程
    setCleanPhase("confirm");
  };

  const closeCleanModal = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setCleanPhase("idle");
    setCleanMinimized(false);
  };

  // 单条清洗
  const handleSingleClean = async (dsId: string) => {
    setCleaning(true);
    try {
      await cleanDataSources([dsId]);
      toast.success("单条清洗任务已提交，后台异步执行中");
      fetchRecords();
    } catch (err) {
      toast.error((err as Error).message || "清洗失败，请检查后端服务状态");
    } finally {
      setCleaning(false);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, []);

  // 解析 text_info
  const getTI = (r: DataSourceItem): Record<string, unknown> | null => {
    if (!r.text_info) return null;
    if (typeof r.text_info === "string") {
      try { return JSON.parse(r.text_info) as Record<string, unknown>; } catch { return null; }
    }
    return r.text_info as Record<string, unknown>;
  };
  const info = (r: DataSourceItem, key: string) => {
    const ti = getTI(r);
    return ti?.[key] ? String(ti[key]) : "—";
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.rawRecords")]}
        title={t("page.rawRecords.title")}
        description={t("page.rawRecords.desc")}
      />

      {crawlerRunning && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px]"
          style={{ background: `${T.emerging}12`, color: T.emerging, border: `1px solid ${T.emerging}30` }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: T.emerging }} />
          {t("page.rawRecords.crawlerRunning")}
        </div>
      )}

      {/* 顶部批量工具栏 */}
      {isEngineer && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
          <span className="text-[13px] font-medium" style={{ color: T.ink }}>
            已选 {selectedIds.size} 条
          </span>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={startCleanFlow} disabled={selectedPassed.length === 0 || cleaning}
              title={selectedPassed.length === 0 ? "勾选数据中无已确认记录，无法清洗" : "对已确认记录执行 AI 数据清洗"}>
              {cleaning ? "清洗中..." : "清洗选中"}
            </Btn>
            <Btn size="sm" variant="secondary" disabled={selectedPending.length === 0 || reviewing || cleaning}
              onClick={() => startBatchReview("approve")}
              title={selectedPending.length === 0 ? "勾选数据中无待复核记录" : "批量通过待复核记录"}>
              批量通过
            </Btn>
            <Btn size="sm" variant="secondary" disabled={!hasSelection || reviewing || cleaning}
              onClick={() => startBatchReview("reject")}
              title={!hasSelection ? "请勾选至少 1 条记录" : "批量驳回选中记录"}>
              批量驳回
            </Btn>
            {hasSelection && (
              <button className="text-[13px] ml-2" style={{ color: T.info }} onClick={clearSelection}>
                清空选择
              </button>
            )}
          </div>
          {!hasSelection && (
            <span className="text-[12px]" style={{ color: T.info }}>勾选记录后可批量清洗、审核通过或驳回</span>
          )}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : records.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {isEngineer && (
                  <th className="w-10 px-2 py-2.5">
                    <input type="checkbox" className="accent-[#122E8A] cursor-pointer"
                      checked={records.length > 0 && records.every(r => selectedIds.has(r.id))}
                      onChange={toggleAll}
                      title="全选 / 取消全选" />
                  </th>
                )}
                {[
                  ["colSource","w-[10%]"],
                  ["colJobName","w-[22%]"],
                  ["colCompany","w-[20%]"],
                  ["colPublishDate","w-[12%]"],
                  ["colBatch","w-[12%]"],
                  ["colReviewStatus","w-[14%]"],
                  ["colActions","w-[10%]"],
                ].map(([k, w]) => (
                  <th key={k} className={`${w} px-2 py-2.5 text-left font-medium text-[12px] whitespace-nowrap`} style={{ color: T.info }}>
                    {t(`page.rawRecords.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const passed = r.review_status === "REVIEW_PASSED";
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    {isEngineer && (
                      <td className="px-2 py-2.5">
                        <input type="checkbox" className="accent-[#122E8A] cursor-pointer"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)} />
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-[12px] truncate" style={{ color: T.info }} title={r.source_platform}>{r.source_platform}</td>
                    <td className="px-2 py-2.5 font-medium truncate" style={{ color: T.ink }} title={info(r, "job_name") !== "—" ? info(r, "job_name") : undefined}>{info(r, "job_name")}</td>
                    <td className="px-2 py-2.5 truncate" style={{ color: T.ink }} title={info(r, "company_name") !== "—" ? info(r, "company_name") : undefined}>{info(r, "company_name")}</td>
                    <td className="px-2 py-2.5 font-mono text-[12px]" style={{ color: T.info }}>{r.publish_date?.slice(0, 10) || "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-[12px]" style={{ color: T.info }}>{r.created_at?.slice(0, 10) || "—"}</td>
                    <td className="px-2 py-2.5"><StatusBadge status={r.review_status} /></td>
                    <td className="px-2 py-2.5">
                      <button className="text-[12px] font-medium" style={{ color: T.teal }} onClick={() => setDetail(r)}>{t("common.view")}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("page.rawRecords.prevPage")}</button>
          <span style={{ color: T.info }}>{page} / {Math.ceil(total / 20)}</span>
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>{t("page.rawRecords.nextPage")}</button>
        </div>
      )}

      {/* 底部悬浮栏 */}
      {isEngineer && hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-4" style={{ pointerEvents: "none" }}>
          <div className="flex items-center gap-4 px-5 py-3 rounded-xl shadow-lg"
            style={{ background: T.ink, pointerEvents: "auto", boxShadow: "0 -2px 20px rgba(25,50,77,0.15)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle size={15} style={{ color: T.emerging }} />
              <span className="text-[13px] font-medium" style={{ color: T.white }}>
                {selectedPending.length > 0 && selectedPassed.length > 0
                  ? `已选 ${selectedIds.size} 条 | ${selectedPending.length}待复核(可审核/驳回)、${selectedPassed.length}已确认(可清洗/驳回)`
                  : selectedPending.length > 0
                    ? `已选 ${selectedIds.size} 条待复核，可批量通过 / 批量驳回`
                    : `已选 ${selectedIds.size} 条已确认，可清洗 / 批量驳回`
                }
              </span>
            </div>
            <Btn size="sm" onClick={startCleanFlow} disabled={selectedPassed.length === 0 || cleaning}>
              {cleaning ? "清洗中..." : "清洗选中"}
            </Btn>
            <button className="text-[12px] ml-1" style={{ color: `${T.white}80` }} onClick={clearSelection}>
              清空选择
            </button>
          </div>
        </div>
      )}

      {/* ==================== 清洗弹窗 ==================== */}
      {cleanPhase !== "idle" && !cleanMinimized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }}>
          <div className="bg-white rounded-xl w-[480px] max-h-[85vh] flex flex-col shadow-2xl"
            style={{ border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>

            {/* Phase 1: 确认弹窗 */}
            {cleanPhase === "confirm" && (
              <>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>批量数据清洗</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="p-4 rounded-lg" style={{ background: T.cloud }}>
                    <div className="text-[14px] font-medium mb-1" style={{ color: T.ink }}>
                      待清洗数据：{selectedPassed.length} 条（均为已确认岗位）
                    </div>
                    {selectedPending.length > 0 && (
                      <div className="text-[12px] mb-1" style={{ color: T.pending }}>
                        已自动过滤 {selectedPending.length} 条待复核数据，仅清洗已确认记录
                      </div>
                    )}
                    <div className="text-[13px] leading-relaxed" style={{ color: T.info }}>
                      AI 自动解析岗位信息，生成标准化职业、技能、行业词条入库
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-[13px]" style={{ color: T.info }}>
                    <input type="checkbox" className="accent-[#122E8A]" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                    清洗完成后自动刷新列表
                  </label>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <Btn variant="secondary" onClick={closeCleanModal}>取消</Btn>
                  <Btn onClick={executeClean} disabled={cleaning}>确认开始清洗</Btn>
                </div>
              </>
            )}

            {/* Phase 2: 进度弹窗 */}
            {cleanPhase === "progress" && (
              <>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>正在清洗...</h3>
                  <button className="flex items-center gap-1 text-[12px]" style={{ color: T.info }}
                    onClick={() => setCleanMinimized(true)}>
                    <Minus size={14} />最小化
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {/* 进度条 */}
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span style={{ color: T.info }}>已处理 {cleanProgress.done} / {cleanProgress.total} 条</span>
                      <span style={{ color: T.teal }}>
                        成功 {cleanProgress.success} / 失败 {cleanProgress.fail}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: T.cloud }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cleanProgress.total > 0 ? Math.round((cleanProgress.done / cleanProgress.total) * 100) : 0}%`,
                          background: T.teal,
                        }} />
                    </div>
                  </div>
                  {/* 日志列表 */}
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5">
                    {cleanLogs.map(l => (
                      <div key={l.id} className="flex items-center gap-2 text-[13px] py-1">
                        {l.status === "pending" && <Loader2 size={13} className="animate-spin" style={{ color: T.info }} />}
                        {l.status === "success" && <CheckCircle size={13} style={{ color: T.emerging }} />}
                        {l.status === "fail" && <XCircle size={13} style={{ color: T.risk }} />}
                        <span className="flex-1 truncate" style={{ color: T.ink }}>{l.name}</span>
                        {l.status === "fail" && l.error && (
                          <span className="text-[11px] cursor-pointer" style={{ color: T.risk }}
                            onClick={() => toast.error(l.error!, { duration: 8000 })}>
                            查看详情
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Phase 3: 结果弹窗 */}
            {cleanPhase === "result" && (
              <>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>清洗完成</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {cleanProgress.fail === 0 ? (
                    <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: `${T.emerging}10`, border: `1px solid ${T.emerging}30` }}>
                      <CheckCircle size={18} style={{ color: T.emerging }} />
                      <div>
                        <div className="text-[14px] font-medium mb-1" style={{ color: T.emerging }}>
                          {cleanProgress.total} 条数据清洗完成
                        </div>
                        <div className="text-[13px]" style={{ color: T.info }}>标准化词条已生成，可前往岗位词典查看</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: `${T.pending}10`, border: `1px solid ${T.pending}30` }}>
                      <XCircle size={18} style={{ color: T.pending }} />
                      <div className="flex-1">
                        <div className="text-[14px] font-medium mb-1" style={{ color: T.pending }}>
                          成功 {cleanProgress.success} 条，失败 {cleanProgress.fail} 条
                        </div>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto">
                          {cleanLogs.filter(l => l.status === "fail").map(l => (
                            <div key={l.id} className="text-[12px]" style={{ color: T.risk }}>
                              {l.name} — {l.error || "未知错误"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  {cleanProgress.fail > 0 && (
                    <Btn variant="secondary" onClick={handleRetryFailed} icon={Sparkles}>重试失败条目</Btn>
                  )}
                  <Btn variant="secondary" onClick={() => { fetchRecords(); closeCleanModal(); }}>
                    关闭
                  </Btn>
                  {!autoRefresh && (
                    <Btn onClick={() => { fetchRecords(); closeCleanModal(); }}>刷新列表</Btn>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== 批量审核弹窗 ==================== */}
      {reviewPhase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }}
          onClick={() => reviewPhase !== "progress" && closeReviewModal()}>
          <div className="bg-white rounded-xl w-[460px] max-h-[85vh] flex flex-col shadow-2xl"
            style={{ border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>

            {reviewPhase === "confirm" && (
              <>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>
                    {reviewSubAction === "approve" ? "批量审核通过" : "批量审核驳回"}
                  </h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="p-4 rounded-lg" style={{ background: T.cloud }}>
                    <div className="text-[14px] font-medium mb-1" style={{ color: T.ink }}>
                      {reviewSubAction === "approve"
                        ? `待通过记录：${selectedPending.length} 条（已自动过滤 ${selectedPassed.length} 条已确认数据）`
                        : `待驳回记录：${selectedIds.size} 条（含已确认 ${selectedPassed.length} 条 + 待复核 ${selectedPending.length} 条）`
                      }
                    </div>
                  </div>
                  {reviewSubAction === "reject" && (
                    <div>
                      <div className="text-[13px] font-medium mb-2" style={{ color: T.ink }}>驳回理由（选填）</div>
                      <textarea className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
                        style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink, height: 72 }}
                        placeholder="填写驳回原因，便于后续追溯..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)} />
                    </div>
                  )}
                  {reviewSubAction === "approve" && (
                    <div>
                      <div className="text-[13px] font-medium mb-2" style={{ color: T.ink }}>审核结果</div>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-[13px] flex-1"
                          style={{
                            border: `1px solid ${reviewStatus === "REVIEW_PASSED" ? T.emerging : T.border}`,
                            background: reviewStatus === "REVIEW_PASSED" ? `${T.emerging}10` : T.white,
                          }}>
                          <input type="radio" className="accent-[#16856B]" checked={reviewStatus === "REVIEW_PASSED"}
                            onChange={() => setReviewStatus("REVIEW_PASSED")} />
                          <ShieldCheck size={15} style={{ color: T.emerging }} />
                          审核通过
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-[13px] flex-1"
                          style={{
                            border: `1px solid ${reviewStatus === "REVIEW_REJECT" ? T.risk : T.border}`,
                            background: reviewStatus === "REVIEW_REJECT" ? `${T.risk}10` : T.white,
                          }}>
                          <input type="radio" className="accent-[#B54848]" checked={reviewStatus === "REVIEW_REJECT"}
                            onChange={() => setReviewStatus("REVIEW_REJECT")} />
                          <XCircle size={15} style={{ color: T.risk }} />
                          审核驳回
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <Btn variant="secondary" onClick={closeReviewModal}>取消</Btn>
                  <Btn onClick={executeBatchReview} disabled={reviewing}>
                    确认{reviewSubAction === "approve" ? "通过" : "驳回"}
                  </Btn>
                </div>
              </>
            )}

            {reviewPhase === "progress" && (
              <>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>正在审核...</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span style={{ color: T.info }}>已处理 {reviewProgress.done} / {reviewProgress.total} 条</span>
                      <span style={{ color: T.teal }}>成功 {reviewProgress.success} / 失败 {reviewProgress.fail}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: T.cloud }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${reviewProgress.total > 0 ? Math.round((reviewProgress.done / reviewProgress.total) * 100) : 0}%`,
                          background: T.teal,
                        }} />
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5">
                    {reviewLogs.map(l => (
                      <div key={l.id} className="flex items-center gap-2 text-[13px] py-1">
                        {l.status === "pending" && <Loader2 size={13} className="animate-spin" style={{ color: T.info }} />}
                        {l.status === "success" && <CheckCircle size={13} style={{ color: T.emerging }} />}
                        {l.status === "fail" && <XCircle size={13} style={{ color: T.risk }} />}
                        <span className="flex-1 truncate" style={{ color: T.ink }}>{l.name}</span>
                        {l.status === "fail" && (
                          <span className="text-[11px] cursor-pointer" style={{ color: T.risk }}
                            onClick={() => toast.error(l.error!, { duration: 8000 })}>查看</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {reviewPhase === "result" && (
              <>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                  <h3 className="text-[16px] font-medium" style={{ color: T.ink }}>审核完成</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className={`flex items-start gap-3 p-4 rounded-lg ${reviewProgress.fail === 0 ? "" : ""}`}
                    style={{
                      background: reviewProgress.fail === 0 ? `${T.emerging}10` : `${T.pending}10`,
                      border: `1px solid ${reviewProgress.fail === 0 ? `${T.emerging}30` : `${T.pending}30`}`,
                    }}>
                    {reviewProgress.fail === 0 ? (
                      <CheckCircle size={18} style={{ color: T.emerging }} />
                    ) : (
                      <XCircle size={18} style={{ color: T.pending }} />
                    )}
                    <div>
                      <div className="text-[14px] font-medium mb-1" style={{ color: reviewProgress.fail === 0 ? T.emerging : T.pending }}>
                        成功 {reviewProgress.success} 条{reviewProgress.fail > 0 && `，失败 ${reviewProgress.fail} 条`}
                      </div>
                      <div className="text-[13px]" style={{ color: T.info }}>列表已自动刷新</div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <Btn variant="secondary" onClick={closeReviewModal}>关闭</Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 最小化悬浮小窗 */}
      {cleanPhase === "progress" && cleanMinimized && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg cursor-pointer"
          style={{ background: T.ink }}
          onClick={() => setCleanMinimized(false)}>
          <div className="flex items-center gap-3">
            <Loader2 size={15} className="animate-spin" style={{ color: T.white }} />
            <span className="text-[13px] font-medium" style={{ color: T.white }}>
              清洗中 {cleanProgress.done}/{cleanProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* ==================== 详情抽屉 ==================== */}
      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setDetail(null)}>
          <div className="ml-auto w-[520px] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{t("page.rawRecords.detailTitle")}</h3>
              <button onClick={() => setDetail(null)} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <DetailSection title={t("page.rawRecords.basicInfo")} items={[
                [t("page.rawRecords.sourcePlatform"), <span>{detail.source_platform}{detail.source_url && <a href={detail.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2" style={{ color: T.teal, fontSize: 12 }}><ExternalLink size={12} /></a>}</span>],
                [t("page.rawRecords.dataSourceType"), <span>{detail.data_source_type === "JOB" ? t("page.rawRecords.recruitmentPosition") : detail.data_source_type}</span>],
                [t("page.rawRecords.reviewStatus"), <StatusBadge status={detail.review_status} />],
                [t("page.rawRecords.publishDate"), detail.publish_date?.slice(0, 10) || "—"],
                [t("page.rawRecords.reviewDate"), detail.reviewed_at?.slice(0, 10) || "—"],
                [t("page.rawRecords.createDate"), detail.created_at?.slice(0, 10) || "—"],
              ]} />

              {/* 单条清洗 — 仅已确认状态 */}
              {isEngineer && (
                <div className="pt-1">
                  <Btn size="sm" icon={Sparkles}
                    onClick={() => handleSingleClean(detail.id)}
                    disabled={detail.review_status !== "REVIEW_PASSED" || cleaning}
                    title={detail.review_status !== "REVIEW_PASSED" ? "需审核通过后才可清洗本条数据" : "对该条记录执行 AI 数据清洗"}>
                    {cleaning ? "清洗中..." : "单条清洗"}
                  </Btn>
                </div>
              )}

              {detail.data_source_type === "JOB" && getTI(detail) && (
                <JobDetailSection textInfo={getTI(detail)!} />
              )}

              {detail.data_source_type !== "JOB" && getTI(detail) && (
                <div>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>{t("page.rawRecords.rawData")}</div>
                  <pre className="text-[12px] p-3 rounded-md overflow-x-auto leading-relaxed"
                    style={{ background: "#1a1a2e", color: "#a8d8a8" }}>
                    {JSON.stringify(getTI(detail), null, 2)}
                  </pre>
                </div>
              )}

              {user?.role === "engineer" && detail.review_status !== "REVIEW_PASSED" && (
                <div className="flex flex-col gap-2 pt-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <div className="text-[12px] font-medium" style={{ color: T.info }}>{t("page.rawRecords.reviewActions")}</div>
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:opacity-80"
                      style={{ background: "#E6F5F1", color: "#1A6B4E", border: `1px solid #B8E0D2` }}
                      onClick={() => handleReview(detail.id, "REVIEW_PASSED")}>
                      <ShieldCheck size={15} />{t("page.rawRecords.approve")}
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:opacity-80"
                      style={{ background: "#FDF6E3", color: "#8B6914", border: `1px solid #E8D5A0` }}
                      onClick={() => handleReview(detail.id, "REVIEW_PASSED")}>
                      <Pencil size={15} />{t("page.rawRecords.modifyConfirm")}
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:opacity-80"
                      style={{ background: "#FAECEC", color: "#8B1A1A", border: `1px solid #E8C0C0` }}
                      onClick={() => handleReview(detail.id, "REVIEW_REJECT")}>
                      <X size={15} />{t("page.rawRecords.reject")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, items }: { title: string; items: [string, React.ReactNode][] }) {
  return (
    <div>
      <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>{title}</div>
      <div className="rounded-md p-3 space-y-2 text-[13px]" style={{ background: T.cloud }}>
        {items.map(([k, v], i) => (
          <div key={i} className="flex justify-between items-center">
            <span style={{ color: T.info }}>{k}</span>
            <span className="font-medium" style={{ color: T.ink }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const JOB_FIELD_KEYS: [string, string][] = [
  ["jobName", "job_name"],
  ["companyName", "company_name"],
  ["jobSalary", "salary"],
  ["jobCity", "city"],
  ["jobProvince", "province"],
  ["jobExp", "experience"],
  ["jobEdu", "education"],
  ["jobMajor", "major"],
  ["jobNature", "nature"],
  ["jobTags", "tags"],
];

function JobDetailSection({ textInfo }: { textInfo: Record<string, unknown> }) {
  const { t } = useTranslation();
  const rt = (key: string) => t(`page.rawRecords.${key}`);
  return (
    <>
      <DetailSection title={rt("jobInfo")} items={JOB_FIELD_KEYS.map(([k, key]) => [rt(k), String(textInfo[key] ?? "—")])} />
      {textInfo.work_description && (
        <div>
          <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>{rt("jobDesc")}</div>
          <div className="text-[13px] p-3 rounded-md leading-relaxed"
            style={{ background: T.cloud, color: T.ink, wordBreak: "break-word" }}>
            {String(textInfo.work_description)}
          </div>
        </div>
      )}
    </>
  );
}
