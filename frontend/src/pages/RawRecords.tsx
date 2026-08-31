import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { X, ShieldCheck, CheckCircle, XCircle, Loader2, ArrowLeft, FileText, Pencil, Eye, ArrowUpRight, Radio, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { toast } from "sonner";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getDataSourceList, reviewDataSource, getCrawlerStatus, getSourceRecord, getDataSourceDetail, editAndApproveReview } from "../services/engineer";
import type { DataSourceItem, DataSourceDetail, SourceJobDetail } from "../types/api";
import { Btn, Card, StatusBadge, Pagination } from "../components/ui";
import DiffViewer, { type DiffRow } from "../components/diff/DiffViewer";

/* 深蓝主色系（确认后与工作台一起沉淀到 tokens.ts） */
const P = {
  primary: "#1E4C8F",
  primaryDeep: "#12305E",
  sky: "#A9C8EC",
  skySoft: "#DCE8F6",
  ink: "#16283E",
  muted: "#5E6E82",
  faint: "#8B99AB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  border: "#E4EAF2",
  bg: "#F3F6FB",
} as const;

/* 近 30 天采集趋势（mock，后续接 /data-source/stats 聚合接口） */
const trend30 = (() => {
  const arr: { dt: string; n: number }[] = [];
  const base = new Date("2026-08-29T00:00:00");
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const k = 29 - i;
    const n = 22 + Math.round(16 * Math.sin(k / 3.2) + ((k * 7) % 23));
    const dt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    arr.push({ dt, n });
  }
  return arr;
})();

/* 来源平台构成（mock：合计 12,846，与数据导入页 KPI 一致） */
const platformStats = [
  { name: "智联招聘", pct: 42, count: "5,392", color: P.primary },
  { name: "BOSS直聘", pct: 26, count: "3,340", color: "#2E9E9A" },
  { name: "前程无忧", pct: 18, count: "2,312", color: "#7468CE" },
  { name: "猎聘", pct: 9, count: "1,156", color: "#D98E1F" },
  { name: "拉勾", pct: 4, count: "514", color: "#E25C4A" },
  { name: "其他渠道", pct: 1, count: "132", color: P.faint },
];

const PLATFORM_TONE: Record<string, string> = {
  "智联招聘": P.primary,
  "BOSS直聘": "#2E9E9A",
  "前程无忧": "#7468CE",
  "猎聘": "#D98E1F",
  "拉勾": P.red,
};

function KpiCard({ children, onClick, featured = false }: {
  children: React.ReactNode; onClick?: () => void; featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all hover:-translate-y-0.5 ${featured ? "text-white cursor-pointer" : "bg-white cursor-pointer hover:shadow-md"}`}
      style={featured
        ? { background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 132 }
        : { border: `1px solid ${P.border}`, minHeight: 132 }}
      onClick={onClick}
    >
      {featured && (
        <>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        </>
      )}
      {children}
    </div>
  );
}

type ReviewPhase = "idle" | "confirm" | "progress" | "result";

export default function RawRecordsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // 复核权限：ADMIN 与 DATA_REVIEWER（前端归一为 reviewer）均可处理清洗后岗位
  const isReviewer = user?.role === "admin" || user?.role === "reviewer";

  const [records, setRecords] = useState<DataSourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [detail, setDetail] = useState<DataSourceItem | null>(null);
  // 双栏 diff 需要：原始记录 + 清洗后详情
  const [sourceDetail, setSourceDetail] = useState<SourceJobDetail | null>(null);
  const [cleanedDetail, setCleanedDetail] = useState<DataSourceDetail | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [viewDiff, setViewDiff] = useState(false);
  const [crawlerRunning, setCrawlerRunning] = useState(false);

  // 勾选
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 批量审核状态
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>("idle");
  const [reviewing, setReviewing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"REVIEW_PASSED" | "REVIEW_REJECT">("REVIEW_PASSED");
  const [reviewProgress, setReviewProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
  const [reviewLogs, setReviewLogs] = useState<{ id: string; name: string; status: "pending" | "success" | "fail"; error?: string }[]>([]);

  const fetchRecords = (silent = false) => {
    if (!silent) setLoading(true);
    getDataSourceList({ page: page - 1, pageSize: 20, reviewStatus: filterStatus || undefined })
      .then((res) => { setRecords(res.data.items ?? []); setTotal(res.data.total ?? 0); })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => { fetchRecords(); }, [page, filterStatus]);

  // 仅在爬虫运行时轮询，停止后自动取消
  useEffect(() => {
    let pollRef: ReturnType<typeof setInterval> | null = null;

    const check = () => {
      getCrawlerStatus()
        .then((res) => {
          const running = res.data.status === "running";
          setCrawlerRunning(running);
          if (running) {
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
  }, [page, filterStatus]);

  // 打开详情：并行拉取原始记录 + 清洗后详情，用于双栏 diff
  const openDetail = (r: DataSourceItem) => {
    setDetail(r);
    setSourceDetail(null);
    setCleanedDetail(null);
    setDiffLoading(true);
    setViewDiff(false);
    setEditing(false);
    setEditForm(emptyEditForm());
    Promise.allSettled([getSourceRecord(r.id), getDataSourceDetail(r.id)]).then(([src, cleaned]) => {
      if (src.status === "fulfilled") setSourceDetail(src.value.data.source);
      if (cleaned.status === "fulfilled") setCleanedDetail(cleaned.value.data.job);
    }).finally(() => setDiffLoading(false));
  };

  const handleReview = async (dsId: string, status: string) => {
    try {
      const res = await reviewDataSource(dsId, status);
      toast.success("审核完成", { description: res.data.job?.source_platform ?? "" });
      setDetail(null);
      setSourceDetail(null);
      setCleanedDetail(null);
      fetchRecords();
    } catch (err) { toast.error((err as Error).message); }
  };

  // ==================== 修改后通过 ====================

  // 编辑表单字段（camelCase，与后端 editReviewRequest 完全一致）
  interface EditForm {
    jobName: string;
    companyName: string;
    salary: string;
    city: string;
    education: string;
    experience: string;
    jobDescription: string;
  }

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm());
  const [savingEdit, setSavingEdit] = useState(false);

  function emptyEditForm(): EditForm {
    return { jobName: "", companyName: "", salary: "", city: "", education: "", experience: "", jobDescription: "" };
  }

  // 打开编辑：初始值优先取清洗后详情，为空回退列表摘要字段
  const openEdit = () => {
    if (!detail) return;
    setEditForm({
      jobName: cleanedDetail?.job_name ?? detail.job_name ?? "",
      companyName: cleanedDetail?.company_name ?? detail.company_name ?? "",
      salary: cleanedDetail?.salary ?? "",
      city: cleanedDetail?.city ?? "",
      education: cleanedDetail?.education ?? "",
      experience: cleanedDetail?.experience ?? "",
      jobDescription: cleanedDetail?.job_description ?? "",
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditForm(emptyEditForm()); };

  const submitEdit = async () => {
    if (!detail) return;
    setSavingEdit(true);
    try {
      await editAndApproveReview(detail.id, editForm);
      toast.success(t("page.rawRecords.reviewUpdated"));
      setDetail(null);
      setSourceDetail(null);
      setCleanedDetail(null);
      setEditing(false);
      setEditForm(emptyEditForm());
      fetchRecords();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const setEditField = (k: keyof EditForm, v: string) => setEditForm(p => ({ ...p, [k]: v }));

  // ==================== 勾选逻辑 ====================

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

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 页头：大标题 + 状态筛选 ===== */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>{t("page.rawRecords.title")}</h1>
          <p className="text-[13px] mt-1" style={{ color: P.muted }}>
            采集与 CSV 注入的样本池：清洗 → 复核 → 进入词典与图谱构建
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "", label: "全部" },
            { key: "PENDING", label: "待复核" },
            { key: "PASSED", label: "已通过" },
            { key: "REJECTED", label: "已驳回" },
          ].map(s => (
            <button key={s.key}
              className="px-4 py-2 rounded-full text-[13px] font-medium transition-colors"
              style={{
                border: `1px solid ${filterStatus === s.key ? P.primary : P.border}`,
                color: filterStatus === s.key ? "white" : P.muted,
                background: filterStatus === s.key ? P.primary : "white",
              }}
              onClick={() => { setFilterStatus(s.key); setPage(1); }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* ===== KPI 统计行 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard featured onClick={() => { setFilterStatus(""); setPage(1); }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>样本总量</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
              <ArrowUpRight size={14} color="#fff" />
            </span>
          </div>
          <div className="text-[32px] font-mono font-semibold leading-tight mt-1">{loading ? "…" : total.toLocaleString()}</div>
          <div className="mt-auto flex items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>今日 +86</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>覆盖 12 个行业大类</span>
          </div>
        </KpiCard>

        {[
          { title: "待复核样本", value: "37", chip: "9 项高优先级", bg: P.amberBg, color: P.amber, warn: true, filter: "PENDING" },
          { title: "复核通过率", value: "89.6%", chip: "全量口径", bg: P.greenBg, color: P.green, filter: "PASSED" },
          { title: "来源平台", value: "6", chip: "爬虫 + CSV 注入", bg: P.skySoft, color: P.primary, filter: "" },
        ].map((k) => (
          <KpiCard key={k.title} onClick={() => { setFilterStatus(k.filter); setPage(1); }}>
            <div className="flex items-start justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.title}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${P.border}` }}>
                <ArrowUpRight size={14} style={{ color: P.faint }} />
              </span>
            </div>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <div className="mt-auto flex items-center gap-1.5">
              {k.warn && <AlertTriangle size={11} style={{ color: k.color }} />}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
            </div>
          </KpiCard>
        ))}
      </div>

      {/* ===== 采集趋势 + 平台构成 + 采集状态 ===== */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="px-5 pt-4 pb-1">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>近 30 天采集趋势</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>每日新增清洗后样本</div>
          </div>
          <div className="px-3 pb-3 pt-2">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={trend30} barSize={8}>
                <CartesianGrid strokeDasharray="4 6" stroke={P.skySoft} vertical={false} />
                <XAxis dataKey="dt" tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.slice(8)} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false} width={26} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12, boxShadow: "0 8px 20px rgba(22,40,62,0.08)" }}
                  cursor={{ fill: P.skySoft }}
                />
                <Bar dataKey="n" name="新增样本" radius={[4, 4, 4, 4]}>
                  {trend30.map((d, i) => (
                    <Cell key={i} fill={i === trend30.length - 1 ? P.primary : d.n >= 50 ? "#7FA6D6" : P.sky} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 bg-white rounded-2xl p-5" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>来源平台构成</div>
            <span className="text-[11px] font-mono" style={{ color: P.faint }}>TOP 6</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {platformStats.map((pf) => (
              <div key={pf.name}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="flex items-center gap-1.5" style={{ color: P.ink }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: pf.color }} />
                    {pf.name}
                  </span>
                  <span className="font-mono" style={{ color: P.faint }}>{pf.count} · {pf.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: P.skySoft }}>
                  <div className="h-full rounded-full" style={{ width: `${pf.pct}%`, background: pf.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-3 rounded-2xl p-5 text-white relative overflow-hidden flex flex-col"
          style={{ background: `linear-gradient(150deg, #16345E 0%, ${P.primaryDeep} 55%, #0C1F3C 100%)`, minHeight: 250 }}>
          <div className="absolute -right-10 -bottom-14 w-40 h-40 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
              <Radio size={15} /> 采集调度
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: crawlerRunning ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: crawlerRunning ? "#5EEAB5" : "#8B99AB" }} />
              {crawlerRunning ? "爬虫运行中" : "已停止"}
            </span>
          </div>
          <div className="mt-4 space-y-2.5 text-[12px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            <div className="flex justify-between"><span>今日新增样本</span><span className="font-mono" style={{ color: "#fff" }}>+86</span></div>
            <div className="flex justify-between"><span>最近一次采集</span><span className="font-mono" style={{ color: "#fff" }}>14:20</span></div>
            <div className="flex justify-between"><span>最近采集城市</span><span className="font-mono" style={{ color: "#fff" }}>常州</span></div>
            <div className="flex justify-between"><span>采集队列</span><span className="font-mono" style={{ color: "#fff" }}>12 个关键词</span></div>
          </div>
          <div className="mt-auto pt-3 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)", borderTop: "1px dashed rgba(255,255,255,0.12)" }}>
            采集与清洗完成后，样本自动进入下方列表等待人工复核
          </div>
        </div>
      </div>

      {/* 顶部批量工具栏 */}
      {isReviewer && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
          <span className="text-[13px] font-medium" style={{ color: P.ink }}>
            已选 {selectedIds.size} 条
          </span>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" disabled={selectedPending.length === 0 || reviewing}
              onClick={() => startBatchReview("approve")}
              title={selectedPending.length === 0 ? "勾选数据中无待复核记录" : "批量通过待复核记录"}>
              批量通过
            </Btn>
            <Btn size="sm" variant="secondary" disabled={!hasSelection || reviewing}
              onClick={() => startBatchReview("reject")}
              title={!hasSelection ? "请勾选至少 1 条记录" : "批量驳回选中记录"}>
              批量驳回
            </Btn>
            {hasSelection && (
              <button className="text-[13px] ml-2" style={{ color: P.faint }} onClick={clearSelection}>
                清空选择
              </button>
            )}
          </div>
          {!hasSelection && (
            <span className="text-[12px]" style={{ color: P.faint }}>勾选记录后可批量通过或驳回</span>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : records.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr style={{ background: P.skySoft }}>
                {isReviewer && (
                  <th className="w-10 px-2 py-2.5">
                    <input type="checkbox" className="accent-[#3996b7] cursor-pointer"
                      checked={records.length > 0 && records.every(r => selectedIds.has(r.id))}
                      onChange={toggleAll}
                      title="全选 / 取消全选" />
                  </th>
                )}
                {[
                  { key: "colSource", width: "w-[12%]", align: "left" },
                  { key: "colJobName", width: "w-[22%]", align: "left" },
                  { key: "colCompany", width: "w-[18%]", align: "left" },
                  { key: "colPublishDate", width: "w-[12%]", align: "center" },
                  { key: "colBatch", width: "w-[12%]", align: "center" },
                  { key: "colReviewStatus", width: "w-[12%]", align: "center" },
                  { key: "colActions", width: "w-[12%]", align: "center" },
                ].map((col) => (
                  <th key={col.key} className={`${col.width} px-2 py-2.5 ${col.align === "center" ? "text-center" : "text-left"} font-medium text-[12px] whitespace-nowrap`} style={{ color: P.muted }}>
                    {t(`page.rawRecords.${col.key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${P.border}` }}>
                    {isReviewer && (
                      <td className="px-2 py-2.5">
                        <input type="checkbox" className="accent-[#1E4C8F] cursor-pointer"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)} />
                      </td>
                    )}
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0"
                          style={{ background: PLATFORM_TONE[r.source_platform] ?? P.faint }}>
                          {(r.source_platform || "?").slice(0, 1)}
                        </span>
                        <span className="text-[12px] truncate" style={{ color: P.muted }} title={r.source_platform}>{r.source_platform || "-"}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-medium truncate" style={{ color: T.ink }} title={r.job_name || undefined}>{r.job_name || "-"}</td>
                    <td className="px-2 py-2.5 truncate" style={{ color: T.ink }} title={r.company_name || undefined}>{r.company_name || "-"}</td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-center" style={{ color: T.info }}>{r.publish_date?.slice(0, 10) || "-"}</td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-center" style={{ color: T.info }}>{r.created_at?.slice(0, 10) || "-"}</td>
                    <td className="px-2 py-2.5 text-center"><StatusBadge status={r.review_status} /></td>
                    <td className="px-2 py-2.5 text-center">
                      <button className="inline-flex items-center justify-center gap-1 text-[12px] font-medium" style={{ color: P.primary }} onClick={() => openDetail(r)}>
                        <Eye size={13} />{t("common.view")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {total > 0 && (
        <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} total={total} />
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
                          <input type="radio" className="accent-[#10B981]" checked={reviewStatus === "REVIEW_PASSED"}
                            onChange={() => setReviewStatus("REVIEW_PASSED")} />
                          <ShieldCheck size={15} style={{ color: T.emerging }} />
                          审核通过
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-[13px] flex-1"
                          style={{
                            border: `1px solid ${reviewStatus === "REVIEW_REJECT" ? T.risk : T.border}`,
                            background: reviewStatus === "REVIEW_REJECT" ? `${T.risk}10` : T.white,
                          }}>
                          <input type="radio" className="accent-[#EF4444]" checked={reviewStatus === "REVIEW_REJECT"}
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

      {/* ==================== 详情抽屉（原始 vs 清洗后 双栏 diff） ==================== */}
      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => { setDetail(null); setSourceDetail(null); setCleanedDetail(null); setEditing(false); }}>
          <div className="ml-auto w-[720px] shrink-0 max-w-[calc(100vw-24px)] h-full bg-white shadow-xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div className="flex items-center gap-3">
                {viewDiff && (
                  <button onClick={() => setViewDiff(false)} className="flex items-center gap-1 text-[13px]" style={{ color: T.teal }}>
                    <ArrowLeft size={16} />{t("page.rawRecords.back")}
                  </button>
                )}
                <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{viewDiff ? t("page.rawRecords.diffTitle") : t("page.rawRecords.detailTitle")}</h3>
              </div>
              <button onClick={() => { setDetail(null); setSourceDetail(null); setCleanedDetail(null); setViewDiff(false); setEditing(false); }} style={{ color: T.info }}><X size={18} /></button>
            </div>

            {viewDiff ? (
              // 原始 vs 清洗后 diff 对比视图（充满抽屉内容区）
              <div className="flex-1 flex flex-col px-5 py-4 min-h-0 overflow-hidden">
                {diffLoading ? (
                  <div className="py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
                ) : sourceDetail && cleanedDetail ? (
                  <DiffViewer rows={buildDiffRows(t, sourceDetail, cleanedDetail)} />
                ) : (
                  <div className="py-8 text-center text-[13px]" style={{ color: T.info }}>{t("page.rawRecords.noDiffData")}</div>
                )}
              </div>
            ) : (
              // 字段详情视图：展示清洗后数据各字段 + 查看原始记录/编辑 + 复核操作
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {editing ? (
                  /* ── 编辑态：替换详情展示，保存后以修改后内容通过复核 ── */
                  <div className="flex min-h-full flex-col space-y-3">
                    <div className="text-[12px] font-medium" style={{ color: T.info }}>{t("page.rawRecords.editFields")}</div>
                    <div className="text-[11px]" style={{ color: T.info }}>{t("page.rawRecords.editHint")}</div>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ["jobName", t("page.rawRecords.jobName")],
                        ["companyName", t("page.rawRecords.companyName")],
                        ["salary", t("page.rawRecords.jobSalary")],
                        ["city", t("page.rawRecords.jobCity")],
                        ["education", t("page.rawRecords.jobEdu")],
                        ["experience", t("page.rawRecords.jobExp")],
                      ] as [keyof EditForm, string][]).map(([k, label]) => (
                        <div key={k}>
                          <label className="text-[11px] block mb-1" style={{ color: T.info }}>{label}</label>
                          <input className="w-full px-2.5 py-1.5 rounded text-[13px] outline-none"
                            style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                            value={editForm[k]} onChange={e => setEditField(k, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <label className="text-[11px] block mb-1" style={{ color: T.info }}>{t("page.rawRecords.jobDesc")}</label>
                      <textarea className="w-full flex-1 min-h-[240px] px-2.5 py-2 rounded text-[13px] leading-relaxed outline-none resize-none"
                        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                        value={editForm.jobDescription} onChange={e => setEditField("jobDescription", e.target.value)} />
                    </div>
                    <div className="flex shrink-0 justify-end gap-2">
                      <Btn variant="secondary" size="sm" onClick={cancelEdit}>{t("page.rawRecords.cancelEdit")}</Btn>
                      <Btn size="sm" onClick={submitEdit} disabled={savingEdit}>{savingEdit ? t("page.rawRecords.saving") : t("page.rawRecords.saveEdit")}</Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    <DetailSection title={t("page.rawRecords.basicInfo")} items={[
                      [t("page.rawRecords.jobName"), cleanedDetail?.job_name ?? detail.job_name ?? "-"],
                      [t("page.rawRecords.companyName"), cleanedDetail?.company_name ?? detail.company_name ?? "-"],
                      [t("page.rawRecords.jobSalary"), cleanedDetail?.salary ?? "-"],
                      [t("page.rawRecords.jobCity"), cleanedDetail?.city ?? "-"],
                      [t("page.rawRecords.jobProvince"), cleanedDetail?.province ?? "-"],
                      [t("page.rawRecords.jobExp"), cleanedDetail?.experience ?? "-"],
                      [t("page.rawRecords.jobEdu"), cleanedDetail?.education ?? "-"],
                      [t("page.rawRecords.jobMajor"), cleanedDetail?.major ?? "-"],
                      [t("page.rawRecords.jobNature"), cleanedDetail?.nature ?? "-"],
                      [t("page.rawRecords.jobTags"), cleanedDetail?.tags ?? "-"],
                      [t("page.rawRecords.jobCompanySize"), cleanedDetail?.company_size ?? "-"],
                      [t("page.rawRecords.sourcePlatform"), cleanedDetail?.source_platform ?? detail.source_platform ?? "-"],
                      [t("page.rawRecords.jobSourceUrl"), cleanedDetail?.source_url ?? "-"],
                      [t("page.rawRecords.publishDate"), (cleanedDetail?.publish_date ?? detail.publish_date)?.slice(0, 10) ?? "-"],
                      [t("page.rawRecords.reviewStatus"), <StatusBadge status={detail.review_status} />],
                      [t("page.rawRecords.reviewDate"), cleanedDetail?.reviewed_at?.slice(0, 10) ?? "-"],
                      [t("page.rawRecords.createDate"), detail.created_at?.slice(0, 10) ?? "-"],
                    ]} />

                    {/* 职位描述 */}
                    {cleanedDetail?.job_description && (
                      <div>
                        <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>{t("page.rawRecords.jobDesc")}</div>
                        <div className="rounded-md p-4 text-[14px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
                          style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}>
                          {cleanedDetail.job_description}
                        </div>
                      </div>
                    )}

                    {/* 查看原始记录 + 编辑 */}
                    <div className="pt-1 flex items-center gap-2">
                      <Btn size="sm" icon={FileText} onClick={() => setViewDiff(true)}>{t("page.rawRecords.viewOriginalRecord")}</Btn>
                      {isReviewer && detail.review_status !== "REVIEW_PASSED" && (
                        <Btn size="sm" variant="secondary" icon={Pencil} onClick={openEdit}>{t("page.rawRecords.edit")}</Btn>
                      )}
                    </div>
                  </>
                )}

                {/* 审核操作：通过 / 驳回 */}
                {!editing && isReviewer && detail.review_status !== "REVIEW_PASSED" && (
                  <div className="flex flex-col gap-2 pt-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <div className="text-[12px] font-medium" style={{ color: T.info }}>{t("page.rawRecords.reviewActions")}</div>
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:opacity-80"
                        style={{ background: "#E6F5F1", color: "#1A6B4E", border: `1px solid #B8E0D2` }}
                        onClick={() => handleReview(detail.id, "REVIEW_PASSED")}>
                        <ShieldCheck size={15} />{t("page.rawRecords.approve")}
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
            )}
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

// 双栏 diff 对比的字段清单：[i18n key, snake_case 字段名]
const DIFF_FIELDS: [string, string][] = [
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
  ["jobCompanySize", "company_size"],
  ["sourcePlatform", "source_platform"],
  ["jobSourceUrl", "source_url"],
  ["publishDate", "publish_date"],
  ["jobDesc", "job_description"],
];

// 对比原始记录与清洗后详情，生成 diff 行（增/删/改/不变）
function buildDiffRows(
  t: (key: string) => string,
  source: SourceJobDetail,
  cleaned: DataSourceDetail,
): DiffRow[] {
  const get = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    if (v == null) return "";
    const s = String(v).trim();
    // 空值字面量（爬虫可能把空字段写成 "null"/"None"/"undefined"）统一归一化为空
    const lower = s.toLowerCase();
    if (s === "" || lower === "null" || lower === "none" || lower === "undefined") return "";
    return s;
  };
  return DIFF_FIELDS.map(([labelKey, fieldKey]) => {
    const left = get(source as unknown as Record<string, unknown>, fieldKey);
    const right = get(cleaned as unknown as Record<string, unknown>, fieldKey);
    let status: DiffRow["status"] = "unchanged";
    if (left && !right) status = "deleted";
    else if (!left && right) status = "added";
    else if (left !== right) status = "modified";
    return { label: t(`page.rawRecords.${labelKey}`), left, right, status };
  });
}
