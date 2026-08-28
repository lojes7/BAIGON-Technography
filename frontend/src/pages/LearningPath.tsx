import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import {
  Download, ChevronDown, Check, Play, Lock,
  Calendar, Clock, TrendingUp, ChevronRight,
} from "lucide-react";
import { PageHeader, Btn, Card } from "../components/ui";

type CourseStatus = "done" | "doing" | "locked";

interface Course {
  name: string; hours: string; status: CourseStatus;
}

interface Phase {
  title: string; courses: Course[];
}

const STATUS: Record<CourseStatus, { color: string; soft: string; icon: typeof Check }> = {
  done: { color: "#22C55E", soft: "#DCFCE7", icon: Check },
  doing: { color: "#3B6FE0", soft: "#DBEAFE", icon: Play },
  locked: { color: "#9CA3AF", soft: "#F3F4F6", icon: Lock },
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
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.learningPath")]}
        title={t("page.learningPath.title")}
        description={t("page.learningPath.desc")}
      />

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 强调卡片：总时长（主题色实心） */}
        <div className="rounded-xl p-5 flex flex-col justify-between" style={{ background: "#3B6FE0", color: "#fff", boxShadow: "0 10px 15px -3px rgba(59,111,224,0.3)" }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px] opacity-80">{t("page.learningPath.totalDuration")}</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <Calendar size={16} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold leading-tight">12 周</div>
            <div className="text-[12px] mt-1 opacity-80">目标岗位 · 后端开发工程师</div>
          </div>
        </div>

        {/* 课程数卡片 */}
        <div className="rounded-xl p-5 flex flex-col justify-between bg-white" style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "#6B7280" }}>{t("page.learningPath.courseCount")}</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
              <Clock size={16} style={{ color: "#6B7280" }} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold leading-tight" style={{ color: "#111827" }}>{doneCount}<span className="text-[16px] font-medium" style={{ color: "#9CA3AF" }}>/{totalCourses} 门</span></div>
            <span className="inline-flex items-center gap-1 mt-1 text-[12px] px-2 py-0.5 rounded-full" style={{ color: "#16A34A", background: "#DCFCE7" }}>
              <TrendingUp size={12} />较预期提前 2 周
            </span>
          </div>
        </div>

        {/* 预计完成卡片 */}
        <div className="rounded-xl p-5 flex flex-col justify-between bg-white" style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "#6B7280" }}>{t("page.learningPath.estimatedCompletion")}</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
              <ChevronRight size={16} style={{ color: "#6B7280" }} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-[28px] font-bold leading-tight" style={{ color: "#111827" }}>2026-10</div>
            <div className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>剩余 8 周</div>
          </div>
        </div>
      </div>

      {/* 整体进度环形图 + 阶段胶囊进度 */}
      <Card>
        <div className="px-6 py-5 grid grid-cols-2 gap-8">
          {/* 环形图 */}
          <div className="flex flex-col items-center justify-center gap-4">
            <RingProgress done={doneCount} doing={doingCount} locked={lockedCount} percent={overallProgress} />
            <div className="flex items-center gap-5 text-[12px]" style={{ color: "#6B7280" }}>
              <Legend color="#22C55E" label={`已完成 ${doneCount}`} />
              <Legend color="#3B6FE0" label={`进行中 ${doingCount}`} />
              <Legend color="#9CA3AF" label={`未开始 ${lockedCount}`} />
            </div>
          </div>

          {/* 各阶段胶囊进度 */}
          <div className="flex flex-col justify-center gap-4">
            <div className="text-[13px] font-semibold" style={{ color: "#111827" }}>各阶段完成度</div>
            {phases.map((phase, pi) => {
              const p = getPhaseProgress(phase);
              const state = getPhaseState(phase);
              return (
                <div key={pi}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span style={{ color: "#374151" }}>第 {pi + 1} 阶段</span>
                    <span className="font-semibold" style={{ color: STATUS[state].color }}>{p}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: STATUS[state].color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 学习路径时间轴 */}
      <Card title={t("page.learningPath.learningPath2")}>
        <div className="px-6 py-5">
          <div className="relative">
            <div className="absolute left-[23px] top-6 bottom-6 w-0.5" style={{ background: "#E5E7EB" }} />

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
                        <span className="absolute -inset-1 rounded-full animate-pulse" style={{ background: "rgba(59,111,224,0.25)" }} />
                        <span className="relative w-3.5 h-3.5 rounded-full block" style={{ background: STATUS.doing.color }} />
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full block" style={{ background: "#fff", border: `2px solid #D1D5DB` }} />
                    )}
                  </div>

                  <div className="ml-12">
                    {/* 阶段标题（卡片头部 + 左侧色条） */}
                    <div className="flex items-center gap-3 mb-3 rounded-lg px-3 py-2.5 bg-white" style={{ border: "1px solid #E5E7EB" }}>
                      <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: STATUS[state].color }} />
                      <span className="flex-1 text-[14px] font-semibold" style={{ color: "#111827" }}>{phase.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: STATUS[state].color, background: STATUS[state].soft }}>
                        {STATUS_LABEL[state]}
                      </span>
                    </div>

                    {/* 加宽进度条 */}
                    <div className="h-2.5 rounded-full overflow-hidden mb-2 max-w-md" style={{ background: "#F3F4F6" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: STATUS[state].color }} />
                    </div>
                    <span className="text-[12px]" style={{ color: "#6B7280" }}>进度 {p}%</span>

                    {/* 课程列表卡片 */}
                    <div className="mt-3 space-y-2">
                      {phase.courses.map((c, ci) => {
                        const s = STATUS[c.status];
                        const Icon = s.icon;
                        const clickable = c.status !== "done";
                        return (
                          <div key={ci}
                            className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white transition-all hover:shadow-sm cursor-pointer"
                            style={{ border: "1px solid #E5E7EB", borderLeft: `3px solid ${s.color}` }}
                            onClick={() => clickable && handleToggleCourse(pi, ci)}
                          >
                            {/* 状态图标框 */}
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.soft }}>
                              <Icon size={15} style={{ color: s.color }} />
                            </span>
                            <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "#111827" }}>{c.name}</span>
                            <span className="font-mono text-[12px] flex-shrink-0" style={{ color: "#6B7280" }}>{c.hours}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: s.color, background: s.soft }}>
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
      </Card>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3">
        <Btn variant="secondary" icon={ChevronDown} onClick={() => toast("切换目标岗位功能：可选择不同岗位的学习路径")}>切换目标岗位</Btn>
        <Btn icon={Download} onClick={() => toast.success("学习计划已导出")}>导出学习计划</Btn>
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
        {/* 底环（未开始灰） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F3F4F6" strokeWidth="14" />
        {/* 已完成（绿） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#22C55E" strokeWidth="14"
          strokeDasharray={`${doneLen} ${C - doneLen}`} strokeLinecap="round" />
        {/* 进行中（蓝） */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#3B6FE0" strokeWidth="14"
          strokeDasharray={`${doingLen} ${C - doingLen}`} strokeDashoffset={-doneLen} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-bold" style={{ color: "#111827" }}>{percent}%</span>
        <span className="text-[12px]" style={{ color: "#6B7280" }}>总体进度</span>
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
