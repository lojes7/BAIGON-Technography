import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import T from "../constants/tokens";
import P from "../constants/palette";
import logo from "../assets/vector_color.svg";
import pulse from "../assets/baigon_pulse.svg";
import abilityGraph from "../assets/ability-graph-2026-09-01.svg";
import {
  LogIn,
  ArrowRight,
  Network,
  Sparkles,
  TrendingUp,
  Target,
  Database,
  BrainCircuit,
  ShieldCheck,
  BarChart3,
  BookOpen,
  GraduationCap,
  Briefcase,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Play,
  Zap,
  Layers,
  FileCheck2,
  Users,
  Share2,
  History,
  Link2,
  Compass,
} from "lucide-react";
import { MOCK_GRAPH_NODES, MOCK_GRAPH_EDGES } from "../data/dynamic-graph-mock";
import {
  ENTITY_COLOR,
  ENTITY_ICON_CODE,
  nodeSizeOf,
  KEY_SKILL_IDS,
  STAR_SPOKE_COLORS,
  SUB_ARROW_COLOR,
} from "../constants/graph-theme";
import type { EntityType, DynamicGraphNode } from "../types/dynamic-graph";

/* =========================================================
 * 配色 —— 百工谱统一色板 + TikZ 淡彩色风格（低饱和、纯色、无渐变）
 * Primary:   T.teal     #338fb1  （品牌主色，按钮/高亮）
 * Ink:       T.ink      #092f58  （标题深墨）
 * Muted:     #5E6E82             （正文次级）
 * Card-bg:   #EEF4F3             （淡青绿底，tikz pastel）
 * Tag-bg:    #E4F0F5
 * Soft-bg:   #F7FAFA             （整页浅底，不渐变色）
 * ========================================================= */

const LP = {
  primary: "#0f57a3",
  ink: T.ink,
  muted: P.muted,
  faint: P.faint,
  border: P.border,
  white: T.white,
  bg: "#F7FAFA",
  cardSoft: "#EEF4F3",
  tagBg: "#E4F0F5",
  amberSoft: "#FBF3E3",
  greenSoft: "#E4F4ED",
  blueSoft: "#E5EEF8",
  violetSoft: "#EFEBF8",
  orangeSoft: "#FBECDD",
};

/* ────────────────── FAQ 数据 ────────────────── */
const FAQS: { q: string; a: string }[] = [
  {
    q: "百工谱适合哪些类型的院校或机构使用？",
    a: "百工谱面向应用型本科、高职高专、职业培训中心及人力资源部门设计，重点支撑专业人才培养方案修订、课程体系优化、就业质量分析、学生能力画像与成长路径规划等场景。",
  },
  {
    q: "数据来源有哪些？能否接入我们的自有数据？",
    a: "系统内置智联招聘、BOSS直聘、前程无忧等主流招聘平台的自动采集能力，并支持 CSV / Excel 批量导入。您的历史岗位库、技能词典、专业培养方案、学生成绩与简历数据均可通过 API 或导入向导一键接入，全部数据在您本地私有化部署，不外泄。",
  },
  {
    q: "AI 技能抽取的准确率如何？",
    a: "技能抽取采用「大模型候选 + 标准词典消歧 + 人工复核」三级流水线：大模型初召回覆盖度 > 96%，消歧后准确率约 92%，经审核工作台一键采纳后可稳定在 99% 以上。审核记录与操作轨迹全部可追溯。",
  },
  {
    q: "能力图谱是怎么构建的？支持自定义领域吗？",
    a: "能力图谱基于标准技能分类法（软件工程、人工智能、大数据等领域）构建，并结合真实岗位 JD 做共现关联挖掘。您可在「技能分类法」中自定义领域、插入新节点或修改父子关系，图谱将实时按领域 BFS 重新分图渲染。",
  },
  {
    q: "部署需要哪些硬件资源？",
    a: "推荐配置：8C16G 服务器 1 台（Docker Compose 单机），存储 200G+ SSD，大模型推理可按需求选配 GPU。提供完整的 Docker 镜像与一键部署脚本，通常 1 小时内即可完成上线。",
  },
];

/* ────────────────── 特色卡片数据 ────────────────── */
type Feature = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string; // tikz 淡彩色
  accentBg: string;
  tag: string;
};

const FEATURE_MAIN: Feature = {
  title: "动态能力图谱浏览器",
  desc: "以岗位为恒星、关键技能为行星、子技能为卫星，TikZ 淡彩色板分层呈现能力结构。点击节点展开关联，按领域自动分图，支持缩放浏览、路径查询、快照留存与导出。",
  icon: <Network size={28} />,
  accent: LP.primary,
  accentBg: LP.tagBg,
  tag: "核心模块",
};

const FEATURES_SMALL: Feature[] = [
  {
    title: "AI 技能抽取与审核",
    desc: "大模型语义抽取 + 标准词典自动消歧，审核工作台逐条复核、一键采纳。支持版本对比、批量操作与完整审计留痕。",
    icon: <Sparkles size={24} />,
    accent: "#C5862B",
    accentBg: LP.amberSoft,
    tag: "质量保障",
  },
  {
    title: "技能演化趋势分析",
    desc: "多批次 JD 时间序列建模，识别新兴技能、稳定技能与衰退技能，直观呈现行业能力结构迁移方向，助力专业建设预警决策。",
    icon: <TrendingUp size={24} />,
    accent: P.green,
    accentBg: LP.greenSoft,
    tag: "前瞻洞察",
  },
  {
    title: "人岗匹配与差距诊断",
    desc: "基于学生简历 + 成绩单 + 技能画像的多因子匹配算法，自动输出岗位适配度、缺失技能清单与个性化学习路径建议。",
    icon: <Target size={24} />,
    accent: P.violet,
    accentBg: LP.violetSoft,
    tag: "学生发展",
  },
  {
    title: "多源数据采集与清洗",
    desc: "内置自动采集 + 导入向导双通路，CSV/Excel/API 三位一体接入，去重、归一、字段清洗自动化，原始记录与归一结果双向可追溯。",
    icon: <Database size={24} />,
    accent: "#B26A3C",
    accentBg: LP.orangeSoft,
    tag: "数据底座",
  },
];

/* ────────────────── 为什么选择我们 ────────────────── */
const WHYS: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: <BrainCircuit size={22} />,
    title: "AI 驱动语义理解",
    desc: "基于向量嵌入与岗位知识图谱的语义级技能识别，远优于简单关键词匹配。",
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "私有化部署",
    desc: "全栈本地化运行，数据不出校。支持 LDAP / CAS 统一身份认证，合规审计一键导出。",
  },
  {
    icon: <BarChart3 size={22} />,
    title: "同源数字口径",
    desc: "KPI 卡片、趋势图、列表页脚严格共用同一数据池，杜绝「多头对不上」。",
  },
  {
    icon: <Layers size={22} />,
    title: "分层角色工作台",
    desc: "管理员 / 教师 / 学生 / 分析师 / 审核员 五套专属工作台，按需授权、即插即用。",
  },
];

/* ────────────────── 角色场景 ────────────────── */
const ROLES: {
  icon: React.ReactNode;
  name: string;
  tag: string;
  desc: string;
  points: string[];
  accent: string;
}[] = [
  {
    icon: <Briefcase size={22} />,
    name: "专业负责人",
    tag: "人才培养",
    desc: "依据行业真实需求修订培养方案，课程对标有据可依。",
    points: ["岗位-能力矩阵一键生成", "课程技能覆盖率雷达", "新增/撤销专业论证报告"],
    accent: LP.primary,
  },
  {
    icon: <GraduationCap size={22} />,
    name: "任课教师",
    tag: "教学改进",
    desc: "即时掌握学生能力分布，因材施教、精准辅导。",
    points: ["班级技能画像分析", "前置技能缺失预警", "项目制教学岗位对标"],
    accent: P.violet,
  },
  {
    icon: <BookOpen size={22} />,
    name: "学生 / 毕业生",
    tag: "就业指导",
    desc: "看清心仪岗位的真实要求，找准差距、精准提升。",
    points: ["简历诊断与建议", "差距技能学习路径", "岗位匹配度排行"],
    accent: P.green,
  },
  {
    icon: <Search size={22} />,
    name: "数据分析员",
    tag: "决策支持",
    desc: "全维度数据交叉分析，输出高质量决策依据。",
    points: ["自定义多因素筛选", "图谱快照对比分析", "专业/行业全景导出"],
    accent: P.amber,
  },
];



/* ============================================================ */
export default function LandingPage() {
  const nav = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goLogin = () => nav("/login");
  const goRegister = () => {
    nav("/login");
    // 让 LoginPage 切到注册模式：先跳 login，再在下次加载时通过 sessionStorage 通信
    setTimeout(() => sessionStorage.setItem("baigon_landing_auth_mode", "register"), 0);
  };

  return (
    <div
      style={{
        background: LP.bg,
        color: LP.ink,
        fontFamily:
          '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, sans-serif',
        minHeight: "100vh",
      }}
    >
      {/* ========== 顶部导航栏 ========== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
          backdropFilter: scrolled ? "saturate(180%) blur(10px)" : "none",
          borderBottom: scrolled ? `1px solid ${LP.border}` : "1px solid transparent",
          transition: "all 0.2s ease",
        }}
      >
        <nav
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "18px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          {/* 左侧 Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={logo} alt="百工谱" style={{ width: 36, height: 36, display: "block" }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: LP.ink, letterSpacing: 0.5 }}>百工谱</span>
              <span style={{ fontSize: 11, color: LP.faint, letterSpacing: 1 }}>BAIGON</span>
            </div>
          </Link>

          {/* 中间 导航链接 */}
          <ul style={{ display: "flex", gap: 36, listStyle: "none", margin: 0, padding: 0 }} className="hidden md:flex">
            {[
              ["产品功能", "#features"],
              ["应用场景", "#scenarios"],
              ["技术优势", "#why"],
              ["常见问题", "#faq"],
            ].map(([k, h]) => (
              <li key={k}>
                <a
                  href={h}
                  style={{
                    fontSize: 14,
                    color: LP.muted,
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color .15s",
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.color = LP.primary)}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.color = LP.muted)}
                >
                  {k}
                </a>
              </li>
            ))}
          </ul>

          {/* 右侧 登录 / 注册 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={goLogin}
              style={{
                padding: "6px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: LP.ink,
                background: LP.white,
                border: `1px solid ${LP.border}`,
                borderRadius: 8,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = LP.primary;
                el.style.color = LP.primary;
              }}
              onMouseOut={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = LP.border;
                el.style.color = LP.ink;
              }}
            >
              <LogIn size={16} />
              登录
            </button>
            <button
              onClick={goRegister}
              style={{
                padding: "6px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: LP.white,
                background: LP.primary,
                border: "1px solid transparent",
                borderRadius: 8,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "filter .15s",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(9,47,88,0.25)",
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.filter = "brightness(1.06)")}
              onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.filter = "none")}
            >
              免费注册
              <ArrowRight size={16} />
            </button>
          </div>
        </nav>
      </header>

      {/* ========== HERO 主视觉区 ========== */}
      <section
        style={{
          position: "relative",
          padding: "72px 32px 56px",
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        {/* 背景淡色方格（与 Clause 截图一致） */}
        <GridBackdrop />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* 顶部 pill tag */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: LP.tagBg,
              color: LP.primary,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
              margin: "0 auto 28px",
            }}
            className="flex"
          >
            <Zap size={14} />
            岗位能力智能分析平台 · AI 驱动
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 48, alignItems: "center" }}>
            {/* 左侧文案 */}
            <div style={{ textAlign: "center" }} className="md:text-left">
              <h1
                style={{
                  fontSize: "clamp(36px, 5vw, 56px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  color: LP.ink,
                  margin: "0 0 24px",
                  letterSpacing: -0.5,
                }}
              >
                一张图谱，
                <span
                  style={{
                    padding: "2px 6px",
                    background: "#D9E88C", // tikz 淡黄高亮，类似 Clause 截图下划线效果
                    borderRadius: 4,
                    margin: "0 2px",
                  }}
                >
                  看清
                </span>
                岗位与技能的全部关联
                <br />
               
              </h1>
              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.8,
                  color: LP.muted,
                  maxWidth: 560,
                  margin: "0 auto 40px",
                }}
                className="md:mx-0"
              >
                百工谱聚合多源招聘数据，借助大模型语义抽取与知识图谱技术，自动构建岗位能力全景图谱。
                支撑院校专业建设、课程对标、人岗匹配与学生成长路径规划，让「懂行业、懂学生」变得可量化、可追溯。
              </p>

              {/* CTA 按钮组 */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }} className="md:justify-start">
                <button
                  onClick={goRegister}
                  style={{
                    padding: "10px 20px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: LP.white,
                    background: LP.primary,
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 18px rgba(9,47,88,0.28)",
                    transition: "transform .15s",
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.transform = "none")}
                >
                  立即开始 <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  style={{
                    padding: "10px 20px",
                    fontSize: 15,
                    fontWeight: 600,
                    color: LP.ink,
                    background: LP.white,
                    border: `1px solid ${LP.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all .15s",
                  }}
                  onMouseOver={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = LP.primary;
                    el.style.color = LP.primary;
                  }}
                  onMouseOut={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = LP.border;
                    el.style.color = LP.ink;
                  }}
                >
                  <Play size={16} /> 观看演示
                </button>
              </div>

              {/* 次要点 */}
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  marginTop: 32,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
                className="md:justify-start"
              >
                {["免费试用 30 天", "私有化部署", "数据全加密"].map((t) => (
                  <div key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: LP.muted }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: LP.greenSoft,
                        color: P.green,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：加载动画示意 + 迷你图谱卡片 */}
            <div style={{ position: "relative" }}>
              <HeroShowcase />
            </div>
          </div>

          {/* 合作伙伴 logo 条 */}
          <div style={{ marginTop: 80 }}>
            <p style={{ textAlign: "center", fontSize: 13, color: LP.faint, marginBottom: 20, letterSpacing: 0.5 }}>
              
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 56,
                flexWrap: "wrap",
                opacity: 0.82,
              }}
            >
              
            </div>
          </div>
        </div>
      </section>

      {/* ========== 核心理念（三支柱） ========== */}
      <section style={{ padding: "40px 32px 24px", maxWidth: 1240, margin: "0 auto" }}>
        <div
          style={{
            background: LP.white,
            border: `1px solid ${LP.border}`,
            borderRadius: 18,
            padding: "48px 40px",
            boxShadow: "0 4px 20px rgba(9,47,88,0.04)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                background: LP.amberSoft,
                color: P.amber,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              <Compass size={14} /> 核心理念
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: LP.ink, margin: 0, letterSpacing: 0.2 }}>
              经纬 · 时间 · 证据
            </h2>
            <p style={{ fontSize: 14, color: LP.muted, marginTop: 10 }}>
              以空间组织职业、以时间记录变化、以证据连接需求与培养 — 三位一体，构建可信的岗位能力分析底座。
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
              position: "relative",
            }}
          >
            {/* 支柱 1：经纬 */}
            <div
              style={{
                padding: "32px 28px",
                borderRadius: 14,
                background: LP.blueSoft,
                position: "relative",
                borderLeft: `3px solid #5F7FAE`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: LP.white,
                  color: "#5F7FAE",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(95,127,174,0.15)",
                }}
              >
                <Share2 size={22} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5F7FAE", letterSpacing: 2, marginBottom: 6 }}>
                01 · 经纬
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: LP.ink, margin: "0 0 10px" }}>
                经纬组织百业
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.85, color: LP.muted, margin: 0 }}>
                以知识图谱为骨架，纵向贯通职业大类 → 岗位角色 → 技能点 → 工具/证书，横向连接人工智能、大数据、云原生等能力领域。
                从任一节点出发，经纬交织即是一张完整的行业能力地图。
              </p>
            </div>

            {/* 支柱 2：时间 */}
            <div
              style={{
                padding: "32px 28px",
                borderRadius: 14,
                background: LP.greenSoft,
                position: "relative",
                borderLeft: `3px solid ${P.green}`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: LP.white,
                  color: P.green,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(21,154,108,0.15)",
                }}
              >
                <History size={22} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.green, letterSpacing: 2, marginBottom: 6 }}>
                02 · 时间
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: LP.ink, margin: "0 0 10px" }}>
                时间记录技艺演化
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.85, color: LP.muted, margin: 0 }}>
                按批次记录每一次招聘数据注入的时间戳，识别技能的「新兴 → 上升 → 稳定 → 衰退」生命周期。
                趋势图、版本快照、演化事件链，让专业建设的每一次调整都拥有时间维度上的证据与节奏。
              </p>
            </div>

            {/* 支柱 3：证据 */}
            <div
              style={{
                padding: "32px 28px",
                borderRadius: 14,
                background: LP.violetSoft,
                position: "relative",
                borderLeft: `3px solid ${P.violet}`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: LP.white,
                  color: P.violet,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(116,104,206,0.15)",
                }}
              >
                <Link2 size={22} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.violet, letterSpacing: 2, marginBottom: 6 }}>
                03 · 证据
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: LP.ink, margin: "0 0 10px" }}>
                证据连接产业需求与人才培养
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.85, color: LP.muted, margin: 0 }}>
                每一条「岗位需要某技能」的结论，均可回溯至招聘 JD 原文、样本来源、审核记录与置信度。
                证据链贯穿课程对标、差距分析、学习路径推荐，真正做到「结论可审计、建议可溯源」。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURES 功能模块 ========== */}
      <section id="features" style={{ padding: "96px 32px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              background: LP.tagBg,
              color: LP.primary,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            <Layers size={14} /> 核心功能
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: LP.ink, margin: 0, letterSpacing: -0.3 }}>
            面向岗位能力的全套分析能力
          </h2>
          <p style={{ fontSize: 15, color: LP.muted, marginTop: 16, maxWidth: 620, marginInline: "auto", lineHeight: 1.8 }}>
            从原始 JD 采集、AI 抽取、审核到图谱构建、趋势分析与人岗匹配，百工谱为您提供一站式、全链路的岗位能力数据基础设施。
          </p>
        </div>

        {/* 主功能大卡 */}
        <div
          style={{
            background: LP.cardSoft,
            borderRadius: 16,
            padding: 56,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                color: FEATURE_MAIN.accent,
                background: FEATURE_MAIN.accentBg,
                borderRadius: 6,
                marginBottom: 16,
                letterSpacing: 0.5,
              }}
            >
              {FEATURE_MAIN.tag}
            </span>
            <h3 style={{ fontSize: 32, fontWeight: 700, color: LP.ink, margin: 0 }}>{FEATURE_MAIN.title}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: LP.muted, marginTop: 16, marginBottom: 32 }}>
              {FEATURE_MAIN.desc}
            </p>
            <button
              onClick={goLogin}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: LP.white,
                background: FEATURE_MAIN.accent,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 3px 12px rgba(51,143,177,0.25)",
              }}
            >
              探索全部 <ArrowRight size={16} />
            </button>
          </div>
          {/* 右侧产品截图式 mockup —— 直接使用系统导出的能力图谱 SVG 实景 */}
          <div
            style={{
              background: LP.white,
              borderRadius: 12,
              border: `1px solid ${LP.border}`,
              padding: 16,
              boxShadow: "0 8px 24px rgba(9,47,88,0.06)",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "5 / 4",
                background: `linear-gradient(to right, ${LP.border} 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(to bottom, ${LP.border} 1px, transparent 1px) 0 0 / 28px 28px`,
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
              }}
            >
              <img
                src={abilityGraph}
                alt="能力图谱预览"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {([
                  ["技能", ENTITY_COLOR.Skill.fill],
                  ["岗位", ENTITY_COLOR.JobRole.fill],
                  ["工具", ENTITY_COLOR.Tool.fill],
                  ["证书", ENTITY_COLOR.Certificate.fill],
                ] as const).map(([k, c]) => (
                  <span
                    key={k}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: LP.muted,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: c,
                        border: "1px solid rgba(0,0,0,0.06)",
                      }}
                    />
                    {k}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11, color: LP.primary, fontWeight: 600 }}>
                <FileCheck2 size={12} style={{ display: "inline", verticalAlign: -2 }} /> 能力图谱 · 软件工程领域
              </span>
            </div>
          </div>
        </div>

        {/* 4 个小功能卡 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {FEATURES_SMALL.map((f) => (
            <div
              key={f.title}
              style={{
                background: LP.white,
                border: `1px solid ${LP.border}`,
                borderRadius: 16,
                padding: 36,
                transition: "all .2s",
              }}
              onMouseOver={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = "0 10px 30px rgba(9,47,88,0.08)";
              }}
              onMouseOut={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: f.accentBg,
                  color: f.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                {f.icon}
              </div>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 9px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: f.accent,
                  background: f.accentBg,
                  borderRadius: 6,
                  marginBottom: 12,
                  letterSpacing: 0.3,
                }}
              >
                {f.tag}
              </span>
              <h4 style={{ fontSize: 22, fontWeight: 700, color: LP.ink, margin: 0 }}>{f.title}</h4>
              <p style={{ fontSize: 14, lineHeight: 1.85, color: LP.muted, marginTop: 12 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== WHY US 技术优势 ========== */}
      <section id="why" style={{ padding: "72px 32px", background: LP.white, borderTop: `1px solid ${LP.border}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: LP.ink, margin: 0 }}>为什么选择百工谱</h2>
            <p style={{ fontSize: 15, color: LP.muted, marginTop: 12 }}>
              区别于通用 BI 工具，我们专为「岗位能力 × 教育场景」深度优化。
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {WHYS.map((w, i) => {
              const accentColors = [LP.primary, P.amber, P.green, P.violet];
              const accentBgs = [LP.tagBg, LP.amberSoft, LP.greenSoft, LP.violetSoft];
              return (
                <div
                  key={w.title}
                  style={{
                    padding: 28,
                    borderRadius: 14,
                    background: LP.bg,
                    textAlign: "center",
                    border: `1px solid ${LP.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: accentBgs[i],
                      color: accentColors[i],
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    {w.icon}
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: LP.ink, margin: "0 0 8px" }}>{w.title}</h4>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: LP.muted, margin: 0 }}>{w.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== 应用场景 （4 角色） ========== */}
      <section id="scenarios" style={{ padding: "96px 32px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              background: LP.violetSoft,
              color: P.violet,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            <Users size={14} /> 应用场景
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: LP.ink, margin: 0 }}>
            一套系统，满足多方角色诉求
          </h2>
          <p style={{ fontSize: 15, color: LP.muted, marginTop: 12 }}>
            五套独立工作台 + 统一底层数据，谁用都顺手。
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {ROLES.map((r) => (
            <div
              key={r.name}
              style={{
                background: LP.white,
                border: `1px solid ${LP.border}`,
                borderRadius: 14,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                transition: "all .2s",
              }}
              onMouseOver={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = "0 10px 30px rgba(9,47,88,0.08)";
              }}
              onMouseOut={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${r.accent}14`,
                  color: r.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                {r.icon}
              </div>
              <span
                style={{
                  display: "inline-block",
                  alignSelf: "flex-start",
                  fontSize: 11,
                  fontWeight: 700,
                  color: r.accent,
                  background: `${r.accent}14`,
                  padding: "3px 8px",
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                {r.tag}
              </span>
              <h4 style={{ fontSize: 18, fontWeight: 700, color: LP.ink, margin: "0 0 8px" }}>{r.name}</h4>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: LP.muted, margin: "0 0 16px" }}>{r.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {r.points.map((pt) => (
                  <li key={pt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: LP.ink }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: LP.greenSoft,
                        color: P.green,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ========== 数据统计展示 ========== */}
      <section style={{ padding: "64px 32px", background: LP.cardSoft, borderTop: `1px solid ${LP.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, textAlign: "center" }}>
          {[
            ["120万+", "结构化岗位样本", LP.primary],
            ["1,600+", "标准技能词条", P.amber],
            ["2400+", "能力领域图谱", P.green],
            ["99.2%", "审核后准确率", P.violet],
          ].map(([n, l, c]) => (
            <div key={l as string}>
              <div style={{ fontSize: 44, fontWeight: 800, color: c as string, letterSpacing: -0.5 }}>{n}</div>
              <div style={{ fontSize: 14, color: LP.muted, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== FAQ 常见问题 ========== */}
      <section id="faq" style={{ padding: "96px 32px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: LP.ink, margin: 0 }}>常见问题</h2>
          <p style={{ fontSize: 15, color: LP.muted, marginTop: 12 }}>还有疑问？欢迎联系我们的技术顾问做一对一演示。</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              style={{
                background: LP.white,
                border: `1px solid ${openFaq === i ? LP.primary + "55" : LP.border}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "border-color .15s",
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "18px 24px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 15,
                  fontWeight: 600,
                  color: LP.ink,
                }}
              >
                <span>{f.q}</span>
                <span
                  style={{
                    color: openFaq === i ? LP.primary : LP.faint,
                    display: "inline-flex",
                    transition: "color .15s",
                  }}
                >
                  {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 24px 22px", fontSize: 14, color: LP.muted, lineHeight: 1.9 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========== 最终 CTA ========== */}
      <section style={{ padding: "48px 32px 96px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: LP.primary,
            color: LP.white,
            borderRadius: 20,
            padding: "64px 56px",
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 40,
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* 装饰点阵 */}
          <DecorDots />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 12px", lineHeight: 1.25 }}>
              准备好构建你的
              <br />
              岗位能力图谱了吗？
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.8, margin: "0 0 32px", maxWidth: 500 }}>
              注册即享 30 天全功能试用。支持私有化部署评估、免费技术选型咨询与演示数据导入。
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                onClick={goRegister}
                style={{
                  padding: "10px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: LP.primary,
                  background: LP.white,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "transform .15s",
                }}
                onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
                onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.transform = "none")}
              >
                免费注册 <ArrowRight size={18} />
              </button>
              <button
                onClick={goLogin}
                style={{
                  padding: "10px 20px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: LP.white,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                已有账号，直接登录
              </button>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center" }}>
            <CTAPulseCard />
          </div>
        </div>
      </section>

      {/* ========== 页脚 ========== */}
      <footer
        style={{
          background: LP.white,
          borderTop: `1px solid ${LP.border}`,
          padding: "56px 32px 32px",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
              gap: 48,
              paddingBottom: 40,
              borderBottom: `1px solid ${LP.border}`,
            }}
          >
            {/* 品牌 */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <img src={logo} alt="百工谱" style={{ width: 32, height: 32 }} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: LP.ink }}>百工谱</span>
                  <span style={{ fontSize: 10, color: LP.faint, letterSpacing: 1 }}>BAIGON</span>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.85, color: LP.muted, maxWidth: 320, margin: 0 }}>
                百工谱是面向高等院校与职业教育的岗位能力智能分析平台，通过数据 + AI + 图谱技术，
                让专业建设、课程改革与就业指导更具科学性与前瞻性。
              </p>
            </div>
            {/* 产品 */}
            <FooterCol title="产品模块" items={["能力图谱", "AI 抽取审核", "演化趋势", "差距分析"]} />
            {/* 方案 */}
            <FooterCol title="解决方案" items={["专业建设", "教学改进", "学生就业", "产教融合"]} />
            {/* 支持 */}
            <FooterCol title="支持" items={["使用文档", "API 接口", "部署指南", "联系我们"]} />
          </div>
          <div
            style={{
              paddingTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 12,
              color: LP.faint,
            }}
          >
            <div>© {new Date().getFullYear()} 百工谱 BAIGON. All rights reserved.</div>
            <div style={{ display: "flex", gap: 20 }}>
              <span style={{ cursor: "pointer" }}>隐私政策</span>
              <span style={{ cursor: "pointer" }}>服务条款</span>
              <span style={{ cursor: "pointer" }}>合规声明</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────────── 小组件：页脚栏目 ───────────── */
function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h5 style={{ fontSize: 14, fontWeight: 700, color: LP.ink, margin: "0 0 16px" }}>{title}</h5>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((t) => (
          <li key={t}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                fontSize: 13,
                color: LP.muted,
                textDecoration: "none",
                transition: "color .15s",
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.color = LP.primary)}
              onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.color = LP.muted)}
            >
              {t}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── 小组件：Hero 展示区（脉冲动画 + 卡片） ───────────── */
function HeroShowcase() {
  return (
    <div style={{ position: "relative" }}>
      {/* 外层淡色卡片 */}
      <div
        style={{
          position: "absolute",
          inset: "-18px",
          background: LP.cardSoft,
          borderRadius: 24,
          zIndex: 0,
        }}
      />
      {/* 内部白卡 */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: LP.white,
          borderRadius: 18,
          border: `1px solid ${LP.border}`,
          padding: 28,
          boxShadow: "0 20px 40px rgba(9,47,88,0.08)",
        }}
      >
        {/* 卡头：模拟下拉 + 头像条 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 16,
            marginBottom: 16,
            borderBottom: `1px solid ${LP.border}`,
          }}
        >
         
          <div style={{ display: "flex" }}>
            {[P.primary, P.amber, P.green, P.violet].map((c, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: c,
                  border: "2px solid white",
                  marginLeft: i === 0 ? 0 : -8,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
        </div>

        {/* 脉冲动画居中 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 0 24px",
            background: LP.cardSoft,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <img src={pulse} alt="pulse" style={{ width: 120, height: 120, display: "block" }} />
        </div>

        {/* 模拟柱状图 */}
        <MiniBarChart />
      </div>
    </div>
  );
}

/* ───────────── 小组件：迷你柱状图（不依赖 recharts，纯 CSS） ───────────── */
function MiniBarChart() {
  const bars = [38, 62, 88, 45, 30, 18, 100, 52, 78, 66, 34, 58];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 120, gap: 6 }}>
        {bars.map((h, i) => {
          const isPeak = i === 6;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: isPeak ? LP.primary : "#D4E2E1",
                borderRadius: "4px 4px 2px 2px",
                height: `${h}%`,
                transition: "filter .15s",
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.filter = "brightness(0.95)")}
              onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.filter = "none")}
              title={`${h * 20} 条样本`}
            />
          );
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: "8px 12px",
          borderRadius: 8,
          background: LP.tagBg,
          color: LP.primary,
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>本月新增样本</span>
        <span>↑ 23.6%</span>
      </div>
    </div>
  );
}

/* ───────────── 小组件：主功能卡内图谱（复用系统数据与视觉规则） ───────────── */
function GraphMockCard() {
  /* 布局参数：SVG viewBox 440×340，三层同心圆（卡片缩放版）
     - 中心：软件工程恒星
     - 环1（半径 105）：9 个关键技能（KEY_SKILL_IDS）≤ 10，严格符合"恒星→关键技能 ≤10 条"规范
     - 环2（半径 165）：每个关键技能 2 个子节点，类型轮换（Skill/JobRole/Tool/Certificate）
  */
  const CX = 220;
  const CY = 168;
  const R_STAR = 30;   // 恒星半径（卡片适配，小于 DOMAIN_STAR_RADIUS=46，保证缩微版观感）
  const R1 = 102;      // 环1：关键技能半径
  const R2 = 162;      // 环2：子节点半径
  const N_KEY = 9;

  // 9 个关键技能（KEY_SKILL_IDS 与 graph-theme.ts 完全一致）
  const keySkillData: { id: (typeof KEY_SKILL_IDS)[number]; label: string; sub: Array<{ type: EntityType; label: string; id: string; requiredLevel?: string }> }[] = [
    {
      id: "sk_001", label: "Python",
      sub: [
        { type: "Tool", label: "PyTorch", id: "tl_002", requiredLevel: "熟练" },
        { type: "JobRole", label: "后端开发工程师", id: "job_006", requiredLevel: "精通" },
      ],
    },
    {
      id: "sk_004", label: "大语言模型",
      sub: [
        { type: "Skill", label: "RAG工程化", id: "sk_005", requiredLevel: "精通" },
        { type: "Certificate", label: "阿里云AIGC认证", id: "cert_001" },
      ],
    },
    {
      id: "sk_013", label: "SQL",
      sub: [
        { type: "Skill", label: "数据仓库", id: "sk_012", requiredLevel: "熟练" },
        { type: "Tool", label: "MySQL", id: "tl_001", requiredLevel: "熟悉" },
      ],
    },
    {
      id: "sk_005", label: "RAG工程化",
      sub: [
        { type: "Skill", label: "向量数据库", id: "sk_007", requiredLevel: "熟练" },
        { type: "Tool", label: "Milvus", id: "tl_005" },
      ],
    },
    {
      id: "sk_011", label: "PyTorch",
      sub: [
        { type: "Skill", label: "深度学习", id: "sk_003", requiredLevel: "精通" },
        { type: "JobRole", label: "大模型训练工程师", id: "job_002", requiredLevel: "精通" },
      ],
    },
    {
      id: "sk_003", label: "深度学习",
      sub: [
        { type: "Skill", label: "CUDA编程", id: "sk_016", requiredLevel: "熟练" },
        { type: "Certificate", label: "英伟达DLI认证", id: "cert_002" },
      ],
    },
    {
      id: "sk_023", label: "MySQL",
      sub: [
        { type: "Tool", label: "Redis", id: "tl_002", requiredLevel: "熟练" },
        { type: "JobRole", label: "数据开发工程师", id: "job_005", requiredLevel: "熟练" },
      ],
    },
    {
      id: "sk_014", label: "Java",
      sub: [
        { type: "Tool", label: "Spring Boot", id: "tl_009", requiredLevel: "精通" },
        { type: "Skill", label: "微服务架构", id: "sk_022", requiredLevel: "熟练" },
      ],
    },
    {
      id: "sk_012", label: "数据仓库",
      sub: [
        { type: "Skill", label: "分布式系统", id: "sk_025", requiredLevel: "熟练" },
        { type: "JobRole", label: "系统架构师", id: "job_010", requiredLevel: "精通" },
      ],
    },
  ];

  // 由 MOCK_GRAPH_NODES 查 demandLevel，查不到则 fallback 0.85
  const getDemandLevel = (id: string, type: EntityType) => {
    const hit = MOCK_GRAPH_NODES.find((n) => n.id === id);
    return hit?.demandLevel ?? (type === "JobRole" ? 0.86 : type === "Tool" ? 0.88 : 0.82);
  };

  // 环1/环2 位置计算（角度：-90°起步，顺时针 40° 间隔；奇数环2子节点交错 18°）
  const keyNodes = keySkillData.map((k, i) => {
    const theta = (-90 + i * 40) * (Math.PI / 180);
    const x = CX + R1 * Math.cos(theta);
    const y = CY + R1 * Math.sin(theta);
    const demand = getDemandLevel(k.id, "Skill");
    const r = Math.min(16, nodeSizeOf(demand, "熟练") * 0.78); // 卡片缩微版：乘 0.78
    return {
      ...k,
      type: "Skill" as EntityType,
      theta,
      x,
      y,
      r,
      demand,
    };
  });

  type Sub = {
    idx: number;
    type: EntityType;
    label: string;
    id: string;
    x: number;
    y: number;
    r: number;
    theta: number;
    parentTheta: number;
    parentR: number;
    parentX: number;
    parentY: number;
    requiredLevel?: string;
  };
  const subNodes: Sub[] = keyNodes.flatMap((kn, i) => {
    return kn.sub.map((s, j) => {
      const delta = (j === 0 ? -1 : 1) * 18; // ±18° 错开
      const theta = (-90 + i * 40 + delta) * (Math.PI / 180);
      const x = CX + R2 * Math.cos(theta);
      const y = CY + R2 * Math.sin(theta);
      const demand = getDemandLevel(s.id, s.type);
      const r = Math.min(13.5, nodeSizeOf(demand, s.requiredLevel) * 0.72);
      return {
        idx: i * 2 + j,
        type: s.type,
        label: s.label,
        id: s.id,
        theta,
        x,
        y,
        r,
        parentTheta: kn.theta,
        parentR: kn.r,
        parentX: kn.x,
        parentY: kn.y,
        requiredLevel: s.requiredLevel,
      };
    });
  });

  /* 箭头终点/起点：从节点边缘外取点（箭头不穿过节点本体） */
  const edgePoint = (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      sx: x1 + ux * r1,
      sy: y1 + uy * r1,
      tx: x2 - ux * (r2 + 0.6),
      ty: y2 - uy * (r2 + 0.6),
    };
  };

  // marker id（同一页面可能渲染多次，做静态前缀）
  const MK_SOLID = "lp-solid-arrow";
  const MK_DASH = "lp-dash-arrow";

  const TOTAL_NODES = 1 + keyNodes.length + subNodes.length;

  return (
    <div
      style={{
        background: LP.white,
        borderRadius: 12,
        border: `1px solid ${LP.border}`,
        padding: 16,
        boxShadow: "0 8px 24px rgba(9,47,88,0.06)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "5 / 4",
          background: `linear-gradient(to right, ${LP.border} 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(to bottom, ${LP.border} 1px, transparent 1px) 0 0 / 28px 28px`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 440 340"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            {/* 恒星→关键技能 淡彩实线箭头 marker（通过当前颜色继承，保证每条线配各自色） */}
            <marker
              id={MK_SOLID}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
            {/* 关键技能→子节点 浅色虚线箭头 marker */}
            <marker
              id={MK_DASH}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SUB_ARROW_COLOR} />
            </marker>
          </defs>

          {/* ═══════ 第 1 层：连线（节点之下，避免箭头覆盖节点本体） ═══════ */}
          <g id="edges">
            {/* 1) 恒星 → 关键技能：实线箭头，数量=9 ≤ 10，使用 STAR_SPOKE_COLORS[i] */}
            {keyNodes.map((kn, i) => {
              const { sx, sy, tx, ty } = edgePoint(CX, CY, R_STAR, kn.x, kn.y, kn.r);
              const color = STAR_SPOKE_COLORS[i % STAR_SPOKE_COLORS.length];
              return (
                <line
                  key={`spoke-${i}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={color}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  markerEnd={`url(#${MK_SOLID})`}
                  style={{ color }}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* 2) 关键技能 → 子节点：浅色虚线箭头 */}
            {subNodes.map((s) => {
              const { sx, sy, tx, ty } = edgePoint(s.parentX, s.parentY, s.parentR, s.x, s.y, s.r);
              return (
                <line
                  key={`sub-${s.idx}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={SUB_ARROW_COLOR}
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  markerEnd={`url(#${MK_DASH})`}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>

          {/* ═══════ 第 2 层：节点（连线之上，保证节点不被箭头覆盖） ═══════ */}
          <g id="nodes">
            {/* 中心恒星：软件工程 Domain — 不改变大小，只优化颜色+柔高光，去除阴影双环 */}
            <g transform={`translate(${CX} ${CY})`}>
              <circle
                r={R_STAR}
                fill={ENTITY_COLOR.Domain.fill}
                stroke={ENTITY_COLOR.Domain.stroke}
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={-R_STAR * 0.3}
                cy={-R_STAR * 0.45}
                rx={R_STAR * 0.55}
                ry={R_STAR * 0.28}
                fill="#FFFFFF"
                opacity={0.32}
              />
              <text
                y={1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10.5}
                fontWeight={700}
                fill={ENTITY_COLOR.Domain.text}
              >
                软件工程
              </text>
            </g>

            {/* 关键技能：Skill，ENTITY_COLOR[Skill] + 顶部柔高光 — 禁止双环 */}
            {keyNodes.map((kn, i) => {
              const c = ENTITY_COLOR.Skill;
              return (
                <g key={`kn-${i}`} transform={`translate(${kn.x} ${kn.y})`}>
                  <circle
                    r={kn.r}
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <ellipse
                    cx={-kn.r * 0.32}
                    cy={-kn.r * 0.45}
                    rx={kn.r * 0.55}
                    ry={kn.r * 0.26}
                    fill="#FFFFFF"
                    opacity={0.3}
                  />
                  <text
                    y={0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(7.5, Math.min(9.2, kn.r * 0.58))}
                    fontWeight={500}
                    fill={c.text}
                    style={{ pointerEvents: "none" }}
                  >
                    {kn.label.length > 5 ? kn.label.slice(0, 5) + "…" : kn.label}
                  </text>
                </g>
              );
            })}

            {/* 子节点：按 entity type 上色，顶部柔高光 */}
            {subNodes.map((s) => {
              const c = ENTITY_COLOR[s.type];
              return (
                <g key={`subn-${s.idx}`} transform={`translate(${s.x} ${s.y})`}>
                  <circle
                    r={s.r}
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth={1.1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <ellipse
                    cx={-s.r * 0.32}
                    cy={-s.r * 0.45}
                    rx={s.r * 0.55}
                    ry={s.r * 0.26}
                    fill="#FFFFFF"
                    opacity={0.3}
                  />
                  {s.r >= 8.2 ? (
                    <text
                      y={0.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(6.8, Math.min(8.2, s.r * 0.6))}
                      fill={c.text}
                      style={{ pointerEvents: "none" }}
                    >
                      {(() => {
                        const max = 5;
                        return s.label.length > max ? s.label.slice(0, max) + "…" : s.label;
                      })()}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* 图例：与系统 ENTITY_COLOR 严格同源；节点计数 = 恒星 + 关键技能9 + 子技能18 = 28 */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {([
            ["技能", ENTITY_COLOR.Skill.fill],
            ["岗位", ENTITY_COLOR.JobRole.fill],
            ["工具", ENTITY_COLOR.Tool.fill],
            ["证书", ENTITY_COLOR.Certificate.fill],
          ] as const).map(([k, c]) => (
            <span
              key={k}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: LP.muted,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: c,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
              {k}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: LP.primary, fontWeight: 600 }}>
          <FileCheck2 size={12} style={{ display: "inline", verticalAlign: -2 }} /> 已审核 ·{" "}
          {TOTAL_NODES} 节点
        </span>
      </div>
    </div>
  );
}

/* ───────────── 小组件：背景格纹（Clause 同款） ───────────── */
function GridBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: -40,
        backgroundImage: `linear-gradient(to right, ${LP.border} 1px, transparent 1px), linear-gradient(to bottom, ${LP.border} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        opacity: 0.55,
        maskImage:
          "radial-gradient(ellipse 60% 70% at 50% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 60% 70% at 50% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)",
        pointerEvents: "none",
      }}
    />
  );
}

/* ───────────── 小组件：CTA 卡内脉冲装饰 ───────────── */
function CTAPulseCard() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 16,
        padding: 24,
        width: 260,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          borderRadius: 12,
          padding: 20,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <img src={pulse} alt="pulse" style={{ width: 80, height: 80 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CTALine w="85%" />
        <CTALine w="70%" />
        <CTALine w="50%" />
      </div>
    </div>
  );
}

function CTALine({ w }: { w: string }) {
  return (
    <div
      style={{
        width: w,
        height: 8,
        background: "rgba(255,255,255,0.22)",
        borderRadius: 4,
      }}
    />
  );
}

/* ───────────── 小组件：CTA 区点阵装饰 ───────────── */
function DecorDots() {
  const dots: [number, number, number][] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      dots.push([c * 48 + 8, r * 48 + 8, 3 + (r % 2) * 0.5]);
    }
  }
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right: -80,
        top: -60,
        width: 520,
        height: 320,
        opacity: 0.12,
        transform: "rotate(10deg)",
      }}
    >
      {dots.map(([x, y, s], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: s,
            height: s,
            borderRadius: "50%",
            background: "white",
          }}
        />
      ))}
    </div>
  );
}
