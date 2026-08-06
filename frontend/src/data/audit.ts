import T from "../constants/tokens";

const auditEntries = [
  { time: "2026-07-06 14:23:11", user: "张研究员", action: "接受复核", entity: "能力归一 · Agent编排", ip: "10.0.1.22", type: "review" },
  { time: "2026-07-06 13:45:02", user: "李分析师", action: "运行演化分析", entity: "趋势总览 · 常州市 2026H1", ip: "10.0.1.31", type: "analysis" },
  { time: "2026-07-06 11:12:54", user: "张研究员", action: "创建导出批次", entity: "EXP-20260701", ip: "10.0.1.22", type: "export" },
  { time: "2026-07-05 16:30:45", user: "王复核员", action: "拒绝复核项", entity: "岗位映射 · 大模型研究员", ip: "10.0.1.18", type: "review" },
  { time: "2026-07-05 15:08:22", user: "张研究员", action: "启动AI抽取", entity: "EXT-202607-012 · JOB-202607-006", ip: "10.0.1.22", type: "extraction" },
  { time: "2026-07-05 10:55:13", user: "赵数据工程师", action: "导入数据批次", entity: "JOB-202607-006 · 486 条记录", ip: "10.0.1.45", type: "import" },
  { time: "2026-07-04 09:20:31", user: "李分析师", action: "新建标准能力", entity: "能力词典 · AI安全治理", ip: "10.0.1.31", type: "dict" },
  { time: "2026-07-03 17:44:08", user: "张研究员", action: "采纳改进建议", entity: "建议 · Agent编排考核证据", ip: "10.0.1.22", type: "recommendation" },
];

const actionTypeColors: Record<string, string> = {
  review: T.stable, analysis: T.teal, export: T.emerging,
  extraction: T.ink, import: T.info, dict: T.declining,
  recommendation: T.pending,
};

export { auditEntries, actionTypeColors };
