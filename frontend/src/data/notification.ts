const notifData = [
  {
    id: 1, read: false, type: "success",
    title: "AI抽取任务 #EXT-202607-012 已完成",
    body: "共处理 486 条记录，成功 443，低置信度 25，失败 18。平均置信度 0.87。",
    time: "5 分钟前", target: "extraction-tasks",
  },
  {
    id: 2, read: false, type: "warning",
    title: "37 项AI结果等待人工复核",
    body: "其中 9 项为高优先级（置信度 < 0.70），建议今日内处理。",
    time: "1 小时前", target: "review-queue",
  },
  {
    id: 3, read: false, type: "info",
    title: "数据导出包 EXP-20260701 已生成",
    body: "9 张数据表，12,486 条记录，质量检查通过。可在数据交付页面下载。",
    time: "2 小时前", target: "export-tasks",
  },
  {
    id: 4, read: true, type: "success",
    title: "演化趋势重算完成",
    body: "2026H1 能力覆盖率及演化信号已更新，识别到 3 项新兴能力事件。",
    time: "昨天 14:30", target: "evolution-trends",
  },
  {
    id: 5, read: true, type: "warning",
    title: "导入批次 JOB-202607-005 存在重复数据",
    body: "检测到 12 条记录与已有批次重复，建议在数据中心处理后再运行抽取。",
    time: "昨天 09:15", target: "import-batches",
  },
  {
    id: 6, read: true, type: "info",
    title: "系统例行维护通知",
    body: "系统将于本周日 02:00—04:00 进行例行维护，期间无法访问平台。",
    time: "2 天前", target: "",
  },
];

export default notifData;
