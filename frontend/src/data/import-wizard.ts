import type { GraphNode } from "../types";

const MOCK_FILE = {
  name: "招聘岗位数据_智联招聘_2026Q2.xlsx",
  size: "2.8 MB",
  rows: 1024,
  encoding: "UTF-8",
  hash: "a3f2e1b8c94d…c48d07f2",
  modified: "2026-07-01",
  sheets: ["Sheet1（岗位数据）", "Sheet2（企业列表）"],
};

const fileChecks = [
  { ok: true, msg: "文件格式正确（XLSX / Office Open XML）" },
  { ok: true, msg: `SHA-256 哈希已计算：${MOCK_FILE.hash}` },
  { ok: true, msg: "未检测到与已有批次的重复文件" },
  { ok: true, msg: `编码：${MOCK_FILE.encoding}（无需转换）` },
  { ok: false, msg: "Sheet2（企业列表）内容将被忽略，仅导入 Sheet1", warn: true },
];

const changeList = [
  { op: "add", name: "Agent编排", detail: "新兴能力，2026H1首次识别", conf: "高" },
  { op: "add", name: "AI安全治理", detail: "新兴能力，监管驱动", conf: "中" },
  { op: "add", name: "模型评测框架", detail: "工具节点新增", conf: "中" },
  { op: "rise", name: "RAG工程化", detail: "岗位覆盖率 +8.7%，权重上升", conf: "高" },
  { op: "rise", name: "MLOps", detail: "关联岗位 +4，关系数量增加", conf: "高" },
  { op: "fall", name: "传统图像标注工具", detail: "需求持续下降，节点权重减弱", conf: "高" },
  { op: "remove", name: "Hadoop生态", detail: "岗位覆盖率低于阈值，转为归档", conf: "高" },
];

export { MOCK_FILE, fileChecks, changeList };

const miniNodePositions: { id: string; label: string; type: GraphNode["type"]; x: number; y: number }[] = [
  { id: "ind1", label: "AI软件", type: "industry", x: 180, y: 38 },
  { id: "fam1", label: "大模型", type: "family", x: 90, y: 100 },
  { id: "fam2", label: "机器视觉", type: "family", x: 265, y: 100 },
  { id: "job1", label: "大模型工程师", type: "job", x: 42, y: 168 },
  { id: "job2", label: "AI平台", type: "job", x: 135, y: 168 },
  { id: "job3", label: "视觉工程师", type: "job", x: 220, y: 168 },
  { id: "job4", label: "数据开发", type: "job", x: 318, y: 168 },
  { id: "sk1", label: "RAG", type: "skill", x: 35, y: 240 },
  { id: "sk2", label: "Agent编排", type: "skill", x: 115, y: 240 },
  { id: "sk3", label: "向量DB", type: "skill", x: 190, y: 240 },
  { id: "sk4", label: "Python", type: "skill", x: 265, y: 240 },
  { id: "sk5", label: "图像识别", type: "skill", x: 335, y: 240 },
  { id: "tl1", label: "LangChain", type: "tool", x: 70, y: 300 },
  { id: "tl2", label: "PyTorch", type: "tool", x: 240, y: 300 },
];

const miniEdges = [
  ["ind1","fam1"],["ind1","fam2"],["fam1","job1"],["fam1","job2"],
  ["fam2","job3"],["fam2","job4"],["job1","sk1"],["job1","sk2"],
  ["job2","sk2"],["job2","sk3"],["job3","sk4"],["job3","sk5"],
  ["job4","sk4"],["sk1","tl1"],["sk2","tl1"],["sk4","tl2"],
];

export { miniNodePositions, miniEdges };
