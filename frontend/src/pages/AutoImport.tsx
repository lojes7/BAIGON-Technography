import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, RefreshCw, ArrowRight, ChevronDown, Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { startCrawler, stopCrawler, getCrawlerStatus } from "../services/engineer";
import { PageHeader, Btn, Card, MetricCard, Segmented } from "../components/ui";

const OBJECT_TYPES = [
  { label: "岗位数据", active: true },
  { label: "课程数据", active: true },
  { label: "培养方案", active: true },
  { label: "调研问卷", active: true },
];

// 岗位分类：与 crawler-service JOB_LIST_URL（智联招聘）的 16 个分类一一对应
const JOB_CATEGORIES = [
  "人工智能", "大数据", "智能系统", "物联网", "云计算", "自动化",
  "后端开发", "前端开发", "测试软件", "网络运维", "嵌入式软件",
  "数据挖掘", "机器学习", "硬件测试", "计算机视觉", "数据库工程师",
];

// 单分类最大条数（后端约束 ≤ 1000）
const MAX_DOC_OPTIONS = [100, 300, 500, 1000];

type TaskStatus = "idle" | "running" | "completed" | "stopped";

interface CrawlLog {
  time: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

export default function AutoImportPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const tt = (key: string) => t(`page.autoImport.${key}`);

  /* 采集配置（真实传参：categories 空 = 全部 16 类） */
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [maxDocs, setMaxDocs] = useState(1000);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const [taskStatus, setTaskStatus] = useState<TaskStatus>("idle");
  const [stopping, setStopping] = useState(false);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  /* 运行进度（后端可选字段，未返回时显示占位） */
  const [progress, setProgress] = useState<number | null>(null);
  const [currentCategory, setCurrentCategory] = useState("");
  const [totalCleaned, setTotalCleaned] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const start = localStorage.getItem("crawl_start_time");
    return start ? Math.floor((Date.now() - Number(start)) / 1000) : 0;
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef(false);
  const lastProgressSigRef = useRef("");
  const logBoxRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, level: CrawlLog["level"] = "info") => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), level, message: msg }]);
  };

  // 日志自动滚动到底部
  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs]);

  // 下拉点击外部关闭
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [catOpen]);

  // 页面初始化时检查爬虫是否正在运行
  useEffect(() => {
    getCrawlerStatus().then(res => {
      if (res.data.status === "running") {
        const stored = localStorage.getItem("crawl_start_time");
        if (stored) {
          setTaskStatus("running");
          addLog("检测到爬虫正在运行，恢复状态监控", "info");
        } else {
          localStorage.setItem("crawl_start_time", String(Date.now()));
          setTaskStatus("running");
          addLog("检测到爬虫正在运行，恢复状态监控", "info");
        }
      }
    }).catch(() => {});
  }, []);

  // 计时器 — 每秒 +1（函数式更新 + 局部变量，避免 ref 共享与 localStorage 依赖）
  useEffect(() => {
    if (taskStatus !== "running") return;
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [taskStatus]);

  // 轮询爬虫状态：同步进度字段 + 变化时写入实时日志
  useEffect(() => {
    if (taskStatus !== "running") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollingRef.current) return;
    pollingRef.current = true;

    const poll = async () => {
      try {
        const res = await getCrawlerStatus();
        const d = res.data;
        const p = typeof d.progress === "number" ? d.progress : null;
        const tc = typeof d.totalCleaned === "number" ? d.totalCleaned : null;
        setProgress(p);
        setCurrentCategory(d.currentCategory ?? "");
        setTotalCleaned(tc);

        if (d.status !== "running") {
          setTaskStatus(d.status === "failed" ? "stopped" : "completed");
          localStorage.removeItem("crawl_start_time");
          const tail = tc != null ? `，共清洗 ${tc} 条数据` : "";
          addLog((d.message || "采集任务结束") + tail, "success");
          toast.success(tt("crawlComplete"), { description: tt("crawlCompleteDesc") });
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          pollingRef.current = false;
        } else {
          // 进度变化才写日志，避免刷屏
          const sig = `${d.currentCategory ?? ""}|${p ?? ""}|${tc ?? ""}`;
          if (sig !== lastProgressSigRef.current && (p != null || tc != null || d.currentCategory)) {
            lastProgressSigRef.current = sig;
            const parts: string[] = [];
            if (d.currentCategory) parts.push(`正在采集「${d.currentCategory}」`);
            if (tc != null) parts.push(`已清洗 ${tc} 条`);
            if (p != null) parts.push(`总进度 ${p}%`);
            if (parts.length) addLog(parts.join(" · "), "info");
          }
        }
      } catch {
        // 轮询失败不中断
      }
    };

    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } pollingRef.current = false; };
  }, [taskStatus]);

  const handleStart = async () => {
    try {
      const res = await startCrawler({
        categories: selectedCats.length ? selectedCats : [],
        maxDocuments: maxDocs,
      });
      setTaskStatus("running");
      localStorage.setItem("crawl_start_time", String(Date.now()));
      setElapsedSeconds(0);
      setProgress(null);
      setCurrentCategory("");
      setTotalCleaned(null);
      lastProgressSigRef.current = "";
      addLog(`采集任务已启动 · 岗位分类：${selectedCats.length ? selectedCats.join("、") : `全部 ${JOB_CATEGORIES.length} 类`} · 单类上限 ${maxDocs} 条`, "info");
      if (res.data.trace_id) addLog(`trace_id: ${res.data.trace_id}`, "info");
      addLog("任务已提交后台执行，采集进度将实时同步至下方日志", "info");
      toast.success(tt("crawlStart"), { description: `已采集 ${res.data.count} 条数据` });
    } catch (err) {
      const msg = (err as Error)?.message || "未知错误";
      toast.error(msg);
      addLog(`启动失败：${msg}`, "error");
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopCrawler();
      setTaskStatus("stopped");
      localStorage.removeItem("crawl_start_time");
      addLog("爬虫已手动停止", "warn");
      toast(tt("crawlStop"));
    } catch (err) {
      const msg = (err as Error)?.message || "未知错误";
      toast.error(msg);
      addLog(`停止失败：${msg}`, "error");
    } finally {
      setStopping(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const statusInfo: Record<TaskStatus, { label: string; color: string }> = {
    idle: { label: tt("waiting"), color: T.info },
    running: { label: tt("running"), color: T.emerging },
    completed: { label: tt("completed"), color: T.stable },
    stopped: { label: tt("stopped"), color: T.risk },
  };

  const logLevelColors: Record<CrawlLog["level"], string> = {
    info: T.info,
    success: T.emerging,
    warn: T.pending,
    error: T.risk,
  };

  const toggleCat = (cat: string) => {
    setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const locked = taskStatus === "running";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.autoImport")]}
        title={t("page.autoImport.title")}
        description={t("page.autoImport.desc")}
      />

      {/* ── 采集配置卡（参数真实传给 POST /crawl）── */}
      <Card title="采集配置" action={
        locked ? (
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: T.pending }}>
            <Lock size={11} />任务运行中，配置已锁定
          </span>
        ) : undefined
      }>
        <div className={`px-5 py-4 flex flex-col gap-4 ${locked ? "opacity-60 pointer-events-none" : ""}`}>
          {/* 采集对象 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] flex-shrink-0 w-16" style={{ color: T.info }}>采集对象</span>
            {OBJECT_TYPES.map((o) => (
              o.active ? (
                <span key={o.label}
                  className="px-2.5 py-1 rounded-md text-[12.5px] font-medium"
                  style={{ background: `${T.teal}14`, color: T.teal, border: `1px solid ${T.teal}45` }}>
                  {o.label}
                </span>
              ) : (
                <span key={o.label} title="采集接口暂未开放"
                  className="px-2.5 py-1 rounded-md text-[12.5px] cursor-not-allowed"
                  style={{ background: T.cloud, color: T.info, border: `1px dashed ${T.border}` }}>
                  {o.label} · 即将接入
                </span>
              )
            ))}
          </div>

          {/* 岗位分类 + 单分类上限 */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] flex-shrink-0" style={{ color: T.info }}>岗位分类</span>
              <div className="relative" ref={catRef}>
                <button
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] min-w-[150px] justify-between transition-colors"
                  style={{
                    border: `1px solid ${selectedCats.length ? `${T.teal}60` : T.border}`,
                    color: selectedCats.length ? T.teal : T.ink,
                    background: "white",
                  }}
                  onClick={() => setCatOpen(!catOpen)}
                >
                  {selectedCats.length ? `已选 ${selectedCats.length} 类` : `全部 ${JOB_CATEGORIES.length} 类`}
                  <ChevronDown size={13} style={{ color: T.info }} />
                </button>
                {catOpen && (
                  <div className="absolute top-full left-0 mt-1.5 bg-white rounded-lg shadow-lg z-20 w-[360px]" style={{ border: `1px solid ${T.border}` }}>
                    <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                      <span className="text-[12px]" style={{ color: T.info }}>选择要采集的分类（不选 = 全部）</span>
                      <button
                        className="text-[12px] font-medium"
                        style={{ color: T.teal }}
                        onClick={() => setSelectedCats(selectedCats.length ? [] : [...JOB_CATEGORIES])}
                      >
                        {selectedCats.length ? "清空选择" : "全选"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-1 px-2 py-1.5 max-h-[248px] overflow-y-auto">
                      {JOB_CATEGORIES.map((cat) => {
                        const on = selectedCats.includes(cat);
                        return (
                          <button key={cat}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-gray-50"
                            onClick={() => toggleCat(cat)}
                          >
                            <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                              style={on
                                ? { background: T.teal, border: `1px solid ${T.teal}` }
                                : { background: "white", border: `1px solid ${T.border}` }}>
                              {on && <Check size={10} color="#fff" />}
                            </span>
                            <span style={{ color: on ? T.teal : T.ink }}>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] flex-shrink-0" style={{ color: T.info }}>单分类上限</span>
              <Segmented
                value={String(maxDocs)}
                onChange={(v) => setMaxDocs(Number(v))}
                options={MAX_DOC_OPTIONS.map(n => ({ value: String(n), label: String(n) }))}
              />
              <span className="text-[12px]" style={{ color: T.info }}>条 / 分类</span>
            </div>
          </div>

          {/* 操作引导 */}
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] pt-1" style={{ color: T.info, borderTop: `1px solid ${T.cloud}` }}>
            <span>① 配置参数</span>
            <ArrowRight size={11} style={{ color: T.border }} />
            <span>② 点击「开始采集」</span>
            <ArrowRight size={11} style={{ color: T.border }} />
            <span>③ 下方日志实时查看进度与结果</span>
          </div>
        </div>
      </Card>

      {/* 任务状态卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title={tt("taskStatus")}
          value={statusInfo[taskStatus].label}
          sub={taskStatus === "running" ? t("page.autoImport.elapsedTime", { time: formatTime(elapsedSeconds) }) : undefined}
        />
        <MetricCard
          title="采集进度"
          value={taskStatus === "idle" ? "—" : progress != null ? `${progress}%` : taskStatus === "running" ? "同步中" : "—"}
          sub={taskStatus === "running"
            ? `当前分类：${currentCategory || "初始化中"}`
            : taskStatus === "completed" ? "采集链路执行完毕" : undefined}
        />
        <MetricCard
          title="已清洗条数"
          value={taskStatus === "idle" ? "—" : totalCleaned != null ? totalCleaned : taskStatus === "running" ? "同步中" : "—"}
          sub="经清洗管道写入"
        />
        <MetricCard
          title={tt("targetStorage")}
          value={tt("rawRecordsTable")}
          sub="raw_records"
        />
      </div>

      {/* 运行中：总进度条 */}
      {taskStatus === "running" && progress != null && (
        <div className="rounded-lg bg-white px-4 py-3" style={{ border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between text-[12px] mb-2">
            <span style={{ color: T.ink }}>采集总进度</span>
            <span className="font-mono" style={{ color: T.teal }}>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.cloud }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: `linear-gradient(90deg, #4E7FBF, ${T.teal})` }} />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        {(taskStatus === "idle" || taskStatus === "completed" || taskStatus === "stopped") && (
          <Btn icon={Play} onClick={handleStart}>
            {taskStatus === "completed" ? tt("recrawl") : tt("startCrawl")}
          </Btn>
        )}
        {taskStatus === "running" && (
          <button
            className="inline-flex items-center gap-1.5 text-[13px] px-3 py-[7px] rounded-md font-medium transition-colors disabled:opacity-50"
            style={{ background: T.white, color: T.ink, border: `1px solid ${T.border}` }}
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? <Loader2 className="animate-spin" size={14} /> : <Square size={14} />}
            {stopping ? tt("stopping") : tt("stop")}
          </button>
        )}
        {(taskStatus === "completed" || taskStatus === "stopped") && (
          <Btn variant="secondary" icon={ArrowRight} onClick={() => nav("/raw-records")}>
            {tt("viewRecords")}
          </Btn>
        )}
      </div>

      {/* 实时日志 */}
      <Card
        title={tt("crawlLog")}
        action={
          <button
            className="text-[12px] flex items-center gap-1"
            style={{ color: T.teal }}
            onClick={() => setLogs([])}
          >
            <RefreshCw size={12} />{tt("clear")}
          </button>
        }
      >
        <div className="px-5 pb-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-[13px]" style={{ color: T.info }}>
              {taskStatus === "idle" ? "暂无日志 · 任务启动后，采集进度与结果将实时滚动显示在此处" : tt("noLogs")}
            </div>
          ) : (
            <div
              ref={logBoxRef}
              className="rounded-md p-3 font-mono text-[12px] leading-relaxed max-h-[360px] overflow-y-auto"
              style={{ background: "#1a1a2e", color: "#a8d8a8" }}
            >
              {logs.map((log, i) => (
                <div key={i} style={{ color: logLevelColors[log.level] }}>
                  <span style={{ color: "#666" }}>[{log.time}]</span>{" "}
                  {log.message}
                </div>
              ))}
              {taskStatus === "running" && (
                <div className="mt-1">
                  <span style={{ color: "#666" }}>[{new Date().toLocaleTimeString()}]</span>{" "}
                  <span className="animate-pulse" style={{ color: T.emerging }}>▊</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
