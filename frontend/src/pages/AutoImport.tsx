import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, RefreshCw, ArrowRight, ChevronDown, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import { startCrawler, stopCrawler, getCrawlerStatus } from "../services/engineer";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";

// 数据类型 — 平铺高频项，低频收进下拉
const DATA_TYPES_FLAT = [
  { value: "all", label: "全部类型" },
  { value: "recruitment", label: "招聘数据" },
  { value: "course", label: "课程数据" },
];
const DATA_TYPES_MORE = [
  { value: "training", label: "培养方案" },
  { value: "survey", label: "调研问卷" },
];

// 地区 — 江苏省常用市平铺，全国省-市放进下拉
const REGIONS_FLAT = [
  { value: "", label: "全部地区" },
  { value: "常州", label: "常州市" },
  { value: "南京", label: "南京市" },
  { value: "苏州", label: "苏州市" },
];
const PROVINCES: Record<string, string[]> = {
  "江苏": ["常州", "南京", "苏州", "无锡", "南通", "徐州", "扬州", "镇江", "盐城", "泰州", "淮安", "连云港", "宿迁"],
  "浙江": ["杭州", "宁波", "温州", "嘉兴", "湖州", "绍兴", "金华", "衢州", "舟山", "台州", "丽水"],
  "上海": ["上海"],
  "北京": ["北京"],
  "广东": ["广州", "深圳", "东莞", "佛山", "珠海", "中山", "惠州"],
  "山东": ["济南", "青岛", "烟台", "潍坊", "临沂", "淄博"],
};

// 产业 — 多选下拉
const INDUSTRIES = [
  "人工智能", "大数据", "云计算", "物联网", "智能制造",
  "新能源", "生物医药", "集成电路", "软件与信息服务", "新材料",
];

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

  const [dataType, setDataType] = useState("all");
  const [region, setRegion] = useState("常州");
  const [industries, setIndustries] = useState<string[]>([]);
  const [moreTypeOpen, setMoreTypeOpen] = useState(false);
  const [regionDropdown, setRegionDropdown] = useState(false);
  const [selProvince, setSelProvince] = useState("");
  const [industryOpen, setIndustryOpen] = useState(false);

  const [taskStatus, setTaskStatus] = useState<TaskStatus>("idle");
  const [stopping, setStopping] = useState(false);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const start = localStorage.getItem("crawl_start_time");
    return start ? Math.floor((Date.now() - Number(start)) / 1000) : 0;
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef(false);

  const addLog = (msg: string, level: CrawlLog["level"] = "info") => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), level, message: msg }]);
  };

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

  // 轮询爬虫状态
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
        if (res.data.status !== "running") {
          setTaskStatus(res.data.status === "failed" ? "stopped" : "completed");
          localStorage.removeItem("crawl_start_time");
          addLog(res.data.message || "爬虫已停止运行", "success");
          toast.success(tt("crawlComplete"), { description: tt("crawlCompleteDesc") });
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          pollingRef.current = false;
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
      const res = await startCrawler();
      setTaskStatus("running");
      localStorage.setItem("crawl_start_time", String(Date.now()));
      setElapsedSeconds(0);
      addLog(`爬虫任务已启动，trace_id: ${res.data.trace_id}，采集 ${res.data.count} 条`, "info");
      addLog("正在爬取数据...", "info");
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.autoImport")]}
        title={t("page.autoImport.title")}
        description={t("page.autoImport.desc")}
      />

      {/* 已选条件标签 */}
      {(dataType !== "all" || region !== "" || industries.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px]" style={{ color: T.info }}>{tt("selected")}</span>
          {dataType !== "all" && (
            <Tag label={[...DATA_TYPES_FLAT, ...DATA_TYPES_MORE].find(d => d.value === dataType)?.label ?? dataType} onRemove={() => setDataType("all")} />
          )}
          {region !== "" && (
            <Tag label={region} onRemove={() => setRegion("")} />
          )}
          {industries.map(ind => (
            <Tag key={ind} label={ind} onRemove={() => setIndustries(prev => prev.filter(i => i !== ind))} />
          ))}
          <button className="text-[12px]" style={{ color: T.risk }} onClick={() => { setDataType("all"); setRegion(""); setIndustries([]); }}>{tt("clearAll")}</button>
        </div>
      )}

      {/* ── 筛选条件 ── */}
      {/* 第一行：数据类型 */}
      <div className="rounded-lg px-4 py-3" style={{ background: "#F7F9FB", border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium flex-shrink-0 w-20" style={{ color: T.ink }}>{tt("dataType")}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DATA_TYPES_FLAT.map(dt => (
              <button key={dt.value}
                className="px-3 py-1.5 rounded-md text-[13px] transition-colors"
                style={{
                  border: `1px solid ${dataType === dt.value ? T.teal : T.border}`,
                  color: dataType === dt.value ? "white" : T.ink,
                  background: dataType === dt.value ? T.teal : "white",
                }}
                onClick={() => setDataType(dt.value)}
              >{dt.label}</button>
            ))}
            {/* 更多下拉 */}
            <div className="relative">
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] transition-colors"
                style={{ border: `1px solid ${T.border}`, color: T.ink, background: "white" }}
                onClick={() => setMoreTypeOpen(!moreTypeOpen)}
              >{tt("moreDataTypes")} <ChevronDown size={12} style={{ color: T.info }} /></button>
              {moreTypeOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg z-20 py-1 min-w-[140px]" style={{ border: `1px solid ${T.border}` }}>
                  {DATA_TYPES_MORE.map(dt => (
                    <button key={dt.value}
                      className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50"
                      style={{ color: dataType === dt.value ? T.teal : T.ink }}
                      onClick={() => { setDataType(dt.value); setMoreTypeOpen(false); }}
                    >{dt.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 第二行：地区区域 */}
      <div className="rounded-lg px-4 py-3" style={{ background: "#F7F9FB", border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium flex-shrink-0 w-20" style={{ color: T.ink }}>{tt("region")}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {REGIONS_FLAT.map(r => (
              <button key={r.value}
                className="px-3 py-1.5 rounded-md text-[13px] transition-colors"
                style={{
                  border: `1px solid ${region === r.value ? T.teal : T.border}`,
                  color: region === r.value ? "white" : T.ink,
                  background: region === r.value ? T.teal : "white",
                }}
                onClick={() => setRegion(r.value)}
              >{r.label}</button>
            ))}
            {/* 全国省-市下拉 */}
            <div className="relative">
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] transition-colors"
                style={{ border: `1px solid ${T.border}`, color: T.ink, background: "white" }}
                onClick={() => setRegionDropdown(!regionDropdown)}
              >{tt("moreRegions")} <ChevronDown size={12} style={{ color: T.info }} /></button>
              {regionDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg z-20 py-2 flex" style={{ border: `1px solid ${T.border}`, minWidth: 280 }}>
                  {/* 省份列 */}
                  <div className="w-24 border-r max-h-[260px] overflow-y-auto" style={{ borderColor: T.cloud }}>
                    {Object.keys(PROVINCES).map(prov => (
                      <button key={prov}
                        className="w-full text-left px-3 py-1.5 text-[12px]"
                        style={{ color: selProvince === prov ? T.teal : T.ink, background: selProvince === prov ? `${T.teal}10` : "transparent" }}
                        onClick={() => setSelProvince(prov)}
                      >{prov}</button>
                    ))}
                  </div>
                  {/* 城市列 */}
                  <div className="flex-1 max-h-[260px] overflow-y-auto">
                    {selProvince && PROVINCES[selProvince]?.map(city => (
                      <button key={city}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50"
                        style={{ color: region === city ? T.teal : T.ink }}
                        onClick={() => { setRegion(city); setRegionDropdown(false); setSelProvince(""); }}
                      >{city}</button>
                    ))}
                    {!selProvince && <div className="px-3 py-2 text-[12px]" style={{ color: T.info }}>{tt("selectProvince")}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 第三行：产业范围 */}
      <div className="rounded-lg px-4 py-3" style={{ background: "#F7F9FB", border: `1px solid ${T.border}` }}>
        <div className="flex items-start gap-3">
          <span className="text-[13px] font-medium flex-shrink-0 w-20 mt-1" style={{ color: T.ink }}>{tt("industry")}</span>
          <div className="flex-1">
            {/* 已选标签 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {industries.map(ind => (
                <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px]"
                  style={{ background: `${T.teal}15`, color: T.teal, border: `1px solid ${T.teal}30` }}>
                  {ind}
                  <button onClick={() => setIndustries(prev => prev.filter(i => i !== ind))} style={{ color: T.teal }}><X size={11} /></button>
                </span>
              ))}
              <div className="relative">
                <button className="flex items-center gap-1 px-2 py-0.5 rounded text-[12px]"
                  style={{ border: `1px dashed ${T.border}`, color: T.info }}
                  onClick={() => setIndustryOpen(!industryOpen)}
                >{industries.length === 0 ? tt("selectIndustry") : tt("addIndustry")} <ChevronDown size={11} /></button>
                {industryOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg z-20 py-1 max-h-[220px] overflow-y-auto" style={{ border: `1px solid ${T.border}`, minWidth: 160 }}>
                    {INDUSTRIES.map(ind => (
                      <button key={ind}
                        className="w-full text-left px-4 py-1.5 text-[12px] hover:bg-gray-50 flex items-center gap-2"
                        style={{ color: industries.includes(ind) ? T.teal : T.ink }}
                        onClick={() => {
                          setIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
                        }}
                      >{industries.includes(ind) && <span style={{ color: T.teal }}>✓</span>}{ind}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 任务状态卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title={tt("taskStatus")}
          value={statusInfo[taskStatus].label}
          sub={taskStatus === "running" ? t("page.autoImport.elapsedTime", { time: formatTime(elapsedSeconds) }) : undefined}
        />
        <MetricCard
          title={tt("crawledCount")}
          value={taskStatus === "idle" ? "—" : (taskStatus === "running" ? tt("crawling2") : "—")}
          sub={taskStatus === "completed" ? tt("crawlCompleteDesc") : undefined}
        />
        <MetricCard
          title={tt("dataSource")}
          value={region || tt("allRegions")}
          sub={[...DATA_TYPES_FLAT, ...DATA_TYPES_MORE].find(d => d.value === dataType)?.label ?? "—"}
        />
        <MetricCard
          title={tt("targetStorage")}
          value={tt("rawRecordsTable")}
          sub="raw_records"
        />
      </div>

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
              {taskStatus === "idle" ? tt("logHint") : tt("noLogs")}
            </div>
          ) : (
            <div
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

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px]"
      style={{ background: `${T.teal}12`, color: T.teal, border: `1px solid ${T.teal}30` }}>
      {label}
      <button onClick={onRemove} style={{ color: T.teal }}><X size={11} /></button>
    </span>
  );
}
