const recommendations = [
  {
    priority: "high",
    title: "Agent编排能力缺少正式实践与考核证据",
    rationale: "岗位覆盖率18.4%，连续两个半年窗口上升；当前人工智能专业仅1门课程大纲中声明此能力，无实践记录。",
    suggestion: '在"智能应用开发实训"课程中增加Agent工作流项目与评分标准（Rubric），建议不少于16学时。',
    type: "课程优化", level: "课程级", conf: 0.91, aiGenerated: true, expertStatus: "pending",
  },
  {
    priority: "high",
    title: "模型评测能力无课程覆盖，产业需求持续上升",
    rationale: "岗位覆盖率已达19项，3家龙头企业近半年岗位描述均提及评测框架；培养方案内无对应课程或实践环节。",
    suggestion: '建议新增"大模型评测与质量保障"专题课或模块，纳入毕业设计选题方向。',
    type: "新增内容", level: "专业级", conf: 0.87, aiGenerated: true, expertStatus: "pending",
  },
  {
    priority: "medium",
    title: "AI安全治理知识在现有课程体系中完全缺失",
    rationale: "监管文件发布后企业招聘开始显著提及AI合规要求；当前培养方案无此类内容。",
    suggestion: '在"人工智能导论"或"职业素养"课程中增加AI伦理与合规模块，约4-6学时。',
    type: "内容补充", level: "课程级", conf: 0.78, aiGenerated: true, expertStatus: "pending",
  },
  {
    priority: "medium",
    title: "RAG工程化覆盖质量偏低，以声明型证据为主",
    rationale: "该能力已有课程声明，但缺乏实践和考核证据，支撑等级整体为低；响应时滞已达16个月。",
    suggestion: '升级"知识图谱与信息检索"课程实验内容，增加RAG系统构建实践项目。',
    type: "证据强化", level: "课程级", conf: 0.82, aiGenerated: false, expertStatus: "confirmed",
  },
];

export default recommendations;
