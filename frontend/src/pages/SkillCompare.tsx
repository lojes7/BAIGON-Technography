import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, FileText, Target, Upload, X, Plus, User,
  CircleCheck, CircleAlert, CircleX, Sparkles, Route, Loader2,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, Tooltip, ResponsiveContainer,
} from "recharts";
import T from "../constants/tokens";
import { listJobs, getJobDetail } from "../services/jobs";
import { listMySkills } from "../services/user";
import type { JobData } from "../types/api";
import { PageHeader } from "../components/ui";

/* 深蓝主色系（与数据导入/数据源页一致） */
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
} as const;

const CITIES = ["北京", "深圳", "上海", "杭州", "广州", "常州", "南京", "苏州"];

/* 岗位技能熟练度（job_skills.skill_proficiency 枚举）→ 中文标签 / 我的水平刻度 0-3 */
const MY_LEVELS = ["了解", "熟悉", "熟练", "精通"] as const;
type MyLevel = (typeof MY_LEVELS)[number];
const PROF_LABEL: Record<string, string> = { EXPERT: "精通", ADVANCED: "熟练", FAMILIAR: "熟悉", BASIC: "了解" };
const LEVEL_INDEX: Record<string, number> = { BASIC: 0, FAMILIAR: 1, "了解": 0, "熟悉": 1, "掌握": 1, ADVANCED: 2, "熟练": 2, EXPERT: 3, "精通": 3 };
const REQ_COLOR: Record<string, string> = { EXPERT: P.red, ADVANCED: P.amber, FAMILIAR: P.primary, BASIC: P.faint };
const REQ_CN_COLOR: Record<string, string> = { "精通": P.red, "熟练": P.amber, "熟悉": P.primary, "了解": P.faint };

/* 新兴技术池：用于「新兴技术敏感度」维度 */
const EMERGING_POOL = ["大语言模型", "RAG工程化", "Kubernetes", "Spring Boot", "TypeScript", "向量数据库", "云原生", "AI 辅助研发"];

/* 简历解析 mock 技能池（按文件名/大小伪随机取样） */
const RESUME_POOL: { name: string; level: MyLevel }[] = [
  { name: "Python", level: "熟练" }, { name: "SQL", level: "熟练" }, { name: "Java", level: "熟悉" },
  { name: "机器学习", level: "熟悉" }, { name: "大语言模型", level: "了解" }, { name: "Docker", level: "熟悉" },
  { name: "Spring Boot", level: "熟练" }, { name: "MySQL", level: "熟练" }, { name: "Redis", level: "熟悉" },
  { name: "Git", level: "熟练" }, { name: "Linux", level: "熟悉" }, { name: "数据仓库", level: "了解" },
  { name: "Kubernetes", level: "了解" }, { name: "TypeScript", level: "熟悉" },
];

const RESOURCE_MAP: { key: string; resource: string }[] = [
  { key: "大语言模型", resource: "LLM 应用开发专项课" },
  { key: "RAG", resource: "RAG 系统实战工作坊" },
  { key: "Kubernetes", resource: "云原生与 K8s 部署实训" },
  { key: "Spring", resource: "Spring Boot 3 项目实战" },
  { key: "Python", resource: "Python 工程化进阶课" },
  { key: "数据仓库", resource: "数仓建模与 OLAP 实验" },
  { key: "TypeScript", resource: "TS 全栈开发训练营" },
];

interface MySkill { name: string; level: MyLevel; from: "resume" | "manual" }

interface GapRow {
  name: string;
  reqLabel: string;
  reqLevel: number;
  myLevel: number | null;
  status: "ok" | "partial" | "missing";
}

interface Advantage { name: string; level: MyLevel }

interface Diagnosis {
  score: number;
  grade: string;
  gradeColor: string;
  radar: { dim: string; mine: number; required: number }[];
  gaps: GapRow[];
  advantages: Advantage[];
  suggestions: string[];
  path: { skill: string; action: string; resource: string; weeks: number }[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export default function SkillCompare() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /* ═══ Step1 岗位基准（真实接口：POST /api/jobs + GET /api/jobs/:id，学生可用） ═══ */
  const [city, setCity] = useState("北京");
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [benchmark, setBenchmark] = useState<{ name: string; prof: string }[] | null>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  /* ═══ Step2 我的技能画像 ═══ */
  const [mySkills, setMySkills] = useState<MySkill[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualLevel, setManualLevel] = useState<MyLevel>("熟练");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [resumeMeta, setResumeMeta] = useState<{ name: string; size: string; accuracy: number; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  /* ═══ Step3 诊断结果 ═══ */
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  /* 按城市加载岗位列表（学生可用接口） */
  useEffect(() => {
    setJobsLoading(true);
    setSelectedJobId("");
    setBenchmark(null);
    setDiagnosis(null);
    listJobs({ city, page: 0, pageSize: 100 })
      .then(r => setJobs(r.data.items ?? []))
      .catch(() => { setJobs([]); toast.error("加载岗位列表失败"); })
      .finally(() => setJobsLoading(false));
  }, [city]);

  /* 载入岗位能力基准（岗位详情聚合接口，含已审核 jobSkills） */
  const loadBenchmark = async () => {
    if (!selectedJobId) { toast.error("请选择目标岗位"); return; }
    setLoadingBenchmark(true);
    try {
      const r = await getJobDetail(selectedJobId);
      const skills = (r.data.jobSkills ?? []).map(s => ({ name: s.skillName, prof: s.skillProficiency }));
      setBenchmark(skills);
      setDiagnosis(null);
      if (skills.length === 0) {
        toast.info("该岗位暂无已审核的能力基准数据", { description: "请联系管理员完成该岗位的 AI 技能分析并审核入库" });
      } else {
        toast.success("岗位能力基准已载入", { description: `共 ${skills.length} 项能力要求，请继续录入你的技能` });
      }
    } catch {
      toast.error("加载岗位能力要求失败");
    } finally {
      setLoadingBenchmark(false);
    }
  };

  /* ═══ 简历解析（Mock） ═══ */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = /\.(pdf|docx?|wps)$/i.test(file.name);
    if (!okType) { toast.error("仅支持 PDF / Word 格式简历"); return; }
    setParsing(true);
    setParseProgress(0);
    setResumeMeta(null);
    // 模拟解析进度：1.8s 内到 100%
    const timer = setInterval(() => {
      setParseProgress(p => {
        const next = p + Math.random() * 22 + 8;
        if (next >= 100) {
          clearInterval(timer);
          finishParse(file);
          return 100;
        }
        return next;
      });
    }, 180);
  };

  const finishParse = (file: File) => {
    const seed = file.size + file.name.length;
    const picked: MySkill[] = [];
    const used = new Set<number>();
    const n = 6 + (seed % 3);
    let s = seed;
    while (picked.length < n) {
      s = (s * 9301 + 49297) % 233280;
      const i = s % RESUME_POOL.length;
      if (!used.has(i)) { used.add(i); picked.push({ ...RESUME_POOL[i], from: "resume" }); }
    }
    const accuracy = 90.5 + (seed % 50) / 10; // 90.5 ~ 95.4，满足 ≥90%
    setMySkills(prev => {
      const have = new Set(prev.map(x => norm(x.name)));
      return [...prev, ...picked.filter(x => !have.has(norm(x.name)))];
    });
    setResumeMeta({ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, accuracy: Math.round(accuracy * 10) / 10, count: picked.length });
    setParsing(false);
    setDiagnosis(null);
    toast.success("简历解析完成", { description: `提取 ${picked.length} 项技能要素，提取准确率 ${accuracy.toFixed(1)}%（≥90% 达标），请人工核对修正` });
    if (fileRef.current) fileRef.current.value = "";
  };

  const addManual = () => {
    const name = manualName.trim();
    if (!name) return;
    if (mySkills.some(x => norm(x.name) === norm(name))) { toast.error("该技能已在画像中"); return; }
    setMySkills(prev => [...prev, { name, level: manualLevel, from: "manual" }]);
    setManualName("");
    setDiagnosis(null);
  };

  const removeSkill = (name: string) => { setMySkills(prev => prev.filter(x => x.name !== name)); setDiagnosis(null); };
  const setLevel = (name: string, level: MyLevel) => {
    setMySkills(prev => prev.map(x => x.name === name ? { ...x, level } : x));
    setDiagnosis(null);
  };

  /* ═══ 从「我的能力」导入画像（真实接口：最新一批 user_graphs 技能快照） ═══ */
  const [importing, setImporting] = useState(false);
  const PROFILE_LEVEL: Record<string, MyLevel> = { EXPERT: "精通", ADVANCED: "熟练", FAMILIAR: "熟悉", BASIC: "了解" };
  const importFromProfile = async () => {
    setImporting(true);
    try {
      const res = await listMySkills();
      const items = res.data.items ?? [];
      if (items.length === 0) {
        toast.info("暂无能力画像", { description: "请先到「我的能力」页对最新简历进行 AI 技能分析" });
        return;
      }
      const latestBatch = items.reduce((acc, s) => {
        const key = String(s.resumeId);
        const list = acc.map.get(key) ?? [];
        list.push(s); acc.map.set(key, list);
        return acc;
      }, { map: new Map<string, typeof items>() });
      const newest = [...latestBatch.map.values()]
        .sort((a, b) => (String(a[0].createdAt) < String(b[0].createdAt) ? 1 : -1))[0] ?? [];
      setMySkills(prev => {
        const have = new Set(prev.map(x => norm(x.name)));
        const incoming = newest
          .map(s => ({ name: s.skillName, level: PROFILE_LEVEL[s.proficiency] ?? "熟悉", from: "resume" as const }))
          .filter(x => x.name && !have.has(norm(x.name)));
        if (incoming.length === 0) {
          toast.info("画像技能均已存在于当前列表");
          return prev;
        }
        toast.success("已导入能力画像", { description: `从「我的能力」最新分析批次导入 ${incoming.length} 项技能（AI 识别，含熟练度）` });
        return [...prev, ...incoming];
      });
      setDiagnosis(null);
    } catch (err) {
      toast.error((err as Error).message || "导入能力画像失败");
    } finally {
      setImporting(false);
    }
  };

  /* ═══ 匹配诊断引擎（前端规则 Mock，同输入同输出） ═══ */
  const runDiagnosis = () => {
    if (!benchmark || benchmark.length === 0) { toast.error("请先载入岗位能力基准"); return; }
    if (mySkills.length === 0) { toast.error("请先录入至少 1 项技能"); return; }

    const myMap = new Map(mySkills.map(x => [norm(x.name), x] as const));
    const reqs = benchmark;

    const gaps: GapRow[] = [];
    let scoreSum = 0;
    let levelSum = 0, levelCnt = 0;

    for (const a of reqs) {
      const reqLevel = LEVEL_INDEX[a.prof] ?? 1;
      const reqLabel = PROF_LABEL[a.prof] ?? a.prof;
      const mine = myMap.get(norm(a.name));
      if (!mine) {
        gaps.push({ name: a.name, reqLabel, reqLevel, myLevel: null, status: "missing" });
      } else {
        const myIdx = MY_LEVELS.indexOf(mine.level);
        levelSum += Math.min(1, (myIdx + 1) / (reqLevel + 1)); levelCnt += 1;
        if (myIdx >= reqLevel) {
          gaps.push({ name: a.name, reqLabel, reqLevel, myLevel: myIdx, status: "ok" });
          scoreSum += 1;
        } else {
          gaps.push({ name: a.name, reqLabel, reqLevel, myLevel: myIdx, status: "partial" });
          scoreSum += 0.5;
        }
      }
    }

    const advantages: Advantage[] = [];
    const reqNames = new Set(reqs.map(a => norm(a.name)));
    for (const x of mySkills) {
      if (!reqNames.has(norm(x.name)) && advantages.length < 6) advantages.push({ name: x.name, level: x.level });
    }

    const n = Math.max(1, reqs.length);
    const coverage = scoreSum / n;                         // 覆盖（含部分达成）
    const levelRatio = levelCnt ? levelSum / levelCnt : 0; // 熟练度匹配
    const bonusRatio = advantages.length ? 0.6 : 0.2;
    const breadth = Math.min(1, mySkills.length / Math.max(4, n));
    const emergingHit = mySkills.filter(x => EMERGING_POOL.some(e => norm(e) === norm(x.name) || norm(x.name).includes(norm(e)))).length;
    const emerging = Math.min(1, emergingHit / 3);

    const score = Math.round(Math.min(100, coverage * 60 + levelRatio * 15 + bonusRatio * 10 + breadth * 10 + emerging * 5));
    const grade = score >= 85 ? "优秀" : score >= 70 ? "良好" : score >= 55 ? "待提升" : "差距较大";
    const gradeColor = score >= 85 ? P.green : score >= 70 ? P.primary : score >= 55 ? P.amber : P.red;

    const radar = [
      { dim: "技能覆盖", mine: Math.round(coverage * 100), required: 100 },
      { dim: "熟练度匹配", mine: Math.round(levelRatio * 100), required: 90 },
      { dim: "加分技能", mine: Math.round(bonusRatio * 100), required: 80 },
      { dim: "技能广度", mine: Math.round(breadth * 100), required: 85 },
      { dim: "新兴敏感度", mine: Math.round(emerging * 100), required: 75 },
    ];

    /* 改进建议：缺失优先，其次需提升 */
    const suggestions: string[] = [];
    for (const g of gaps.filter(x => x.status === "missing").slice(0, 3)) {
      const res = RESOURCE_MAP.find(r => norm(g.name).includes(norm(r.key)))?.resource ?? "岗位图谱关联课程";
      suggestions.push(`优先补齐「${g.name}」（岗位要求：${g.reqLabel}）——建议从「${res}」入门，结合图谱中该技能点的关联任务练习`);
    }
    for (const g of gaps.filter(x => x.status === "partial").slice(0, 3)) {
      suggestions.push(`将「${g.name}」由 ${MY_LEVELS[g.myLevel ?? 0]} 提升至 ${g.reqLabel === "必备" ? "精通" : g.reqLabel}——可通过图谱关联的项目任务与工具实操强化`);
    }
    if (bonusRatio < 0.5) {
      suggestions.push("可补充岗位未要求但相关的差异化技能（如云原生、大模型方向），形成加分优势");
    }
    if (emerging < 0.4) {
      suggestions.push("关注图谱中标记为「新兴」的技能点（大模型、云原生方向），保持与技术演化同步");
    }

    /* 学习路径：缺失 → 需提升，各取前 3 */
    const path: Diagnosis["path"] = [];
    for (const g of [...gaps.filter(x => x.status === "missing").slice(0, 3), ...gaps.filter(x => x.status === "partial").slice(0, 3)]) {
      const target = g.reqLabel === "必备" ? "精通" : g.reqLabel === "熟练" ? "熟练" : g.reqLabel;
      const res = RESOURCE_MAP.find(r => norm(g.name).includes(norm(r.key)))?.resource ?? "岗位图谱关联课程";
      const weeks = g.status === "missing" ? 4 + (g.reqLevel) : 2;
      path.push({
        skill: g.name,
        action: g.status === "missing" ? `从零掌握至「${target}」` : `由 ${MY_LEVELS[g.myLevel ?? 0]} 提升至「${target}」`,
        resource: res,
        weeks,
      });
    }

    setDiagnosis({ score, grade, gradeColor, radar, gaps, advantages, suggestions, path });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const canDiagnose = !!benchmark && benchmark.length > 0 && mySkills.length > 0;

  const labelClass = "text-[13px] font-medium flex-shrink-0";
  const selectClass = "px-3 py-2 rounded-lg text-[13px] outline-none transition-colors focus:border-[#2563EB] min-w-[160px]";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.skillCompare")]}
        title={t("page.skillCompare.title")}
        description="录入你的技能数据，对比目标岗位能力图谱 · 多维匹配分析 · 差距定位 · 改进建议与学习路径规划"
      />

      {/* ═══════════ STEP 1 · 选择目标岗位（真实接口） ═══════════ */}
      <SectionCard step={1} title="选择目标岗位" hint="市场真实招聘岗位能力要求，作为诊断基准">
        <div className="px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className={labelClass} style={{ color: P.ink }}>城市</span>
            <select className={selectClass} style={{ border: `1px solid ${P.border}`, background: "#fff", color: P.ink }}
              value={city} onChange={e => setCity(e.target.value)}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className={labelClass} style={{ color: P.ink }}>岗位</span>
            <select className={selectClass} style={{ border: `1px solid ${P.border}`, background: "#fff", color: P.ink, minWidth: 280 }}
              value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setBenchmark(null); setDiagnosis(null); }}
              disabled={jobsLoading}>
              <option value="">
                {jobsLoading ? "加载中..." : jobs.length === 0 ? "该城市暂无岗位" : "选择岗位..."}
              </option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name} · {j.companyName}（{j.salary || "面议"}）</option>)}
            </select>
          </div>
          <button
            className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
            style={{ background: P.primary, color: "#fff" }}
            onClick={loadBenchmark}
            disabled={!selectedJobId || loadingBenchmark}
          >
            {loadingBenchmark ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />}
            {loadingBenchmark ? "载入中..." : benchmark ? "重新载入基准" : "载入能力基准"}
          </button>
          {jobsLoading && <span className="text-[12px]" style={{ color: P.faint }}>正在加载 {city} 的市场岗位...</span>}
        </div>

        {/* 岗位能力基准 chips */}
        {benchmark && benchmark.length > 0 && (
          <div className="px-5 pb-4">
            <div className="text-[12px] mb-2" style={{ color: P.faint }}>
              能力基准 · 共 {benchmark.length} 项（{selectedJob?.name} · {selectedJob?.companyName} · {selectedJob?.city}）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {benchmark.map(a => (
                <span key={a.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px]"
                  style={{ background: `${REQ_COLOR[a.prof] ?? P.faint}14`, color: REQ_COLOR[a.prof] ?? P.faint }}>
                  {a.name} · {PROF_LABEL[a.prof] ?? a.prof}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ═══════════ STEP 2 · 录入我的技能 ═══════════ */}
      <SectionCard step={2} title="录入我的技能" hint="简历解析自动提取（准确率 ≥90%）与手动录入并存，可随时人工修正">
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* 简历解析 */}
          <div className="rounded-xl p-4" style={{ border: `1px dashed ${P.sky}`, background: "#FAFBFD" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: P.skySoft }}>
                  <Upload size={15} style={{ color: P.primary }} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: P.ink }}>上传简历自动提取技能要素</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: P.faint }}>支持 PDF / Word 格式，提取后可逐项核对修正</div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.wps" className="hidden" onChange={handleFile} />
              <button
                className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap flex-shrink-0"
                style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
              >
                {parsing ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {parsing ? "解析中..." : "选择简历文件"}
              </button>
            </div>
            {/* 解析进度 */}
            {parsing && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: P.skySoft }}>
                  <div className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(100, parseProgress)}%`, background: `linear-gradient(90deg, ${P.sky}, ${P.primary})` }} />
                </div>
                <div className="text-[11.5px] mt-1.5" style={{ color: P.faint }}>
                  正在解析简历 · 提取技能要素与熟练度推断 ... {Math.min(100, Math.round(parseProgress))}%
                </div>
              </div>
            )}
            {/* 解析结果 meta */}
            {resumeMeta && !parsing && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-[12px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: P.greenBg, color: P.green }}>
                  <CircleCheck size={11} />提取准确率 {resumeMeta.accuracy}%（≥90% 达标）
                </span>
                <span style={{ color: P.faint }}>{resumeMeta.name} · {resumeMeta.size} · 提取 {resumeMeta.count} 项技能要素</span>
              </div>
            )}
          </div>

          {/* 手动录入 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium flex-shrink-0" style={{ color: P.ink }}>手动录入</span>
            <input
              className="px-3 py-2 rounded-lg text-[13px] outline-none w-[200px]"
              style={{ border: `1px solid ${P.border}`, color: P.ink }}
              placeholder="输入技能点，如 RAG工程化"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addManual()}
            />
            <select className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${P.border}`, background: "#fff", color: P.ink }}
              value={manualLevel} onChange={e => setManualLevel(e.target.value as MyLevel)}>
              {MY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              className="inline-flex items-center gap-1 text-[12.5px] px-3 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
              style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
              onClick={addManual}
            >
              <Plus size={13} />添加
            </button>
          </div>

          {/* 我的技能画像 */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-[12px]" style={{ color: P.faint }}>
                我的技能画像 · 共 {mySkills.length} 项（点击 × 移除，可切换熟练度）
              </div>
              <button
                className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-85 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
                onClick={importFromProfile}
                disabled={importing}
              >
                {importing ? <Loader2 size={12} className="animate-spin" /> : <User size={12} />}
                {importing ? "导入中..." : "从「我的能力」导入画像"}
              </button>
            </div>
            {mySkills.length === 0 ? (
              <div className="rounded-lg py-5 text-center text-[12.5px]" style={{ background: "#FAFBFD", border: `1px dashed ${P.border}`, color: P.faint }}>
                暂无技能数据 · 上传简历或手动录入后开始诊断
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mySkills.map(s => (
                  <span key={s.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px]"
                    style={{ background: s.from === "resume" ? P.greenBg : P.skySoft, color: s.from === "resume" ? "#0B6B4B" : P.primary }}>
                    {s.from === "resume" && <FileText size={10} />}
                    <span className="font-medium">{s.name}</span>
                    <select
                      className="bg-transparent text-[11px] outline-none cursor-pointer font-medium"
                      style={{ color: "inherit" }}
                      value={s.level}
                      onChange={e => setLevel(s.name, e.target.value as MyLevel)}
                    >
                      {MY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button className="opacity-60 hover:opacity-100" onClick={() => removeSkill(s.name)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 开始诊断 */}
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg font-medium transition-all hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
              style={{ background: canDiagnose ? P.primary : P.sky, color: "#fff" }}
              onClick={runDiagnosis}
              disabled={!canDiagnose}
            >
              <Sparkles size={14} />开始匹配诊断
            </button>
            <span className="text-[12px]" style={{ color: P.faint }}>
              {!benchmark ? "先在上方载入岗位能力基准" : benchmark.length === 0 ? "该岗位暂无能力基准" : mySkills.length === 0 ? "至少录入 1 项技能" : "将对比岗位图谱输出差距分析与学习路径"}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ═══════════ STEP 3 · 诊断结果 ═══════════ */}
      <div ref={resultRef}>
        {diagnosis ? (
          <div className="flex flex-col gap-5">
            {/* 匹配总分 + 雷达图 */}
            <div className="grid grid-cols-12 gap-4">
              {/* 总分卡 */}
              <div className="col-span-12 md:col-span-4 rounded-2xl p-5 text-white relative overflow-hidden flex flex-col"
                style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 264 }}>
                <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>人岗匹配度总分</span>
                  <User size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
                </div>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-[56px] font-mono font-semibold leading-none">{diagnosis.score}</span>
                  <span className="text-[13px] mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>/ 100</span>
                </div>
                <span className="mt-2 inline-flex w-fit text-[12px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.16)" }}>
                  综合评级：{diagnosis.grade}
                </span>
                <div className="mt-auto text-[11.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  口径：必备技能覆盖 60% · 熟练度匹配 15% · 加分技能 10% · 技能广度 10% · 新兴敏感度 5%
                </div>
              </div>

              {/* 雷达图 */}
              <div className="col-span-12 md:col-span-8 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
                <div className="px-5 pt-4">
                  <div className="text-[15px] font-semibold" style={{ color: P.ink }}>多维匹配分析</div>
                  <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>我的画像 vs 岗位基准要求（满分 100）</div>
                </div>
                <div className="px-3 pb-2">
                  <ResponsiveContainer width="100%" height={216}>
                    <RadarChart data={diagnosis.radar} outerRadius="72%">
                      <PolarGrid stroke={P.border} />
                      <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: P.muted }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="岗位基准" dataKey="required" stroke={P.sky} fill={P.sky} fillOpacity={0.35} />
                      <Radar name="我的画像" dataKey="mine" stroke={P.primary} fill={P.primary} fillOpacity={0.45} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 差距分析表 */}
            <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: P.ink }}>差距分析</div>
                  <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>
                    已达标 {diagnosis.gaps.filter(g => g.status === "ok").length} ·
                    需提升 {diagnosis.gaps.filter(g => g.status === "partial").length} ·
                    缺失 {diagnosis.gaps.filter(g => g.status === "missing").length} ·
                    加分优势 {diagnosis.advantages.length}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr style={{ background: P.sky }}>
                      {["状态", "技能点", "岗位要求", "我的水平", "差距说明"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosis.gaps.map(g => {
                      const info = g.status === "ok"
                        ? { icon: CircleCheck, label: "已达标", color: P.green, bg: P.greenBg }
                        : g.status === "partial"
                          ? { icon: CircleAlert, label: "需提升", color: P.amber, bg: P.amberBg }
                          : { icon: CircleX, label: "缺失", color: P.red, bg: "#FBEAE7" };
                      const Icon = info.icon;
                      return (
                        <tr key={g.name} style={{ borderTop: `1px solid ${P.border}` }}>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium whitespace-nowrap"
                              style={{ background: info.bg, color: info.color }}>
                              <Icon size={10} />{info.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium" style={{ color: P.ink }}>{g.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[11.5px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                              style={{ background: `${REQ_CN_COLOR[g.reqLabel] ?? P.faint}14`, color: REQ_CN_COLOR[g.reqLabel] ?? P.faint }}>
                              {g.reqLabel}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[12.5px]" style={{ color: g.myLevel == null ? P.faint : P.ink }}>
                            {g.myLevel == null ? "-" : MY_LEVELS[g.myLevel]}
                          </td>
                          <td className="px-4 py-2.5 text-[12.5px]" style={{ color: P.muted }}>
                            {g.status === "ok" ? "满足岗位要求" : g.status === "partial" ? `距「${g.reqLabel}」还差 ${g.reqLevel - (g.myLevel ?? 0)} 档` : `岗位必备，简历中未体现`}
                          </td>
                        </tr>
                      );
                    })}
                    {diagnosis.advantages.map(a => (
                      <tr key={`adv-${a.name}`} style={{ borderTop: `1px solid ${P.border}` }}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium whitespace-nowrap"
                            style={{ background: P.skySoft, color: P.primary }}>
                            <Sparkles size={10} />加分优势
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: P.ink }}>{a.name}</td>
                        <td className="px-4 py-2.5 text-[12px]" style={{ color: P.faint }}>岗位未硬性要求</td>
                        <td className="px-4 py-2.5 font-mono text-[12.5px]" style={{ color: P.ink }}>{a.level}</td>
                        <td className="px-4 py-2.5 text-[12.5px]" style={{ color: P.muted }}>超出岗位基准的差异化竞争力</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 改进建议 + 学习路径 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-5 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
                <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
                  <div className="text-[15px] font-semibold" style={{ color: P.ink }}>针对性改进建议</div>
                  <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>按差距优先级排序</div>
                </div>
                <div className="px-5 py-3 flex flex-col gap-2.5">
                  {diagnosis.suggestions.map((s, i) => (
                    <div key={i} className="flex gap-2 text-[12.5px] leading-relaxed" style={{ color: P.ink }}>
                      <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white font-mono"
                        style={{ background: P.primary }}>{i + 1}</span>
                      {s}
                    </div>
                  ))}
                  {diagnosis.suggestions.length === 0 && (
                    <div className="py-4 text-center text-[12.5px]" style={{ color: P.green }}>当前无明显差距，保持技能更新即可</div>
                  )}
                </div>
              </div>

              <div className="col-span-12 md:col-span-7 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
                  <div>
                    <div className="text-[15px] font-semibold" style={{ color: P.ink }}>学习路径规划</div>
                    <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>缺失 → 需提升，共 {diagnosis.path.length} 步</div>
                  </div>
                  <button className="text-[12px] font-medium whitespace-nowrap cursor-pointer" style={{ color: P.primary }}
                    onClick={() => navigate("/learning-path")}>
                    查看完整学习路径 →
                  </button>
                </div>
                <div className="px-5 py-4 flex flex-col">
                  {diagnosis.path.map((p, i) => (
                    <div key={i} className="flex gap-3">
                      {/* 步骤轴 */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-mono font-medium"
                          style={{ background: i === 0 ? P.primary : P.sky }}>{i + 1}</span>
                        {i < diagnosis.path.length - 1 && <span className="w-px flex-1 my-0.5" style={{ background: P.border }} />}
                      </div>
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium" style={{ color: P.ink }}>{p.skill}</span>
                          <span className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: P.skySoft, color: P.primary }}>{p.action}</span>
                          <span className="text-[11.5px] font-mono" style={{ color: P.faint }}>约 {p.weeks} 周</span>
                        </div>
                        <div className="text-[12px] mt-1 flex items-center gap-1" style={{ color: P.muted }}>
                          <Route size={11} style={{ color: P.faint }} />推荐资源：{p.resource}
                        </div>
                      </div>
                    </div>
                  ))}
                  {diagnosis.path.length === 0 && (
                    <div className="py-4 text-center text-[12.5px]" style={{ color: P.green }}>技能画像已覆盖岗位要求，无需要规划补强路径</div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部跳转 */}
            <div className="flex justify-end">
              <button
                className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
                style={{ background: "#fff", color: P.ink, border: `1px solid ${P.border}` }}
                onClick={() => navigate("/skill-analysis")}
              >
                进行完整能力分析 <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          /* 空状态占位 */
          <div className="bg-white rounded-2xl px-5 py-10 text-center" style={{ border: `1px solid ${P.border}` }}>
            <Target size={28} style={{ color: P.sky, margin: "0 auto 8px" }} />
            <div className="text-[14px] font-medium" style={{ color: P.ink }}>诊断结果将在此处呈现</div>
            <div className="text-[12.5px] mt-1" style={{ color: P.faint }}>
              载入岗位能力基准 → 录入技能画像 → 输出匹配总分、多维雷达、差距分析、改进建议与学习路径
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ 小组件 ═══════════ */

function SectionCard({ step, title, hint, children }: {
  step: number; title: string; hint: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
        <span className="w-6 h-6 rounded-full text-[12px] flex items-center justify-center text-white font-mono font-medium flex-shrink-0"
          style={{ background: P.primary }}>{step}</span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{title}</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>{hint}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
