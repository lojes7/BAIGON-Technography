import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Download, ChevronDown } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card, MetricCard } from "../components/ui";

interface Course {
  name: string; hours: string; status: "done" | "doing" | "locked";
}

interface Phase {
  title: string; courses: Course[];
}

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

const statusIcons: Record<string, { icon: string; color: string }> = {
  done: { icon: "✓", color: T.emerging },
  doing: { icon: "▸", color: T.teal },
  locked: { icon: "🔒", color: T.info },
};

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

  const getProgress = (phase: Phase) => {
    const total = phase.courses.length;
    const done = phase.courses.filter((c) => c.status === "done").length;
    const doing = phase.courses.filter((c) => c.status === "doing").length;
    return Math.round(((done + doing * 0.5) / total) * 100);
  };

  const totalCourses = phases.flatMap((p) => p.courses).length;
  const doneCourses = phases.flatMap((p) => p.courses).filter((c) => c.status === "done").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.learningPath")]}
        title={t("page.learningPath.title")}
        description={t("page.learningPath.desc")}
      />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard title={t("page.learningPath.totalDuration")} value="12 周" />
        <MetricCard title={t("page.learningPath.courseCount")} value={`${doneCourses}/${totalCourses} 门`} />
        <MetricCard title={t("page.learningPath.estimatedCompletion")} value="2026-10" />
      </div>

      <Card title={t("page.learningPath.learningPath2")}>
        <div className="px-6 py-5">
          <div className="relative">
            <div className="absolute left-[23px] top-6 bottom-6 w-0.5" style={{ background: T.cloud }} />

            {phases.map((phase, pi) => {
              const progress = getProgress(phase);
              return (
                <div key={pi} className="relative mb-8 last:mb-0">
                  <div className="absolute left-[17px] top-4 w-3.5 h-3.5 rounded-full z-10"
                    style={{ background: progress > 0 ? T.teal : T.cloud,
                      border: `2px solid ${progress > 0 ? T.teal : T.border}` }} />

                  <div className="ml-12">
                    <div className="text-[14px] font-medium mb-2" style={{ color: T.ink }}>
                      {phase.title}
                    </div>

                    <div className="h-2 rounded-full overflow-hidden mb-3 max-w-md" style={{ background: T.cloud }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: T.teal }} />
                    </div>
                    <span className="text-[12px]" style={{ color: T.info }}>进度 {progress}%</span>

                    <div className="mt-3 space-y-2">
                      {phase.courses.map((c, ci) => {
                        const si = statusIcons[c.status];
                        const clickable = c.status !== "done";
                        return (
                          <div key={ci}
                            className="flex items-center gap-3 py-1.5 px-3 rounded transition-colors"
                            style={{
                              background: T.cloud,
                              cursor: clickable ? "pointer" : "default",
                              opacity: c.status === "done" ? 0.7 : 1,
                            }}
                            onClick={() => clickable && handleToggleCourse(pi, ci)}
                          >
                            <span className="text-[12px] font-medium" style={{ color: si.color }}>{si.icon}</span>
                            <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{c.name}</span>
                            <span className="font-mono text-[12px]" style={{ color: T.info }}>⏱ {c.hours}</span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded"
                              style={{ color: si.color, background: `${si.color}18` }}>
                              {t(`page.learningPath.${c.status}`)}
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

      <div className="flex justify-end gap-3">
        <Btn variant="secondary" icon={Download} onClick={() => toast.success("学习计划已导出")}>导出学习计划</Btn>
        <Btn variant="secondary" icon={ChevronDown} onClick={() => toast("切换目标岗位功能：可选择不同岗位的学习路径")}>切换目标岗位</Btn>
      </div>
    </div>
  );
}
