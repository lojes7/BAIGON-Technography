const T = {
  ink: "#19324D",      
  teal: "#338fb1",     // Primary-600 品牌主色
  bg: "#f0f6f4",       // Neutral-100 全局背景（冷灰）
  cloud: "#c7def5",    // 表头/浅底
  white: "#FFFFFF",    // Surface-White 卡片表面
  border: "#E5E7EB",   // Border-Light 分割线/边框
  emerging: "#10b943", // Success-500 成功/通过
  stable: "#3E6FA3",   // 稳定（蓝灰）
  declining: "#B26A3C",// 下降（橙棕）
  risk: "#EF4444",     // Error-500 错误/驳回
  pending: "#F59E0B",  // Warning-500 警告/待审核
  info: "#374c6a",     // Neutral-600 正文
} as const;

export default T;
