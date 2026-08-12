const evolutionData = [
  { period: "23H1", rag: 2.1, agent: 0.8, cv: 15.2, python: 62.1, mlops: 4.5 },
  { period: "23H2", rag: 4.3, agent: 1.4, cv: 14.1, python: 64.3, mlops: 5.2 },
  { period: "24H1", rag: 8.7, agent: 3.2, cv: 12.8, python: 68.7, mlops: 6.8 },
  { period: "24H2", rag: 12.1, agent: 6.5, cv: 11.4, python: 71.1, mlops: 7.4 },
  { period: "25H1", rag: 15.8, agent: 12.3, cv: 9.6, python: 75.8, mlops: 9.2 },
  { period: "25H2", rag: 17.2, agent: 15.9, cv: 7.8, python: 77.2, mlops: 10.1 },
  { period: "26H1", rag: 19.4, agent: 18.4, cv: 5.9, python: 79.4, mlops: 11.3 },
];

export default evolutionData;

const evolutionEvents = [
  {
    id: "EVT-2026-041", ability: "Agent编排", type: "emerging",
    period: "2025H1→2026H1", coverage: "18.4%", change: "+12.8%",
    companies: 14, samples: 38, confidence: 0.91,
    description: "基于LangChain、AutoGen等框架的多智能体系统设计能力需求显著上升，与大模型应用工程师岗位强相关。",
    expertStatus: "confirmed",
  },
  {
    id: "EVT-2026-039", ability: "RAG工程化", type: "emerging",
    period: "2024H2→2026H1", coverage: "19.4%", change: "+8.7%",
    companies: 19, samples: 52, confidence: 0.89,
    description: "检索增强生成技术从实验性转向工程化，企业开始要求候选人具备完整RAG系统的设计和调优能力。",
    expertStatus: "confirmed",
  },
  {
    id: "EVT-2026-037", ability: "模型评测", type: "emerging",
    period: "2025H2→2026H1", coverage: "11.2%", change: "+5.3%",
    companies: 11, samples: 24, confidence: 0.78,
    description: "随着大模型在生产环境部署增加，评测框架（MMLU、CMMLU等）和红队测试相关需求出现。",
    expertStatus: "pending",
  },
  {
    id: "EVT-2026-021", ability: "传统图像标注工具", type: "declining",
    period: "2024H1→2026H1", coverage: "5.9%", change: "-6.1%",
    companies: 5, samples: 14, confidence: 0.87,
    description: "随着自动化标注工具和数据飞轮方法普及，人工图像标注作为独立技能的需求持续收缩。",
    expertStatus: "confirmed",
  },
];

export { evolutionEvents };
