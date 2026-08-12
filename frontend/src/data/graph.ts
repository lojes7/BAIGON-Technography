import type { GraphNode } from "../types";

const GRAPH_NODES: GraphNode[] = [
  { id: "ind1", label: "人工智能软件", type: "industry", x: 380, y: 45 },
  { id: "fam1", label: "大模型应用", type: "family", x: 185, y: 140 },
  { id: "fam2", label: "机器视觉", type: "family", x: 545, y: 140 },
  { id: "job1", label: "大模型应用工程师", type: "job", x: 80, y: 250 },
  { id: "job2", label: "AI平台工程师", type: "job", x: 265, y: 250 },
  { id: "job3", label: "机器视觉工程师", type: "job", x: 445, y: 250 },
  { id: "job4", label: "数据开发工程师", type: "job", x: 635, y: 250 },
  { id: "sk1", label: "RAG工程化", type: "skill", x: 55, y: 375 },
  { id: "sk2", label: "Agent编排", type: "skill", x: 185, y: 375 },
  { id: "sk3", label: "向量数据库", type: "skill", x: 310, y: 375 },
  { id: "sk4", label: "Python工程化", type: "skill", x: 435, y: 375 },
  { id: "sk5", label: "图像识别", type: "skill", x: 560, y: 375 },
  { id: "sk6", label: "模型评测", type: "skill", x: 680, y: 375 },
  { id: "tl1", label: "LangChain", type: "tool", x: 90, y: 460 },
  { id: "tl2", label: "PyTorch", type: "tool", x: 430, y: 460 },
  { id: "tl3", label: "FastAPI", type: "tool", x: 295, y: 460 },
];

const GRAPH_EDGES = [
  { from: "ind1", to: "fam1", confirmed: true },
  { from: "ind1", to: "fam2", confirmed: true },
  { from: "fam1", to: "job1", confirmed: true },
  { from: "fam1", to: "job2", confirmed: true },
  { from: "fam2", to: "job3", confirmed: true },
  { from: "fam2", to: "job4", confirmed: true },
  { from: "job1", to: "sk1", confirmed: true },
  { from: "job1", to: "sk2", confirmed: true },
  { from: "job2", to: "sk2", confirmed: true },
  { from: "job2", to: "sk3", confirmed: false },
  { from: "job3", to: "sk4", confirmed: true },
  { from: "job3", to: "sk5", confirmed: true },
  { from: "job4", to: "sk4", confirmed: true },
  { from: "job4", to: "sk6", confirmed: false },
  { from: "sk1", to: "tl1", confirmed: false },
  { from: "sk2", to: "tl1", confirmed: true },
  { from: "sk4", to: "tl2", confirmed: true },
  { from: "sk3", to: "tl3", confirmed: false },
];

function getNodePos(id: string) {
  return GRAPH_NODES.find(n => n.id === id)!;
}

export { GRAPH_NODES, GRAPH_EDGES, getNodePos };
