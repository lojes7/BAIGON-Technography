import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import {
  Download, Check, Play, Lock,
  Calendar, Clock, TrendingUp, ChevronRight, Route,
} from "lucide-react";
import { PageHeader, Btn } from "../components/ui";

/* 深蓝主色系（与其他改造页一致） */
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
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

type CourseStatus = "done" | "doing" | "locked";

interface Course {
  name: string; hours: string; status: CourseStatus;
}

interface Phase {
  title: string; courses: Course[];
}

const STATUS: Record<CourseStatus, { color: string; soft: string; icon: typeof Check }> = {
  done: { color: P.green, soft: P.greenBg, icon: Check },
  doing: { color: P.primary, soft: P.skySoft, icon: Play },
  locked: { color: P.faint, soft: "#F1F4F8", icon: Lock },
};

const STATUS_LABEL: Record<CourseStatus, string> = {
  done: "已完成", doing: "进行中", locked: "未开始",
};

const INITIAL_PHASES: Phase[] = [
  {
    title: "第 1 阶段 · 容器化基础 · 第 1–3 周",
    courses: [
      { name: "Docker 基础入门", hours: "8h", status: "done" },
      { name: "Docker Compose 实战", hours: "6h", status: "done" },
      { name: "部署 Spring Boot 到容器", hours: "10h", status: "doing" },
    ],
  },
  {
    title: "第 2 阶段 · 云原生入门 · 第 4–8 周",
    courses: [
      { name: "Kubernetes 基础概念", hours: "12h", status: "locked" },
      { name: "K8s 部署与管理", hours: "16h", status: "locked" },
      { name: "云原生项目实战", hours: "20h", status: "locked" },
    ],
  },
  {
    title: "第 3 阶段 · 分布式基础 · 第 9–12 周",
    courses: [
      { name: "MIT 6.824 分布式系统", hours: "40h", status: "locked" },
      { name: "DDIA 阅读与讨论", hours: "20h", status: "locked" },
    ],
  },
];

export default function LearningPath() {
  const { t } = useTranslation();
  const [phases, setPhases] = useState(INITIAL_PHASES);

  const handleToggleCourse = (phaseIdx: number, courseIdx: number) => {
    setPhases((prev) => {
      const next = prev.map((p) => ({ ...p, courses: [...p.courses] }));
      const course = next[phaseIdx]!.courses[courseIdx]!;
      if (course.status === "locked") {
        course.status = "doing";
        toast.success(`已开始学习：${course.name}`);
      } else if (course.status === "doing") {
        course.status = "done";
        toast.success(`已完成：${course.name}`);
      }
      return next;
    });
  };

  const allCourses = phases.flatMap((p) => p.courses);
  const totalCourses = allCourses.length;
  const doneCount = allCourses.filter((c) => c.status === "done").length;
  const doingCount = allCourses.filter((c) => c.status === "doing").length;
  const lockedCount = allCourses.filter((c) => c.status === "locked").length;
  const overallProgress = Math.round(((doneCount + doingCount * 0.5) / totalCourses) * 100);

  const getPhaseProgress = (phase: Phase) => {
    const total = phase.courses.length;
    const done = phase.courses.filter((c) => c.status === "done").length;
    const doing = phase.courses.filter((c) => c.status === "doing").length;
    return Math.round(((done + doing * 0.5) / total) * 100);
  };
  const getPhaseState = (phase: Phase): CourseStatus => {
    if (phase.courses.every((c) => c.status === "done")) return "done";
    if (phase.courses.some((c) => c.status !== "locked")) return "doing";
    return "locked";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.learningPath")]}
        title={t("page.learningPath.title")}
        description={t("page.learningPath.desc")}
      />

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 强调卡片：总时长（深蓝渐变实心） */}
        <div className="rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, color: "#fff", minHeight: 132 }}>
          <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex items-start justify-between relative">
            <span className="text-[13px] opacity-85">{t("page.learningPath.totalDuration")}</span>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}>
              <Calendar size={15} />
            </span>
          </div>
          <div className="mt-3 relative">
            <div className="text-[26px] font-mono font-semibold leading-tight">12 周</div>
            <div className="text-[12px] mt-0.5 opacity-80">目标岗位 · 后端开发工程师</div>
          </div>
        </div>

        {/* 课程数卡片 */}
        <div className="rounded-2xl p-5 flex flex-col justify-between bg-white" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: P.muted }}>{t("page.learningPath.courseCount")}</span>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: P.skySoft }}>
              <Clock size={15} style={{ color: P.primary }} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[26px] font-mono font-semibold leading-tight" style={{ color: P.ink }}>
              {doneCount}<span className="text-[15px] font-normal" style={{ color: P.faint }}>/{totalCourses} 门</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full" style={{ color: P.green, background: P.greenBg }}>
              <TrendingUp size={11} />较预期提前 2 周
            </span>
          </div>
        </div>

        {/* 预计完成卡片 */}
        <div className="rounded-2xl p-5 flex flex-col justify-between bg-white" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: P.muted }}>{t("page.learningPath.estimatedCompletion")}</span>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: P.greenBg }}>
              <ChevronRight size={15} style={{ color: P.green }} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[26px] font-mono font-semibold leading-tight" style={{ color: P.ink }}>2026-10</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>剩余 8 周</div>
          </div>
        </div>
      </div>

      {/* 整体进度环形图 + 阶段胶囊进度 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${P.border}` }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: P.skySoft }}>
            <Route size={13} style={{ color: P.primary }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>整体进度</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>点击课程卡片可更新学习状态：未开始 → 进行中 → 已完成</div>
          </div>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-8">
          {/* 环形图 */}
          <div className="flex flex-col items-center justify-center gap-4">
            <RingProgress done={doneCount} doing={doingCount} locked={lockedCount} percent={overallProgress} />
            <div className="flex items-center gap-5 text-[12px]" style={{ color: P.muted }}>
              <Legend color={P.green} label={`已完成 ${doneCount}`} />
              <Legend color={P.primary} label={`进行中 ${doingCount}`} />
              <Legend color="#D7DFE9" label={`未开始 ${lockedCount}`} />
            </div>
          </div>

          {/* 各阶段胶囊进度 */}
          <div className="flex flex-col justify-center gap-4">
            <div className="text-[13px] font-semibold" style={{ color: P.ink }}>各阶段完成度</div>
            {phases.map((phase, pi) => {
              const p = getPhaseProgress(phase);
              const state = getPhaseState(phase);
              return (
                <div key={pi}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span style={{ color: P.muted }}>第 {pi + 1} 阶段</span>
                    <span className="font-mono font-semibold" style={{ color: STATUS[state].color }}>{p}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: STATUS[state].color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 学习路径时间轴 */}
      <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.learningPath.learningPath2")}</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>由差距分析报告自动生成 · 共 3 个阶段 12 周</div>
        </div>
        <div className="px-6 py-5">
          <div className="relative">
            <div className="absolute left-[23px] top-6 bottom-6 w-0.5" style={{ background: P.border }} />

            {phases.map((phase, pi) => {
              const state = getPhaseState(phase);
              const p = getPhaseProgress(phase);
              return (
                <div key={pi} className="relative mb-8 last:mb-0">
                  {/* 时间轴节点 */}
                  <div className="absolute left-[17px] top-4 z-10">
                    {state === "done" ? (
                      <span className="w-3.5 h-3.5 rounded-full block" style={{ background: STATUS.done.color }} />
                    ) : state === "doing" ? (
                      <span className="relative block">
                        <span className="absolute -inset-1 rounded-full animate-pulse" style={{ background: "rgba(30,76,143,0.25)" }} />
                        <span className="relative w-3.5 h-3.5 rounded-full block" style={{ background: STATUS.doing.color }} />
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full block bg-white" style={{ border: "2px solid #C6D2E0" }} />
                    )}
                  </div>

                  <div className="ml-12">
                    {/* 阶段标题（卡片头部 + 左侧色条） */}
                    <div className="flex items-center gap-3 mb-3 rounded-xl px-3 py-2.5 bg-white" style={{ border: `1px solid ${P.border}` }}>
                      <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: STATUS[state].color }} />
                      <span className="flex-1 text-[14px] font-semibold" style={{ color: P.ink }}>{phase.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ color: STATUS[state].color, background: STATUS[state].soft }}>
                        {STATUS_LABEL[state]}
                      </span>
                    </div>

                    {/* 进度条 */}
                    <div className="h-2.5 rounded-full overflow-hidden mb-2 max-w-md" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: STATUS[state].color }} />
                    </div>
                    <span className="text-[12px]" style={{ color: P.muted }}>进度 {p}%</span>

                    {/* 课程列表卡片 */}
                    <div className="mt-3 space-y-2">
                      {phase.courses.map((c, ci) => {
                        const s = STATUS[c.status];
                        const Icon = s.icon;
                        const clickable = c.status !== "done";
                        return (
                          <div key={ci}
                            className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white transition-all hover:shadow-sm cursor-pointer"
                            style={{ border: `1px solid ${P.border}`, borderLeft: `3px solid ${s.color}`, background: clickable ? "#fff" : P.bgSoft }}
                            onClick={() => clickable && handleToggleCourse(pi, ci)}
                          >
                            {/* 状态图标框 */}
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.soft }}>
                              <Icon size={15} style={{ color: s.color }} />
                            </span>
                            <span className="flex-1 text-[13px] font-medium truncate" style={{ color: P.ink }}>{c.name}</span>
                            <span className="font-mono text-[12px] flex-shrink-0" style={{ color: P.muted }}>{c.hours}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap" style={{ color: s.color, background: s.soft }}>
                              {STATUS_LABEL[c.status]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3">
        <Btn variant="secondary" onClick={() => toast("切换目标岗位功能：可选择不同岗位的学习路径")}>切换目标岗位</Btn>
        <Btn icon={Download} className="whitespace-nowrap" onClick={() => toast.success("学习计划已导出")}>导出学习计划</Btn>
      </div>
    </div>
  );
}

// 环形进度图：分段显示 done/doing/locked，中心大号百分比
function RingProgress({ done, doing, locked, percent }: { done: number; doing: number; locked: number; percent: number }) {
  const total = done + doing + locked;
  const r = 44;
  const C = 2 * Math.PI * r;
  const doneLen = (done / total) * C;
  const doingLen = (doing / total) * C;

  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 120 120" className="-rotate-90">
        {/* 底环（未开始浅灰） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EAEFF5" strokeWidth="14" />
        {/* 已完成（绿） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke={P.green} strokeWidth="14"
          strokeDasharray={`${doneLen} ${C - doneLen}`} strokeLinecap="round" />
        {/* 进行中（深蓝） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke={P.primary} strokeWidth="14"
          strokeDasharray={`${doingLen} ${C - doingLen}`} strokeDashoffset={-doneLen} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-mono font-bold" style={{ color: P.ink }}>{percent}%</span>
        <span className="text-[12px]" style={{ color: P.muted }}>总体进度</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
