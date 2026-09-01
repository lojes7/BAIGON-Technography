import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import {
  X, Eye, Search, RotateCcw, Sparkles, ChevronDown, ChevronUp, Star,
  Copy, Download, Clock, Bookmark, SlidersHorizontal, ArrowUpDown,
  Briefcase, Building2, Target, Hash, Globe, Users, GraduationCap, ExternalLink, FileSearch,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getJobDetail, getLatestMyJobMatch, listJobs, matchMyResumeToJob } from "../services/jobs";
import { isHttpErrorStatus } from "../services/http-error";
import type { JobData, JobDetail, JobMatchResult } from "../types/api";
import { Pagination } from "../components/ui";
import AbilityRadialGraph from "../components/AbilityRadialGraph";
import DirectoryPicker from "../components/job-analysis/DirectoryPicker";

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
  violet: "#7468CE",
  violetBg: "#ECEAFA",
  border: "#E4EAF2",
  bg: "#F3F6FB",
  bgSoft: "#FAFBFD",
} as const;

const PIE_COLORS = ["#1E4C8F", "#4E7FBF", "#7FA6D6", "#A9C8EC", "#2E9E9A", "#D98E1F", "#8B99AB"];

/* ===== 本地存储：搜索历史 / 筛选方案 / 收藏 ===== */
type FilterForm = Record<"name" | "company" | "city" | "province" | "salary" | "education" | "nature" | "companySize" | "major" | "majorId" | "occupationId", string>;
const EMPTY_FILTER: FilterForm = { name: "", company: "", city: "", province: "", salary: "", education: "", nature: "", companySize: "", major: "", majorId: "", occupationId: "" };

interface Preset { name: string; filters: FilterForm }

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function saveLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 忽略配额错误 */ }
}

const HOT_JOBS = ["前端开发工程师", "数据分析师", "产品经理", "Java开发工程师", "算法工程师", "运营专员", "测试工程师", "UI设计师"];
const HOT_CITIES = ["杭州", "上海", "北京", "深圳", "广州", "成都", "常州", "南京"];
const EDU_OPTIONS = ["不限", "大专", "本科", "硕士", "博士"];
const NATURE_OPTIONS = ["全职", "兼职", "实习"];
const SIZE_OPTIONS = ["0-20人", "20-99人", "100-499人", "500-999人", "1000-9999人", "10000人以上"];

const FILTER_LABELS: Record<keyof FilterForm, string> = {
  name: "岗位", company: "公司", city: "城市", province: "省份", salary: "薪资",
  education: "学历", nature: "性质", companySize: "规模", major: "专业",
  majorId: "规范专业", occupationId: "规范职业",
};

/* 薪资文本 → 平均 K 值（"15-25K·13薪" → 20） */
function parseSalaryK(s?: string): number | null {
  if (!s) return null;
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*[kK千]/g)].map(m => parseFloat(m[1]));
  if (nums.length === 0) return null;
  return (Math.min(...nums) + Math.max(...nums)) / 2;
}

/* 来源平台 → 图标映射（lucide） */
function platformIcon(platform?: string): ReactNode {
  const p = String(platform ?? "");
  const Icon =
    p.includes("Boss") || p.includes("直聘") ? Building2 :
    p.includes("猎") ? Target :
    p.includes("拉勾") ? Hash :
    p.includes("Linked") || p.includes("领英") ? Globe :
    p.includes("脉脉") ? Users :
    p.includes("实习") ? GraduationCap :
    p.includes("智联") ? Briefcase :
    ExternalLink;
  return <Icon size={12} />;
}

/* 入库时间 → 采集批次（如"2026-07月批次"） */
function inferBatch(createdAt?: string): string {
  if (!createdAt) return "-";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}月批次`;
}

/* 后端可能返回字面量 "null"/"undefined" 字符串，统一按空处理 */
function txt(v?: string | null): string {
  return v && v !== "null" && v !== "undefined" ? v : "";
}

/* ===== 原始记录三列对比：左=原始采集记录 · 中=数据源（来源平台）记录 · 右=岗位查询（归一化）数据 ===== */
interface DiffRow { field: string; raw: string; source: string; normalized: string }

function buildDiffRows(j: JobData): DiffRow[] {
  const d = (v: string) => v || "-";
  const name = d(txt(j.name));
  const company = d(txt(j.companyName));
  const city = d(txt(j.city));
  const prov = txt(j.province);
  const citySrc = [prov, txt(j.city)].filter(Boolean).join(" · ") || "-";
  const salary = d(txt(j.salary));
  const edu = txt(j.education);
  const exp = txt(j.experience);
  const pub = txt(j.publishDate);
  return [
    { field: "岗位名称", raw: name, source: name, normalized: name },
    { field: "公司", raw: company, source: company, normalized: company },
    { field: "城市 / 省份", raw: city, source: d(citySrc), normalized: city },
    { field: "薪资", raw: salary, source: salary, normalized: salary },
    { field: "学历", raw: d(edu ? `${edu}及以上` : "不限"), source: d(edu ? `${edu}及以上` : "学历不限"), normalized: d(edu) },
    { field: "经验", raw: d(exp ? `${exp}经验` : "经验不限"), source: d(exp || "经验不限"), normalized: d(exp) },
    { field: "工作性质", raw: d(txt(j.nature)), source: d(txt(j.nature)), normalized: d(txt(j.nature)) },
    { field: "专业", raw: d(txt(j.major)), source: d(txt(j.major)), normalized: d(txt(j.major)) },
    { field: "公司规模", raw: d(txt(j.companySize)), source: d(txt(j.companySize)), normalized: d(txt(j.companySize)) },
    {
      field: "发布时间",
      raw: d(pub ? `${pub.slice(0, 10)} ${pub.slice(11, 19) || "00:00:00"}` : ""),
      source: d(pub.slice(0, 10)),
      normalized: d(pub.slice(0, 10)),
    },
  ];
}

export default function JobsPage() {
  const [items, setItems] = useState<JobData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FilterForm>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterForm>(EMPTY_FILTER);

  /* 搜索历史 / 联想 / 方案 */
  const [history, setHistory] = useState<string[]>(() => loadLocal("jobs_search_history", [] as string[]));
  const [presets, setPresets] = useState<Preset[]>(() => loadLocal("jobs_filter_presets", [] as Preset[]));
  const [searchFocus, setSearchFocus] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  /* 高级筛选 / 排序 / 选择 / 收藏 */
  const [extraOpen, setExtraOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<string[]>(() => loadLocal("jobs_favorites", [] as string[]));

  /* 详情抽屉与人岗匹配（逻辑不变） */
  const [detail, setDetail] = useState<JobDetail | null>(null);
  /* 原始记录三列对比弹窗 */
  const [rawOf, setRawOf] = useState<JobData | null>(null);
  const detailRequestRef = useRef(0);
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  const fetchList = () => {
    setLoading(true);
    listJobs({
      page: page - 1,
      pageSize: 20,
      name: applied.name || undefined,
      majorId: applied.majorId || undefined,
      occupationId: applied.occupationId || undefined,
      major: applied.major || undefined,
      city: applied.city || undefined,
      province: applied.province || undefined,
      salary: applied.salary || undefined,
      company: applied.company || undefined,
      education: applied.education || undefined,
      nature: applied.nature || undefined,
      companySize: applied.companySize || undefined,
    })
      .then((res) => { setItems(res.data.items ?? []); setTotal(res.data.total ?? 0); setSelected(new Set()); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "岗位列表加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [page, applied]);

  /* ===== 筛选操作 ===== */
  const applySearch = () => {
    setApplied({ ...form });
    setPage(1);
    const kw = form.name.trim();
    if (kw) {
      const next = [kw, ...history.filter(h => h !== kw)].slice(0, 8);
      setHistory(next);
      saveLocal("jobs_search_history", next);
    }
  };

  const resetAll = () => {
    setForm(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
    setSort(null);
    setPage(1);
  };

  /* chips 立即生效；面板文本项走「应用筛选」 */
  const toggleChip = (key: keyof FilterForm, value: string) => {
    const nextVal = form[key] === value ? "" : value;
    const next = { ...form, [key]: nextVal };
    setForm(next);
    setApplied(next);
    setPage(1);
  };

  const removeChip = (key: keyof FilterForm) => {
    const next = { ...form, [key]: "" };
    setForm(next);
    setApplied(next);
    setPage(1);
  };

  const activeChips = (Object.keys(FILTER_LABELS) as (keyof FilterForm)[])
    .filter(k => applied[k]).map(k => ({ key: k, label: FILTER_LABELS[k], value: applied[k] }));

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { toast.error("请输入方案名称"); return; }
    const next = [...presets.filter(p => p.name !== name), { name, filters: { ...applied } }];
    setPresets(next);
    saveLocal("jobs_filter_presets", next);
    setPresetName("");
    setPresetOpen(false);
    toast.success(`筛选方案「${name}」已保存`);
  };

  const applyPreset = (p: Preset) => {
    const filters = { ...EMPTY_FILTER, ...p.filters };
    setForm(filters);
    setApplied(filters);
    setPage(1);
    setPresetOpen(false);
    toast.success(`已加载方案「${p.name}」`);
  };

  const deletePreset = (name: string) => {
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    saveLocal("jobs_filter_presets", next);
  };

  /* ===== 收藏 / 复制 / 导出 ===== */
  const toggleFav = (id: string | number) => {
    const key = String(id);
    const next = favs.includes(key) ? favs.filter(f => f !== key) : [...favs, key];
    setFavs(next);
    saveLocal("jobs_favorites", next);
    toast.success(favs.includes(key) ? "已取消收藏" : "已加入我的收藏");
  };

  const batchFav = () => {
    const add = [...selected].filter(id => !favs.includes(id));
    const next = [...favs, ...add];
    setFavs(next);
    saveLocal("jobs_favorites", next);
    setSelected(new Set());
    toast.success(`已收藏 ${add.length} 个岗位`);
  };

  const copyId = async (id: string | number) => {
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success("岗位 ID 已复制");
    } catch {
      toast.error("浏览器无法访问剪贴板");
    }
  };

  const exportCsv = (rows: JobData[]) => {
    if (rows.length === 0) { toast.error("请先勾选岗位"); return; }
    const header = ["ID", "岗位名称", "公司", "城市", "省份", "薪资", "学历", "经验", "专业", "来源", "发布时间"];
    const lines = rows.map(j => [
      j.id, txt(j.name), txt(j.companyName), txt(j.city), txt(j.province), txt(j.salary),
      txt(j.education), txt(j.experience), txt(j.major), txt(j.sourcePlatform), j.publishDate?.slice(0, 10),
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `岗位导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${rows.length} 条岗位`);
  };

  /* ===== 本页排序 / 统计 ===== */
  type SortKey = "name" | "companyName" | "city" | "salary" | "publishDate";
  const SORTABLE: { key: SortKey; label: string }[] = [
    { key: "name", label: "岗位名称" }, { key: "companyName", label: "公司" },
    { key: "city", label: "城市" }, { key: "salary", label: "薪资" }, { key: "publishDate", label: "发布时间" },
  ];

  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sort.key === "salary") return ((parseSalaryK(a.salary) ?? -1) - (parseSalaryK(b.salary) ?? -1)) * dir;
      if (sort.key === "publishDate") return String(a.publishDate ?? "").localeCompare(String(b.publishDate ?? "")) * dir;
      return String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "zh-CN") * dir;
    });
  }, [items, sort]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => (prev?.key !== key ? { key, dir: "desc" } : prev.dir === "desc" ? { key, dir: "asc" } : null));
  };

  const stats = useMemo(() => {
    const salaryBuckets: Record<string, number> = { "10K以下": 0, "10-20K": 0, "20-35K": 0, "35K以上": 0, "未标注": 0 };
    const cityCount: Record<string, number> = {};
    const eduCount: Record<string, number> = {};
    const companies = new Set<string>();
    for (const j of items) {
      const k = parseSalaryK(j.salary);
      salaryBuckets[k === null ? "未标注" : k < 10 ? "10K以下" : k < 20 ? "10-20K" : k < 35 ? "20-35K" : "35K以上"] += 1;
      if (j.city) cityCount[j.city] = (cityCount[j.city] ?? 0) + 1;
      eduCount[j.education || "未标注"] = (eduCount[j.education || "未标注"] ?? 0) + 1;
      if (j.companyName) companies.add(j.companyName);
    }
    return {
      salary: Object.entries(salaryBuckets).filter(([, n]) => n > 0).map(([name, value]) => ({ name, value })),
      cities: Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
      edu: Object.entries(eduCount).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
      cityTotal: Object.keys(cityCount).length,
      companyTotal: companies.size,
    };
  }, [items]);

  /* ===== 详情抽屉（原逻辑不变） ===== */
  const openDetail = async (id: string | number) => {
    const requestId = ++detailRequestRef.current;
    setDetail(null);
    setMatch(null);
    setMatchLoading(true);
    setMatching(false);
    const [detailResult, matchResult] = await Promise.allSettled([
      getJobDetail(id),
      getLatestMyJobMatch(id),
    ]);
    if (detailRequestRef.current !== requestId) return;

    if (detailResult.status === "fulfilled") {
      setDetail(detailResult.value.data);
    } else {
      toast.error(detailResult.reason instanceof Error ? detailResult.reason.message : "岗位详情加载失败");
    }
    if (matchResult.status === "fulfilled") {
      setMatch(matchResult.value.data);
    } else if (!isHttpErrorStatus(matchResult.reason, 404)) {
      toast.error(matchResult.reason instanceof Error ? matchResult.reason.message : "最近匹配结果加载失败");
    }
    setMatchLoading(false);
  };

  const handleMatch = async () => {
    if (!detail?.job) return;
    const requestId = detailRequestRef.current;
    const jobId = detail.job.id;
    setMatching(true);
    try {
      const res = await matchMyResumeToJob(jobId);
      if (detailRequestRef.current === requestId) setMatch(res.data);
    } catch (err) {
      if (detailRequestRef.current === requestId) toast.error((err as Error).message);
    } finally {
      if (detailRequestRef.current === requestId) setMatching(false);
    }
  };

  const closeDetail = () => {
    detailRequestRef.current += 1;
    setDetail(null);
    setMatch(null);
    setMatchLoading(false);
    setMatching(false);
  };

  /* 联想候选：热门岗位按输入过滤 */
  const suggest = form.name.trim()
    ? HOT_JOBS.filter(k => k.includes(form.name.trim()) && k !== form.name.trim()).slice(0, 5)
    : [];

  const allSelected = items.length > 0 && items.every(j => selected.has(String(j.id)));

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 页头 ===== */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>岗位查询</h1>
          <p className="text-[13px] mt-1" style={{ color: P.muted }}>
            检索已审核岗位，联动规范专业/职业目录，并可直接发起人岗匹配
          </p>
        </div>
        {/* 筛选方案 */}
        <div className="relative">
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium bg-white hover:bg-gray-50 transition-colors"
            style={{ color: P.muted, border: `1px solid ${P.border}` }}
            onClick={() => setPresetOpen(!presetOpen)}>
            <Bookmark size={14} /> 我的筛选方案{presets.length > 0 ? `（${presets.length}）` : ""}
          </button>
          {presetOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPresetOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg z-50 p-3"
                style={{ border: `1px solid ${P.border}` }}>
                {presets.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
                    {presets.map(p => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-gray-50">
                        <button className="text-[13px] font-medium truncate" style={{ color: P.ink }} onClick={() => applyPreset(p)}>{p.name}</button>
                        <button className="text-[11px] flex-shrink-0" style={{ color: P.faint }} onClick={() => deletePreset(p.name)}>删除</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] mb-2" style={{ color: P.faint }}>暂无保存的方案，设置筛选后保存，下次一键加载</div>
                )}
                <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${P.border}` }}>
                  <input className="flex-1 h-8 px-2.5 rounded-lg text-[12px] outline-none" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                    placeholder="方案名称，如：杭州20K+本科" value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && savePreset()} />
                  <button className="px-3 py-1.5 rounded-full text-[12px] font-medium text-white flex-shrink-0"
                    style={{ background: P.primary }} onClick={savePreset}>保存当前</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== 搜索栏 ===== */}
      <div className="bg-white rounded-2xl px-5 py-4 relative z-30" style={{ border: `1px solid ${P.border}` }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px] relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: P.faint }} />
            <input
              className="w-full h-11 pl-11 pr-4 rounded-full text-[14px] outline-none focus:ring-2 transition-shadow"
              style={{ background: P.bg, border: `1px solid ${P.border}`, color: P.ink }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && applySearch()}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => window.setTimeout(() => setSearchFocus(false), 150)}
              placeholder="搜索岗位名称、关键词…"
            />
            {/* 搜索历史 / 联想 */}
            {searchFocus && (history.length > 0 || suggest.length > 0) && (
              <div className="absolute left-0 right-0 top-[52px] bg-white rounded-xl shadow-lg z-50 p-2"
                style={{ border: `1px solid ${P.border}` }}>
                {suggest.length > 0 && (
                  <>
                    <div className="px-2.5 pt-1 pb-1.5 text-[11px]" style={{ color: P.faint }}>热门岗位</div>
                    {suggest.map(s => (
                      <button key={s} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 text-[13px]"
                        style={{ color: P.ink }}
                        onMouseDown={() => { setForm(p => ({ ...p, name: s })); setApplied(p => ({ ...p, name: s })); setPage(1); }}>
                        <Search size={12} className="inline mr-2 -mt-0.5" style={{ color: P.faint }} />{s}
                      </button>
                    ))}
                  </>
                )}
                {history.length > 0 && (
                  <>
                    <div className="px-2.5 pt-2 pb-1.5 text-[11px] flex items-center gap-1" style={{ color: P.faint }}>
                      <Clock size={10} /> 搜索历史
                    </div>
                    {history.map(h => (
                      <button key={h} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 text-[13px]"
                        style={{ color: P.muted }}
                        onMouseDown={() => { setForm(p => ({ ...p, name: h })); setApplied(p => ({ ...p, name: h })); setPage(1); }}>
                        {h}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button className="h-11 px-6 rounded-full text-[14px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: P.primary, boxShadow: "0 8px 16px -6px rgba(30,76,143,0.45)" }}
            onClick={applySearch}>搜索</button>
          <button className="h-11 px-5 rounded-full text-[13px] font-medium bg-white hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
            style={{ color: P.muted, border: `1px solid ${P.border}` }}
            onClick={() => setExtraOpen(!extraOpen)}>
            <SlidersHorizontal size={14} /> 高级筛选
            {activeChips.filter(c => c.key !== "name").length > 0 && (
              <span className="w-5 h-5 rounded-full text-[11px] font-medium text-white flex items-center justify-center"
                style={{ background: P.primary }}>{activeChips.filter(c => c.key !== "name").length}</span>
            )}
            {extraOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="h-11 px-4 rounded-full text-[13px] bg-white hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
            style={{ color: P.faint, border: `1px solid ${P.border}` }}
            onClick={resetAll} title="清除全部筛选条件">
            <RotateCcw size={13} /> 重置
          </button>
        </div>

        {/* 高级筛选面板 */}
        {extraOpen && (
          <div className="mt-4 pt-4 space-y-3.5" style={{ borderTop: `1px solid ${P.border}` }}>
            <div className="flex items-start gap-3">
              <span className="text-[12px] w-14 pt-1.5 flex-shrink-0" style={{ color: P.faint }}>城市</span>
              <div className="flex flex-wrap gap-2">
                {HOT_CITIES.map(c => (
                  <button key={c} className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                    style={form.city === c
                      ? { background: P.primary, color: "#fff" }
                      : { background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}
                    onClick={() => toggleChip("city", c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[12px] w-14 pt-1.5 flex-shrink-0" style={{ color: P.faint }}>学历</span>
              <div className="flex flex-wrap gap-2">
                {EDU_OPTIONS.map(c => (
                  <button key={c} className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                    style={form.education === c
                      ? { background: P.primary, color: "#fff" }
                      : { background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}
                    onClick={() => toggleChip("education", c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[12px] w-14 pt-1.5 flex-shrink-0" style={{ color: P.faint }}>其他条件</span>
              <div className="grid grid-cols-4 gap-3 flex-1">
                <input className="h-9 px-3 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  placeholder="公司名称" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
                <input className="h-9 px-3 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  placeholder="薪资，如 20K" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} />
                <input className="h-9 px-3 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  placeholder="省份" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} />
                <input className="h-9 px-3 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  placeholder="专业关键词" value={form.major} onChange={e => setForm(p => ({ ...p, major: e.target.value }))} />
                <select className="h-9 px-2.5 rounded-lg text-[13px] outline-none bg-white" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  value={form.nature} onChange={e => { setForm(p => ({ ...p, nature: e.target.value })); setApplied(p => ({ ...p, nature: e.target.value })); setPage(1); }}>
                  <option value="">工作性质不限</option>
                  {NATURE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select className="h-9 px-2.5 rounded-lg text-[13px] outline-none bg-white col-span-3" style={{ border: `1px solid ${P.border}`, color: P.ink }}
                  value={form.companySize} onChange={e => { setForm(p => ({ ...p, companySize: e.target.value })); setApplied(p => ({ ...p, companySize: e.target.value })); setPage(1); }}>
                  <option value="">公司规模不限</option>
                  {SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[12px] w-14 pt-1 flex-shrink-0" style={{ color: P.faint }}>规范目录</span>
              <div className="grid grid-cols-2 gap-3 flex-1">
                <DirectoryPicker
                  kind="major"
                  selectedId={form.majorId || null}
                  selectedName={form.majorId ? "已选专业" : ""}
                  onSelect={(id) => { const next = { ...form, majorId: id }; setForm(next); setApplied(next); setPage(1); }}
                />
                <DirectoryPicker
                  kind="occupation"
                  selectedId={form.occupationId || null}
                  selectedName={form.occupationId ? "已选职业" : ""}
                  onSelect={(id) => { const next = { ...form, occupationId: id }; setForm(next); setApplied(next); setPage(1); }}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="px-5 py-2 rounded-full text-[13px] font-medium text-white" style={{ background: P.primary }}
                onClick={applySearch}>应用文本条件</button>
            </div>
          </div>
        )}

        {/* 筛选气泡 */}
        {activeChips.length > 0 && (
          <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: `1px dashed ${P.border}` }}>
            {activeChips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-[12px]"
                style={{ background: P.skySoft, color: P.primary }}>
                <span style={{ color: P.faint }}>{c.label}</span>
                <span className="font-medium max-w-[180px] truncate">{c.value}</span>
                <button className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/70" style={{ color: P.muted }}
                  onClick={() => removeChip(c.key)}>
                  <X size={11} />
                </button>
              </span>
            ))}
            <button className="text-[12px] ml-1 hover:underline" style={{ color: P.red }} onClick={resetAll}>清除全部</button>
          </div>
        )}
      </div>

      {/* ===== KPI 统计行 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 flex flex-col relative overflow-hidden text-white"
          style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 124 }}>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>符合条件岗位</div>
          <div className="text-[30px] font-mono font-semibold leading-tight mt-1">{loading ? "…" : total.toLocaleString()}</div>
          <div className="mt-auto"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)" }}>实时联动筛选</span></div>
        </div>
        {[
          { title: "本页覆盖城市", value: String(stats.cityTotal), chip: "基于当前页样本", bg: P.skySoft, color: P.primary },
          { title: "本页覆盖公司", value: String(stats.companyTotal), chip: "去重统计", bg: P.greenBg, color: P.green },
          { title: "我的收藏岗位", value: String(favs.length), chip: "本地保存", bg: P.amberBg, color: P.amber },
        ].map(k => (
          <div key={k.title} className="rounded-2xl p-5 flex flex-col bg-white hover:shadow-md transition-all hover:-translate-y-0.5"
            style={{ border: `1px solid ${P.border}`, minHeight: 124 }}>
            <div className="text-[13px]" style={{ color: P.muted }}>{k.title}</div>
            <div className="text-[28px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <div className="mt-auto"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span></div>
          </div>
        ))}
      </div>

      {/* ===== 分布看板 ===== */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 pt-4">
              <div className="text-[14px] font-semibold" style={{ color: P.ink }}>薪资分布</div>
              <div className="text-[11px] mt-0.5" style={{ color: P.faint }}>按本页样本解析</div>
            </div>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie data={stats.salary} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {stats.salary.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="px-5 pb-3 flex flex-wrap gap-x-3 gap-y-1">
              {stats.salary.map((s, i) => (
                <span key={s.name} className="text-[11px] flex items-center gap-1" style={{ color: P.muted }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {s.name} {s.value}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 pt-4">
              <div className="text-[14px] font-semibold" style={{ color: P.ink }}>城市岗位数</div>
              <div className="text-[11px] mt-0.5" style={{ color: P.faint }}>TOP 6 · 本页样本</div>
            </div>
            <div className="px-3 pb-3 pt-1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.cities} barSize={14}>
                  <CartesianGrid strokeDasharray="4 6" stroke={P.skySoft} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12 }} cursor={{ fill: P.skySoft }} />
                  <Bar dataKey="value" name="岗位数" radius={[5, 5, 0, 0]}>
                    {stats.cities.map((_, i) => <Cell key={i} fill={i === 0 ? P.primary : P.sky} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 pt-4">
              <div className="text-[14px] font-semibold" style={{ color: P.ink }}>学历要求占比</div>
              <div className="text-[11px] mt-0.5" style={{ color: P.faint }}>本页样本</div>
            </div>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie data={stats.edu} dataKey="value" nameKey="name" outerRadius={60} paddingAngle={2}>
                  {stats.edu.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 1) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="px-5 pb-3 flex flex-wrap gap-x-3 gap-y-1">
              {stats.edu.map((s, i) => (
                <span key={s.name} className="text-[11px] flex items-center gap-1" style={{ color: P.muted }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[(i + 1) % PIE_COLORS.length] }} />
                  {s.name} {s.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 列表 ===== */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${P.border}` }}>
        {/* 批量工具栏 */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-3 px-5 py-3" style={{ background: P.bg, borderBottom: `1px solid ${P.border}` }}>
            <span className="text-[13px] font-medium" style={{ color: P.ink }}>已选 {selected.size} 条</span>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white"
              style={{ color: P.primary, border: `1px solid ${P.border}` }} onClick={() => exportCsv(items.filter(j => selected.has(String(j.id))))}>
              <Download size={12} /> 导出 CSV
            </button>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white"
              style={{ color: P.amber, border: `1px solid ${P.border}` }} onClick={batchFav}>
              <Star size={12} /> 加入收藏
            </button>
            <button className="text-[12px]" style={{ color: P.faint }} onClick={() => setSelected(new Set())}>清空选择</button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <span className="text-[14px] font-semibold" style={{ color: P.ink }}>岗位列表</span>
            <span className="text-[11px] flex items-center gap-1" style={{ color: P.faint }}>
              <ArrowUpDown size={11} /> 点击表头可对本页排序
            </span>
          </div>
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-3.5 rounded bg-gray-100" style={{ width: `${18 + (i * 7) % 14}%` }} />
                <div className="h-3.5 rounded bg-gray-100 flex-1" />
                <div className="h-3.5 rounded bg-gray-100 w-[8%]" />
                <div className="h-3.5 rounded bg-gray-100 w-[8%]" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="text-[14px] font-medium mb-1" style={{ color: P.ink }}>没有找到符合条件的岗位</div>
            <div className="text-[12px] mb-4" style={{ color: P.faint }}>试试热门关键词，或清除部分筛选条件</div>
            <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
              {HOT_JOBS.slice(0, 5).map(k => (
                <button key={k} className="px-3 py-1.5 rounded-full text-[12px]" style={{ background: P.skySoft, color: P.primary }}
                  onClick={() => { setForm(p => ({ ...p, name: k })); setApplied(p => ({ ...p, name: k })); setPage(1); }}>{k}</button>
              ))}
            </div>
            {activeChips.length > 0 && (
              <button className="px-4 py-2 rounded-full text-[13px] font-medium bg-white" style={{ color: P.muted, border: `1px solid ${P.border}` }}
                onClick={resetAll}>清除全部筛选</button>
            )}
          </div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                <th className="w-[36px] pl-4 py-2.5">
                  <input type="checkbox" className="accent-[#1E4C8F] cursor-pointer" checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(items.map(j => String(j.id))))} />
                </th>
                {SORTABLE.map(c => (
                  <th key={c.key} className={`${c.key === "name" ? "w-[14%]" : c.key === "companyName" ? "w-[13%]" : "w-[8%]"} px-3 py-2.5 text-left font-medium text-[12px] whitespace-nowrap`}>
                    <button className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: sort?.key === c.key ? P.primary : P.primaryDeep }}
                      onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="text-[9px] leading-none flex flex-col">
                        <span style={{ opacity: sort?.key === c.key && sort.dir === "desc" ? 1 : 0.3 }}>▼</span>
                        <span style={{ opacity: sort?.key === c.key && sort.dir === "asc" ? 1 : 0.3 }}>▲</span>
                      </span>
                    </button>
                  </th>
                ))}
                {[
                  ["学历", "w-[6%]"], ["经验", "w-[7%]"], ["专业", "w-[8%]"], ["原始记录", "w-[8%]"], ["操作", "w-[11%]"],
                ].map(([h, w]) => (
                  <th key={h} className={`${w} px-3 py-2.5 text-left font-medium text-[12px] whitespace-nowrap`} style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(j => {
                const id = String(j.id);
                const faved = favs.includes(id);
                return (
                  <tr key={id} className="hover:bg-gray-50 transition-colors group" style={{ borderTop: `1px solid ${P.border}` }}>
                    <td className="pl-4 py-3">
                      <input type="checkbox" className="accent-[#1E4C8F] cursor-pointer" checked={selected.has(id)}
                        onChange={() => setSelected(prev => {
                          const n = new Set(prev);
                          if (n.has(id)) { n.delete(id); } else { n.add(id); }
                          return n;
                        })} />
                    </td>
                    <td className="px-3 py-3 font-medium truncate" style={{ color: P.ink }} title={txt(j.name) || undefined}>{txt(j.name) || "-"}</td>
                    <td className="px-3 py-3 truncate" style={{ color: P.muted }} title={txt(j.companyName) || undefined}>{txt(j.companyName) || "-"}</td>
                    <td className="px-3 py-3 text-[12px] truncate" style={{ color: P.muted }} title={[txt(j.city), txt(j.province)].filter(Boolean).join(" · ") || undefined}>{txt(j.city) || "-"}</td>
                    <td className="px-3 py-3 text-[12px] font-medium truncate" style={{ color: P.primary }} title={txt(j.salary) || undefined}>{txt(j.salary) || "-"}</td>
                    <td className="px-3 py-3 font-mono text-[12px] whitespace-nowrap" style={{ color: P.faint }}>{txt(j.publishDate)?.slice(0, 10) || "-"}</td>
                    <td className="px-3 py-3 text-[12px] truncate" style={{ color: P.muted }}>{txt(j.education) || "-"}</td>
                    <td className="px-3 py-3 text-[12px] truncate" style={{ color: P.muted }}>{txt(j.experience) || "-"}</td>
                    <td className="px-3 py-3 text-[12px] truncate" style={{ color: P.muted }} title={txt(j.major) || undefined}>{txt(j.major) || "-"}</td>
                    <td className="px-3 py-3">
                      <button className="text-[12px] font-medium inline-flex items-center gap-1 whitespace-nowrap hover:opacity-80" style={{ color: P.violet }}
                        title="原始记录三列对比（原始采集 / 数据源 / 岗位查询）" onClick={() => setRawOf(j)}>
                        <FileSearch size={12} />对比
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button className="text-[12px] font-medium inline-flex items-center gap-1 whitespace-nowrap" style={{ color: P.primary }} onClick={() => openDetail(j.id)}>
                          <Eye size={12} />详情
                        </button>
                        <button title={faved ? "取消收藏" : "收藏岗位"} className="flex-shrink-0" onClick={() => toggleFav(j.id)}>
                          <Star size={13} style={{ color: faved ? P.amber : P.faint }} fill={faved ? P.amber : "none"} />
                        </button>
                        <button title="复制岗位 ID" style={{ color: P.faint }} className="flex-shrink-0 opacity-60 group-hover:opacity-100" onClick={() => copyId(j.id)}>
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页（全局统一样式） */}
      {total > 0 && (
        <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} total={total} />
      )}

      {/* ==================== 详情抽屉（原能力保留，配色统一） ==================== */}
      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div className="ml-auto w-[600px] max-w-[calc(100vw-24px)] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white z-10" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: P.ink }}>{detail.job?.name || "岗位详情"}</h3>
                <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>
                  {[detail.job?.companyName, detail.job?.city, detail.job?.province].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {detail.job && (
                  <button title="收藏岗位" onClick={() => toggleFav(detail.job!.id)}>
                    <Star size={16} style={{ color: favs.includes(String(detail.job.id)) ? P.amber : P.faint }}
                      fill={favs.includes(String(detail.job.id)) ? P.amber : "none"} />
                  </button>
                )}
                <button onClick={closeDetail} style={{ color: P.faint }}><X size={18} /></button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* 基本信息 */}
              <section>
                <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>基本信息</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  {[
                    ["薪资", detail.job?.salary], ["学历", detail.job?.education],
                    ["经验", detail.job?.experience], ["工作性质", detail.job?.nature],
                    ["专业", detail.job?.major], ["公司规模", detail.job?.companySize],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between" style={{ borderBottom: `1px dashed ${P.border}` }}>
                      <span style={{ color: P.faint }}>{k}</span>
                      <span className="text-right" style={{ color: P.ink }}>{txt(v) || "-"}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 关联专业 */}
              <section>
                <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>关联专业</div>
                {detail.major ? (
                  <div className="rounded-lg p-3" style={{ background: P.bg }}>
                    <div className="text-[13px] font-medium" style={{ color: P.ink }}>{detail.major.name}</div>
                    <div className="mt-0.5 flex gap-3 text-[12px]" style={{ color: P.faint }}>
                      {detail.major.code && <span>编码：{detail.major.code}</span>}
                      <span className="font-mono">ID：{detail.major.id}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px]" style={{ color: P.faint }}>尚未关联规范专业</div>
                )}
              </section>

              {/* 关联职业 */}
              <section>
                <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>关联职业</div>
                {detail.occupation ? (
                  <div className="rounded-lg p-3" style={{ background: P.bg }}>
                    <div className="text-[13px] font-medium" style={{ color: P.ink }}>{detail.occupation.name}</div>
                    {detail.occupation.code && <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>编码：{detail.occupation.code}</div>}
                    <div className="font-mono text-[12px] mt-0.5" style={{ color: P.faint }}>ID：{detail.occupation.id}</div>
                    {detail.occupation.description && <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>{detail.occupation.description}</div>}
                  </div>
                ) : (
                  <div className="text-[13px]" style={{ color: P.faint }}>尚未归类</div>
                )}
              </section>

              {/* 数据源（追溯来源，与 EvidenceDrawer 风格一致） */}
              <section>
                <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>数据源（追溯）</div>
                <div className="rounded-lg p-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                  {/* 来源平台 + 状态 chip */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                        style={{ background: P.skySoft, color: P.primary }}>
                        {platformIcon(detail.job?.sourcePlatform)}
                        {detail.job?.sourcePlatform || "未标注来源"}
                      </span>
                      {txt(detail.job?.sourceUrl) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]"
                          style={{ background: P.greenBg, color: P.green }}>
                          已关联原文链接
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]"
                          style={{ background: P.amberBg, color: P.amber }}>
                          缺少原文链接
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-md"
                      style={{ background: P.skySoft, color: P.muted }}>
                      JOB_{String(detail.job?.id ?? "-")}
                    </span>
                  </div>

                  {/* 追溯信息 */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]" style={{ borderTop: `1px dashed ${P.border}`, paddingTop: 12 }}>
                    <div className="flex justify-between">
                      <span style={{ color: P.faint }}>原文发布时间</span>
                      <span className="font-mono text-right" style={{ color: P.ink }}>
                        {detail.job?.publishDate?.slice(0, 10) || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: P.faint }}>系统入库时间</span>
                      <span className="font-mono text-right" style={{ color: P.ink }}>
                        {detail.job?.createdAt?.slice(0, 10) || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: P.faint }}>采集批次</span>
                      <span className="font-mono text-right" style={{ color: P.ink }}>
                        {inferBatch(detail.job?.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: P.faint }}>最后更新</span>
                      <span className="font-mono text-right" style={{ color: P.ink }}>
                        {detail.job?.updatedAt?.slice(0, 10) || "-"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] mb-0.5" style={{ color: P.faint }}>来源链接</div>
                          {txt(detail.job?.sourceUrl) ? (
                            <a href={txt(detail.job?.sourceUrl)!} target="_blank" rel="noreferrer noopener"
                              className="text-[12px] font-mono break-all hover:underline inline-block max-w-full"
                              style={{ color: P.primary }}>
                              {txt(detail.job?.sourceUrl)}
                            </a>
                          ) : (
                            <span className="text-[12px]" style={{ color: P.faint }}>- （该岗位未提供来源 URL）</span>
                          )}
                        </div>
                        {txt(detail.job?.sourceUrl) && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              className="text-[11px] px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 transition-colors"
                              style={{ background: P.primary, color: "#fff" }}
                              onClick={() => window.open(detail.job?.sourceUrl!, "_blank", "noopener,noreferrer")}
                            >
                              跳转原站
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 能力图谱 */}
              <section>
                <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>
                  能力图谱（{detail.jobSkills?.length ?? 0}）
                </div>
                {detail.jobSkills?.length ? (
                  <div className="rounded-lg p-3" style={{ background: "white", border: `1px solid ${P.border}` }}>
                    <AbilityRadialGraph
                      centerLabel={detail.job?.name || "岗位"}
                      abilities={detail.jobSkills.map(s => ({
                        name: s.skillName,
                        proficiency: s.skillProficiency,
                        evidence: s.evidence,
                      }))}
                      emptyHint="暂无正式技能"
                    />
                  </div>
                ) : (
                  <div className="text-[13px]" style={{ color: P.faint }}>暂无正式技能</div>
                )}
              </section>

              {/* 技能明细 */}
              {detail.jobSkills?.length ? (
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>技能明细</div>
                  <div className="space-y-2">
                    {detail.jobSkills.map(s => (
                      <div key={String(s.id)} className="rounded-lg p-3" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium" style={{ color: P.ink }}>{s.skillName}</span>
                          <div className="flex items-center gap-2">
                            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{
                              background: s.skillId ? P.greenBg : P.amberBg,
                              color: s.skillId ? P.green : P.amber,
                            }}>
                              {s.skillId ? "已归一" : "待归一"}
                            </span>
                            <span className="text-[12px]" style={{ color: P.primary }}>{s.skillProficiency || "-"}</span>
                          </div>
                        </div>
                        {s.skillId && <div className="font-mono text-[11px] mt-1" style={{ color: P.faint }}>规范技能 ID：{s.skillId}</div>}
                        {s.evidence && <div className="text-[12px] mt-1" style={{ color: P.faint }}>{s.evidence}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* 职位描述 */}
              {detail.job?.jobDescription && (
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: P.faint }}>职位描述</div>
                  <div className="rounded-lg p-3 text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ background: P.bg, color: P.ink }}>{detail.job.jobDescription}</div>
                </section>
              )}

              {/* 人岗匹配 */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-medium" style={{ color: P.faint }}>人岗匹配</div>
                  <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium text-white"
                    style={{ background: P.primary }} onClick={handleMatch} disabled={matching}>
                    <Sparkles size={12} />
                    {matching ? "匹配中…" : match ? "重新匹配" : "匹配我的简历"}
                  </button>
                </div>

                {matchLoading ? (
                  <div className="rounded-lg p-4 text-center text-[12px]" style={{ background: P.bg, color: P.faint }}>
                    正在读取最近一次匹配结果…
                  </div>
                ) : match ? (
                  <div className="rounded-lg p-4 space-y-3" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]" style={{ color: P.faint }}>
                      <span>结果 ID：{match.id}</span>
                      <span>简历 ID：{match.resumeId}</span>
                      <span>生成时间：{match.createdAt || "-"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "white", border: `3px solid ${scoreColor(match.score)}` }}>
                        <span className="text-[18px] font-bold font-mono" style={{ color: scoreColor(match.score) }}>
                          {match.score}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium" style={{ color: P.ink }}>匹配度评分</div>
                        {match.summary && (
                          <div className="text-[12px] mt-1 leading-relaxed" style={{ color: P.faint }}>{match.summary}</div>
                        )}
                      </div>
                    </div>

                    {match.skillsToLearn?.length > 0 && (
                      <div>
                        <div className="text-[12px] font-medium mb-2" style={{ color: P.ink }}>
                          待学习技能（{match.skillsToLearn.length}）
                        </div>
                        <div className="space-y-2">
                          {match.skillsToLearn.map((s, i) => (
                            <div key={i} className="rounded-md p-2.5 text-[12px]" style={{ background: "white", border: `1px solid ${P.border}` }}>
                              <div className="font-medium" style={{ color: P.ink }}>{s.skillName}</div>
                              {s.reason && <div className="mt-0.5" style={{ color: P.faint }}>原因：{s.reason}</div>}
                              {s.suggestion && <div className="mt-0.5" style={{ color: P.green }}>建议：{s.suggestion}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.actionSuggestions?.length > 0 && (
                      <div>
                        <div className="text-[12px] font-medium mb-2" style={{ color: P.ink }}>行动建议</div>
                        <ul className="space-y-1">
                          {match.actionSuggestions.map((a, i) => (
                            <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: P.ink }}>
                              <span style={{ color: P.primary }}>•</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  !matching && (
                    <div className="rounded-lg p-4 text-center text-[12px]" style={{ background: P.bg, color: P.faint }}>
                      尚无已保存的匹配结果。点击「匹配我的简历」使用最新简历开始分析
                    </div>
                  )
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 原始记录三列对比弹窗 ==================== */}
      {rawOf && (() => {
        const rows = buildDiffRows(rawOf);
        const platform = txt(rawOf.sourcePlatform);
        const url = txt(rawOf.sourceUrl);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: "rgba(25,50,77,0.35)" }} onClick={() => setRawOf(null)}>
            <div className="w-[1080px] max-w-full max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* 头部 */}
              <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${P.border}` }}>
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <span className="text-[15px] font-semibold whitespace-nowrap" style={{ color: P.ink }}>原始记录对比</span>
                  <span className="text-[13px] truncate" style={{ color: P.muted }}>
                    {txt(rawOf.name) || "-"}{txt(rawOf.companyName) ? ` · ${txt(rawOf.companyName)}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
                    style={{ background: P.skySoft, color: P.primary }}>
                    {platformIcon(platform)}
                    {platform || "未标注来源"}
                  </span>
                  <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: P.bg, color: P.muted }}>
                    JOB_{String(rawOf.id ?? "-")}
                  </span>
                </div>
                <button onClick={() => setRawOf(null)} style={{ color: P.faint }}><X size={18} /></button>
              </div>

              {/* 三列对比体 */}
              <div className="flex-1 overflow-auto px-5 py-4">
                {/* 列头 */}
                <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr" }}>
                  <div />
                  <div className="rounded-lg px-3 py-2" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                    <div className="text-[12px] font-semibold" style={{ color: P.ink }}>原始数据</div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: P.faint }}>爬虫抓取 · 未清洗</div>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                    <div className="text-[12px] font-semibold" style={{ color: P.ink }}>数据源数据</div>
                    <div className="text-[10.5px] mt-0.5 truncate" style={{ color: P.faint }}>来源平台：{platform || "未标注"}</div>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: P.skySoft, border: `1px solid ${P.sky}` }}>
                    <div className="text-[12px] font-semibold" style={{ color: P.primary }}>岗位查询数据</div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: P.muted }}>系统归一化 · 查询返回值</div>
                  </div>
                </div>

                {/* 行（同一字段三列横向对齐，差异标琥珀底） */}
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${P.border}` }}>
                  {rows.map((r, i) => {
                    const diff = r.raw !== r.normalized || r.source !== r.normalized;
                    return (
                      <div key={r.field} className="grid text-[12px]"
                        style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", background: i % 2 ? "#FAFBFD" : "white", borderTop: i ? `1px dashed ${P.border}` : "none" }}>
                        <div className="px-3 py-2.5 font-medium flex items-center" style={{ color: P.muted }}>{r.field}</div>
                        <div className="px-3 py-2.5 break-all flex items-center" style={{ background: diff ? P.amberBg : undefined, color: P.ink }}>{r.raw}</div>
                        <div className="px-3 py-2.5 break-all flex items-center" style={{ background: diff ? P.amberBg : undefined, color: P.ink }}>{r.source}</div>
                        <div className="px-3 py-2.5 break-all flex items-center font-medium" style={{ background: diff ? P.amberBg : P.bgSoft, color: P.primary }}>{r.normalized}</div>
                      </div>
                    );
                  })}
                </div>

                {/* 来源链接 */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ background: P.bg }}>
                  <div className="min-w-0">
                    <div className="text-[11px] mb-0.5" style={{ color: P.faint }}>来源链接</div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer noopener"
                        className="text-[12px] font-mono break-all hover:underline inline-block max-w-full" style={{ color: P.primary }}>
                        {url}
                      </a>
                    ) : (
                      <span className="text-[12px]" style={{ color: P.faint }}>- （该岗位未提供来源 URL）</span>
                    )}
                  </div>
                  {url && (
                    <button className="text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1 transition-colors"
                      style={{ background: P.primary, color: "#fff" }}
                      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                      跳转原站
                    </button>
                  )}
                </div>

                <div className="mt-2 text-[11px] leading-relaxed" style={{ color: P.faint }}>
                  「原始数据 / 数据源数据」暂为演示样例，后端溯源接口就绪后自动替换；「岗位查询数据」为系统实际返回值。琥珀底 = 该字段与查询数据存在差异。
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// 匹配度分数颜色：低分警示、中等提醒、高分达标
function scoreColor(score: number): string {
  if (score >= 80) return P.green;
  if (score >= 60) return P.amber;
  return P.red;
}
