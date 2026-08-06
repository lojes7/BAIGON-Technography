const cooccurrenceNodes = [
  { id: "center", label: "Python工程化", angle: 0, r: 0 },
  { id: "rag", label: "RAG工程化", angle: 0, r: 110 },
  { id: "agent", label: "Agent编排", angle: 72, r: 110 },
  { id: "vec", label: "向量数据库", angle: 144, r: 110 },
  { id: "eval", label: "模型评测", angle: 216, r: 110 },
  { id: "mlops", label: "MLOps", angle: 288, r: 110 },
  { id: "lc", label: "LangChain", angle: 36, r: 185 },
  { id: "torch", label: "PyTorch", angle: 180, r: 185 },
];

const comboChanges = [
  { op: "add", a: "Python工程化", b: "Agent编排", detail: "共现率 +14.2%", period: "2025H1→2026H1" },
  { op: "add", a: "Python工程化", b: "向量数据库", detail: "共现率 +9.8%", period: "2025H1→2026H1" },
  { op: "add", a: "Python工程化", b: "模型评测", detail: "共现率 +6.1%", period: "2025H1→2026H1" },
  { op: "remove", a: "Python工程化", b: "传统图像标注工具", detail: "共现率 -8.3%", period: "2025H1→2026H1" },
  { op: "remove", a: "Python工程化", b: "Hadoop生态", detail: "共现率 -11.4%", period: "2025H1→2026H1" },
];

export { cooccurrenceNodes, comboChanges };
