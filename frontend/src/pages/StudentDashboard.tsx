import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Upload, Sparkles, Target, Route, FileText, Award, Briefcase, GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/ui";

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

/* 快捷操作：按学生业务流排序 */
const QUICK_ACTIONS = [
  { icon: Upload, title: "上传/更新简历", desc: "AI 自动结构化解析 PDF / Word", to: "/my-resume", accent: P.primary, bg: P.skySoft },
  { icon: Sparkles, title: "生成能力画像", desc: "对最新简历做 AI 技能识别", to: "/my-skills", accent: P.green, bg: P.greenBg },
  { icon: Target, title: "人岗匹配诊断", desc: "对比岗位基准，定位技能差距", to: "/skill-compare", accent: P.amber, bg: P.amberBg },
  { icon: Route, title: "学习路径规划", desc: "按差距生成补强课程与阶段计划", to: "/learning-path", accent: "#7C3AED", bg: "#EDE9FE" },
];

/* 最近动态（类型 chip + 文案 + 时间） */
const RECENT = [
  { date: "07-12", type: "诊断", typeColor: P.amber, typeBg: P.amberBg, text: "完成「后端开发工程师」人岗匹配诊断 · 匹配度 72%", icon: Target },
  { date: "07-10", type: "简历", typeColor: P.primary, typeBg: P.skySoft, text: "更新简历，AI 结构化解析完成", icon: FileText },
  { date: "07-05", type: "学习", typeColor: P.green, typeBg: P.greenBg, text: "完成「Spring Boot 实战」课程 · 进度 80%", icon: GraduationCap },
  { date: "06-28", type: "画像", typeColor: "#7C3AED", typeBg: "#EDE9FE", text: "AI 技能分析完成 · 识别 16 项技能", icon: Sparkles },
];

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dashboard")]}
        title={`欢迎回来，${user?.name ?? "同学"}`}
        description="从简历到能力画像，从岗位诊断到学习路径 —— 你的求职准备都在这里"
      />

      {/* KPI 统计卡区 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 主卡：匹配度，深蓝渐变 */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden flex flex-col" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 132 }}>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>目标岗位匹配度</span>
            <Target size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
          </div>
          <div className="text-[34px] font-mono font-semibold mt-1 leading-tight">72<span className="text-[16px] font-normal" style={{ color: "rgba(255,255,255,0.7)" }}>%</span></div>
          <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)" }}>
            ↑ 3% 较上次诊断
          </span>
        </div>
        {[
          { label: "已掌握技能", value: "18", unit: "项", chip: "+2 本月新增", icon: Award, iconBg: P.greenBg, iconColor: P.green },
          { label: "技能缺口", value: "5", unit: "项", chip: "2 项 P0 优先补齐", icon: Briefcase, iconBg: P.amberBg, iconColor: P.amber },
          { label: "学习进度", value: "60", unit: "%", chip: "第 2 阶段进行中", icon: Route, iconBg: P.skySoft, iconColor: P.primary },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 flex flex-col" style={{ border: `1px solid ${P.border}`, minHeight: 132 }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                <k.icon size={14} style={{ color: k.iconColor }} />
              </span>
            </div>
            <div className="text-[26px] font-mono font-semibold mt-1 leading-tight" style={{ color: P.ink }}>
              {k.value}<span className="text-[13px] font-normal ml-1" style={{ color: P.faint }}>{k.unit}</span>
            </div>
            <span className="mt-auto inline-flex w-fit text-[11px] px-2 py-0.5 rounded-full" style={{ background: P.skySoft, color: P.primary }}>
              {k.chip}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 左列：快捷操作 + 最近动态 */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* 快捷操作：按业务流程排布 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>快捷操作</div>
              <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>按业务流程排列：简历 → 画像 → 诊断 → 补强</div>
            </div>
            <div className="px-5 py-4 grid grid-cols-4 gap-3">
              {QUICK_ACTIONS.map(a => (
                <button key={a.title}
                  className="rounded-xl p-3.5 text-left transition-all hover:opacity-85 hover:shadow-sm"
                  style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}
                  onClick={() => navigate(a.to)}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: a.bg }}>
                    <a.icon size={16} style={{ color: a.accent }} />
                  </span>
                  <div className="text-[13px] font-semibold whitespace-nowrap" style={{ color: P.ink }}>{a.title}</div>
                  <div className="text-[11.5px] mt-0.5 leading-snug" style={{ color: P.faint }}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 最近动态 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>最近动态</div>
            </div>
            <div className="px-5 py-2">
              {RECENT.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${P.border}` }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: P.bgSoft }}>
                    <item.icon size={14} style={{ color: P.muted }} />
                  </span>
                  <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: P.ink }}>{item.text}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap"
                    style={{ color: item.typeColor, background: item.typeBg }}>
                    {item.type}
                  </span>
                  <span className="font-mono text-[12px] flex-shrink-0" style={{ color: P.faint }}>{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右列：目标岗位 */}
        <div className="bg-white rounded-2xl flex flex-col" style={{ border: `1px solid ${P.border}` }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${P.border}` }}>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>目标岗位</div>
              <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>最近一次诊断基准</div>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4 flex-1">
            <div>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>后端开发工程师</div>
              <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>软件开发 · 中级 · 字节跳动</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: P.bgSoft, border: `1px solid ${P.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12.5px]" style={{ color: P.muted }}>匹配度</span>
                <span className="font-mono text-[16px] font-semibold" style={{ color: P.primary }}>72%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: P.skySoft }}>
                <div className="h-full rounded-full" style={{ width: "72%", background: `linear-gradient(90deg, ${P.sky}, ${P.primary})` }} />
              </div>
            </div>
            {[
              { label: "必备技能", value: "8 项", color: P.ink, pct: 100 },
              { label: "已掌握", value: "5 项", color: P.green, pct: 62 },
              { label: "待提升", value: "3 项", color: P.amber, pct: 38 },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                  <span style={{ color: P.muted }}>{s.label}</span>
                  <span className="font-mono font-medium" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: P.skySoft }}>
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
            <button
              className="mt-auto inline-flex items-center justify-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
              style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
              onClick={() => navigate("/skill-compare")}
            >
              重新诊断 <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
