// 后台统一深蓝色板 P —— 与工作台(AdminDashboard)/数据导入(ImportWizard)/趋势总览(EvolutionTrends)对齐。
// 注：能力图谱(GraphBrowser)等使用 constants/tokens.ts 的 T 色板，互不干扰。
const P = {
  primary: "#1E4C8F",      // 深蓝主色
  primaryDeep: "#12305E",  // 深蓝渐变深端
  sky: "#A9C8EC",          // 浅蓝
  skySoft: "#DCE8F6",      // 更浅蓝（表头/底色）
  ink: "#16283E",          // 标题
  muted: "#5E6E82",        // 正文次级
  faint: "#8B99AB",        // 弱化
  bg: "#F3F6FB",
  green: "#159A6C", greenBg: "#E4F4ED",
  amber: "#D98E1F", amberBg: "#FBF1DC",
  red: "#E25C4A", redBg: "#FBEAE7",
  violet: "#7468CE", violetBg: "#ECEAFA",
  teal: "#2E9E9A", tealBg: "#E0F2F1",
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

export default P;
