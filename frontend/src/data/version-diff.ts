const versionDiff = {
  added: [
    { item: "大模型应用开发", type: "课程", detail: "新增 32 学时选修课，映射 6 项能力" },
    { item: "智能应用开发实训", type: "课程更新", detail: "学时 60 → 80，新增 Agent 工作流项目" },
    { item: "Agent编排", type: "能力新增", detail: "首次纳入培养目标，关联智能应用开发实训" },
    { item: "模型评测", type: "能力新增", detail: "新增为专业核心能力，关联大模型应用开发" },
  ],
  removed: [
    { item: "大数据处理技术", type: "课程移除", detail: "课程移除，相关能力（Hadoop生态）同步下线" },
    { item: "Hadoop生态", type: "能力移除", detail: "岗位需求下降，从培养目标中移除" },
  ],
  changed: [
    { item: "深度学习与神经网络", type: "学时变更", detail: "48 学时 → 64 学时，增加大模型相关内容" },
    { item: "Python机器学习实践", type: "内容更新", detail: "增加 LangChain / FastAPI 实践内容" },
  ],
};

export default versionDiff;
