import type {
  DynamicGraphData,
  DynamicGraphNode,
  DynamicGraphEdge,
  EvidenceRecord,
  NodeDetailData,
} from "../types/dynamic-graph";

const _n = (n: DynamicGraphNode): DynamicGraphNode => n;
const _e = (e: DynamicGraphEdge): DynamicGraphEdge => e;

export const MOCK_GRAPH_NODES: DynamicGraphNode[] = [
  _n({ id: "core_000", type: "Domain", name: "软件工程", category: "领域主干", demandLevel: 1, fx: 450, fy: 310, summary: "新一代信息技术岗位全景图谱的领域主干节点。本图谱围绕软件工程领域展开，向下覆盖人工智能与大模型、大数据与数据工程、后端与云原生等技术栈下的职业、岗位角色、技能点、任务、工具与证书。" }),
  _n({ id: "core_001", type: "Domain", name: "人工智能", category: "领域主干", demandLevel: 0.95, trend: "emerging", emerging: true, summary: "新一代信息技术核心领域之一，覆盖机器学习、深度学习、大语言模型、计算机视觉与智能体等技术方向。" }),
  _n({ id: "core_002", type: "Domain", name: "大数据与数据工程", category: "领域主干", demandLevel: 0.9, trend: "rising", summary: "覆盖数据采集、存储、计算、治理与价值挖掘的完整数据技术领域。" }),
  _n({ id: "core_003", type: "Domain", name: "云计算与云原生", category: "领域主干", demandLevel: 0.87, trend: "rising", summary: "覆盖容器化、编排调度、微服务架构、DevOps 与云上基础设施的技术领域。" }),
  _n({ id: "core_004", type: "Domain", name: "智能制造与工业软件", category: "领域主干", demandLevel: 0.82, trend: "rising", summary: "覆盖工业视觉、工业互联网、数字孪生与制造业数字化转型的交叉领域。" }),
  _n({ id: "occ_001", type: "Occupation", name: "人工智能工程技术人员", category: "工程技术人员", demandLevel: 0.92, trend: "emerging", emerging: true, relatedJobCount: 186, sampleCount: 5420, coverage: 0.88, companyCount: 248, summary: "从事人工智能算法研发、模型训练、系统集成与应用部署的专业技术人员。随着大模型产业爆发，该职业需求呈指数级增长。" }),
  _n({ id: "occ_002", type: "Occupation", name: "大数据工程技术人员", category: "工程技术人员", demandLevel: 0.85, trend: "rising", relatedJobCount: 142, sampleCount: 4180, coverage: 0.81, companyCount: 189, summary: "从事大数据采集、清洗、存储、分析、可视化及平台架构设计的工程技术人员。" }),
  _n({ id: "occ_003", type: "Occupation", name: "软件工程技术人员", category: "工程技术人员", demandLevel: 0.88, trend: "stable", relatedJobCount: 520, sampleCount: 15600, coverage: 0.92, companyCount: 612, summary: "从事软件需求分析、设计、编码、测试、运维的专业技术人员，覆盖全行业数字化转型需求。" }),

  _n({ id: "job_001", type: "JobRole", name: "大模型应用工程师", industry: "人工智能", demandLevel: 0.95, trend: "emerging", emerging: true, relatedJobCount: 98, sampleCount: 2890, coverage: 0.91, companyCount: 156, requiredLevel: "精通", summary: "基于LLM构建智能应用系统的核心工程师，负责RAG、Agent、微调等关键技术落地。近两年招聘量同比增长420%。" }),
  _n({ id: "job_002", type: "JobRole", name: "大模型训练工程师", industry: "人工智能", demandLevel: 0.89, trend: "emerging", emerging: true, relatedJobCount: 54, sampleCount: 1620, coverage: 0.85, companyCount: 92, summary: "负责预训练语料构建、分布式训练、对齐微调、模型评测的工程专家，需深厚CUDA与分布式系统经验。" }),
  _n({ id: "job_003", type: "JobRole", name: "AI平台工程师", industry: "人工智能", demandLevel: 0.82, trend: "rising", relatedJobCount: 76, sampleCount: 2310, coverage: 0.79, companyCount: 118, summary: "构建机器学习平台、MLOps系统、特征存储、模型服务基础设施的资深工程师。" }),
  _n({ id: "job_004", type: "JobRole", name: "机器视觉算法工程师", industry: "智能制造", demandLevel: 0.80, trend: "rising", relatedJobCount: 112, sampleCount: 3240, coverage: 0.82, companyCount: 175, summary: "从事工业质检、自动驾驶、安防监控等场景的计算机视觉算法研发与部署工程师。" }),
  _n({ id: "job_005", type: "JobRole", name: "数据开发工程师", industry: "互联网", demandLevel: 0.84, trend: "rising", relatedJobCount: 168, sampleCount: 4890, coverage: 0.86, companyCount: 234, summary: "构建离线/实时数据管道、数据仓库、数据湖、BI指标体系的数据工程专家。" }),
  _n({ id: "job_006", type: "JobRole", name: "后端开发工程师", industry: "全行业", demandLevel: 0.90, trend: "stable", relatedJobCount: 420, sampleCount: 12800, coverage: 0.94, companyCount: 528, summary: "负责服务端业务系统架构设计、接口开发、性能优化、数据库设计的核心开发角色。" }),

  _n({ id: "sk_001", type: "Skill", name: "Python", category: "编程语言", demandLevel: 0.97, trend: "rising", relatedJobCount: 612, sampleCount: 18200, coverage: 0.95, summary: "人工智能与数据科学领域的事实标准语言，也是脚本自动化、Web后端的主流选择。" }),
  _n({ id: "sk_002", type: "Skill", name: "机器学习", category: "AI算法", demandLevel: 0.91, trend: "stable", relatedJobCount: 380, sampleCount: 11200, coverage: 0.90, summary: "经典监督/无监督学习、特征工程、模型调优、可解释性分析等基础AI能力。" }),
  _n({ id: "sk_003", type: "Skill", name: "深度学习", category: "AI算法", demandLevel: 0.93, trend: "rising", relatedJobCount: 312, sampleCount: 9450, coverage: 0.88, summary: "CNN/RNN/Transformer等深度神经网络架构设计与训练，是计算机视觉与NLP的基础。" }),
  _n({ id: "sk_004", type: "Skill", name: "大语言模型", category: "AI算法", demandLevel: 0.96, trend: "emerging", emerging: true, relatedJobCount: 248, sampleCount: 7520, coverage: 0.89, summary: "LLM预训练、SFT、RLHF、LoRA/QLoRA微调、推理加速、Prompt工程等前沿技术。" }),
  _n({ id: "sk_005", type: "Skill", name: "RAG工程化", category: "LLM应用", demandLevel: 0.94, trend: "emerging", emerging: true, relatedJobCount: 186, sampleCount: 5680, coverage: 0.92, summary: "检索增强生成系统的完整工程实践：文档切片、向量索引、召回排序、引用溯源。" }),
  _n({ id: "sk_006", type: "Skill", name: "Agent编排", category: "LLM应用", demandLevel: 0.88, trend: "emerging", emerging: true, relatedJobCount: 124, sampleCount: 3820, coverage: 0.85, summary: "多智能体协作框架、工具调用(Function Calling)、规划推理(ReAct/ToT)、记忆管理。" }),
  _n({ id: "sk_007", type: "Skill", name: "向量数据库", category: "数据存储", demandLevel: 0.86, trend: "emerging", emerging: true, relatedJobCount: 142, sampleCount: 4310, coverage: 0.82, summary: "Milvus/Pgvector/FAISS等向量检索引擎的部署、索引调优与多模态检索实践。" }),
  _n({ id: "sk_008", type: "Skill", name: "模型评测", category: "LLM应用", demandLevel: 0.82, trend: "emerging", emerging: true, relatedJobCount: 98, sampleCount: 2980, coverage: 0.78, summary: "LLM能力基准评测、幻觉检测、红蓝对抗、A/B测试框架构建与质量评估体系。" }),
  _n({ id: "sk_009", type: "Skill", name: "计算机视觉", category: "AI算法", demandLevel: 0.85, trend: "stable", relatedJobCount: 168, sampleCount: 5120, coverage: 0.83, summary: "目标检测、图像分割、OCR、多模态理解、3D视觉等CV核心算法。" }),
  _n({ id: "sk_010", type: "Skill", name: "Python工程化", category: "工程实践", demandLevel: 0.89, trend: "stable", relatedJobCount: 284, sampleCount: 8640, coverage: 0.88, summary: "Python项目结构设计、类型注解、单元测试、CI/CD、性能分析、打包发布。" }),
  _n({ id: "sk_011", type: "Skill", name: "PyTorch", category: "深度学习框架", demandLevel: 0.94, trend: "rising", relatedJobCount: 296, sampleCount: 9020, coverage: 0.91, summary: "当前学术界与工业界主流的深度学习框架，支持动态图、分布式训练、ONNX导出。" }),
  _n({ id: "sk_012", type: "Skill", name: "数据仓库", category: "大数据", demandLevel: 0.87, trend: "stable", relatedJobCount: 204, sampleCount: 6230, coverage: 0.85, summary: "维度建模、ETL/ELT、湖仓一体、StarRocks/Snowflake/ClickHouse等引擎实践。" }),
  _n({ id: "sk_013", type: "Skill", name: "SQL", category: "数据查询", demandLevel: 0.95, trend: "stable", relatedJobCount: 486, sampleCount: 14600, coverage: 0.93, summary: "结构化查询语言，数据分析师、工程师、科学家的通用技能。" }),
  _n({ id: "sk_014", type: "Skill", name: "Java", category: "编程语言", demandLevel: 0.92, trend: "stable", relatedJobCount: 388, sampleCount: 11800, coverage: 0.91, summary: "企业级后端服务的绝对主流语言，Spring生态与金融/政企领域首选。" }),
  _n({ id: "sk_015", type: "Skill", name: "FastAPI", category: "Web框架", demandLevel: 0.85, trend: "rising", relatedJobCount: 142, sampleCount: 4380, coverage: 0.83, summary: "Python生态最高性能的异步Web框架，AI模型服务接口的首选框架。" }),
  _n({ id: "sk_016", type: "Skill", name: "CUDA编程", category: "高性能计算", demandLevel: 0.78, trend: "rising", relatedJobCount: 68, sampleCount: 2080, coverage: 0.74, summary: "GPU底层编程、算子融合、FlashAttention、显存优化、分布式训练通信优化。" }),
  _n({ id: "sk_017", type: "Skill", name: "图像识别", category: "计算机视觉", demandLevel: 0.83, trend: "stable", relatedJobCount: 112, sampleCount: 3420, coverage: 0.80, summary: "基于CNN/ViT的图像分类、目标检测、实例分割、多目标跟踪算法。" }),
  _n({ id: "sk_018", type: "Skill", name: "提示词工程", category: "LLM应用", demandLevel: 0.90, trend: "emerging", emerging: true, relatedJobCount: 218, sampleCount: 6640, coverage: 0.88, summary: "Prompt模板设计、少样本学习、思维链引导、结构化输出、越狱防护。" }),

  _n({ id: "tk_001", type: "Task", name: "大模型预训练数据构建", demandLevel: 0.82, trend: "emerging", summary: "多源语料清洗、去重、质量打分、指令数据构造、安全对齐数据集构建。", relatedJobCount: 52 }),
  _n({ id: "tk_002", type: "Task", name: "RAG系统搭建与优化", demandLevel: 0.90, trend: "emerging", summary: "从文档解析、切块、向量化、召回重排到引用校验的完整RAG流水线实现。", relatedJobCount: 96 }),
  _n({ id: "tk_003", type: "Task", name: "工业缺陷检测算法开发", demandLevel: 0.76, trend: "rising", summary: "基于视觉的制造业表面缺陷检测、少样本学习、半监督学习算法落地。", relatedJobCount: 48 }),
  _n({ id: "tk_004", type: "Task", name: "用户画像系统建模", demandLevel: 0.80, trend: "stable", summary: "标签体系设计、特征工程、召回排序、A/B测试、推荐算法优化。", relatedJobCount: 108 }),
  _n({ id: "tk_005", type: "Task", name: "实时数据管道开发", demandLevel: 0.83, trend: "rising", summary: "Kafka/Flink/Spark Streaming实时计算、Exactly-Once语义、窗口聚合。", relatedJobCount: 86 }),

  _n({ id: "tl_001", type: "Tool", name: "LangChain", category: "LLM框架", demandLevel: 0.92, trend: "rising", summary: "最流行的LLM应用开发框架，提供Chain/Agent/Tool/RAG等抽象组件。", relatedJobCount: 186 }),
  _n({ id: "tl_002", type: "Tool", name: "PyTorch", category: "深度学习框架", demandLevel: 0.94, trend: "rising", summary: "Meta开源的深度学习训练框架，动态图设计，科研与工业界主流。", relatedJobCount: 296 }),
  _n({ id: "tl_003", type: "Tool", name: "FastAPI", category: "Web框架", demandLevel: 0.85, trend: "rising", summary: "高性能Python异步API框架，Pydantic类型校验与自动OpenAPI文档。", relatedJobCount: 142 }),
  _n({ id: "tl_004", type: "Tool", name: "Transformers", category: "模型库", demandLevel: 0.93, trend: "rising", summary: "HuggingFace开源模型库，预训练模型下载与微调一站式工具。", relatedJobCount: 268 }),
  _n({ id: "tl_005", type: "Tool", name: "Milvus", category: "向量数据库", demandLevel: 0.79, trend: "emerging", summary: "开源云原生向量数据库，支持十亿级向量检索与混合查询。", relatedJobCount: 82 }),
  _n({ id: "tl_006", type: "Tool", name: "Docker", category: "容器化", demandLevel: 0.91, trend: "stable", summary: "应用容器打包标准，微服务部署与CI/CD流水线的基础设施。", relatedJobCount: 426 }),
  _n({ id: "tl_007", type: "Tool", name: "Kubernetes", category: "容器编排", demandLevel: 0.86, trend: "rising", summary: "容器编排事实标准，服务发现、弹性伸缩、滚动发布、服务网格。", relatedJobCount: 254 }),
  _n({ id: "tl_008", type: "Tool", name: "Kafka", category: "消息队列", demandLevel: 0.84, trend: "stable", summary: "高吞吐分布式消息队列，日志采集、实时计算、事件驱动架构核心。", relatedJobCount: 196 }),
  _n({ id: "tl_009", type: "Tool", name: "Spring Boot", category: "Web框架", demandLevel: 0.93, trend: "stable", summary: "Java后端开发首选框架，约定优于配置，快速构建微服务。", relatedJobCount: 368 }),
  _n({ id: "tl_010", type: "Tool", name: "vLLM", category: "推理引擎", demandLevel: 0.81, trend: "emerging", summary: "高吞吐LLM推理引擎，PagedAttention显存优化，支持连续批处理。", relatedJobCount: 72 }),

  _n({ id: "cert_001", type: "Certificate", name: "阿里云AIGC应用开发工程师认证", issuer: "阿里云", difficulty: "中级", demandLevel: 0.72, trend: "emerging", summary: "面向大模型应用开发的官方能力认证，覆盖Prompt、RAG、Agent、微调。", relatedJobCount: 46 }),
  _n({ id: "cert_002", type: "Certificate", name: "英伟达深度学习工程师认证(DLI)", issuer: "NVIDIA", difficulty: "高级", demandLevel: 0.80, trend: "rising", summary: "NVIDIA官方深度学习与CUDA编程认证，AI基础设施领域含金量极高。", relatedJobCount: 68 }),
  _n({ id: "cert_003", type: "Certificate", name: "华为昇腾AI工程师认证", issuer: "华为", difficulty: "中级", demandLevel: 0.74, trend: "emerging", summary: "基于昇腾算力平台与MindSpore框架的国产AI技能认证。", relatedJobCount: 52 }),
  _n({ id: "cert_004", type: "Certificate", name: "PMP项目管理专业人士", issuer: "PMI", difficulty: "中级", demandLevel: 0.77, trend: "stable", summary: "全球认可的项目管理黄金认证，技术管理岗晋升加分项。", relatedJobCount: 128 }),
  _n({ id: "cert_005", type: "Certificate", name: "AWS机器学习专项认证(MLS-C01)", issuer: "Amazon", difficulty: "高级", demandLevel: 0.71, trend: "rising", summary: "云原生AI平台能力认证，覆盖SageMaker全栈实践。", relatedJobCount: 38 }),
];

export const MOCK_GRAPH_EDGES: DynamicGraphEdge[] = [
  _e({ id: "e_core_1", source: "core_000", target: "occ_001", relationType: "BROADER_THAN", confidence: "human", importance: 0.9 }),
  _e({ id: "e_core_2", source: "core_000", target: "occ_002", relationType: "BROADER_THAN", confidence: "human", importance: 0.85 }),
  _e({ id: "e_core_3", source: "core_000", target: "occ_003", relationType: "BROADER_THAN", confidence: "human", importance: 0.95 }),
  _e({ id: "e_core_4", source: "core_001", target: "occ_001", relationType: "BROADER_THAN", confidence: "human", importance: 0.92 }),
  _e({ id: "e_core_5", source: "core_001", target: "job_001", relationType: "BROADER_THAN", confidence: "human", importance: 0.85 }),
  _e({ id: "e_core_6", source: "core_001", target: "job_002", relationType: "BROADER_THAN", confidence: "human", importance: 0.8 }),
  _e({ id: "e_core_7", source: "core_001", target: "job_004", relationType: "BROADER_THAN", confidence: "rule", importance: 0.78 }),
  _e({ id: "e_core_8", source: "core_002", target: "occ_002", relationType: "BROADER_THAN", confidence: "human", importance: 0.9 }),
  _e({ id: "e_core_9", source: "core_002", target: "job_005", relationType: "BROADER_THAN", confidence: "human", importance: 0.84 }),
  _e({ id: "e_core_10", source: "core_003", target: "job_003", relationType: "BROADER_THAN", confidence: "human", importance: 0.8 }),
  _e({ id: "e_core_11", source: "core_003", target: "job_006", relationType: "BROADER_THAN", confidence: "human", importance: 0.82 }),
  _e({ id: "e_core_12", source: "core_004", target: "job_004", relationType: "BROADER_THAN", confidence: "rule", importance: 0.76 }),
  _e({ id: "e_core_13", source: "core_004", target: "tk_003", relationType: "BROADER_THAN", confidence: "rule", importance: 0.72 }),
  _e({ id: "e_001", source: "occ_001", target: "job_001", relationType: "REQUIRES", confidence: "human", importance: 0.95, requiredLevel: "精通" }),
  _e({ id: "e_002", source: "occ_001", target: "job_002", relationType: "REQUIRES", confidence: "human", importance: 0.90, requiredLevel: "精通" }),
  _e({ id: "e_003", source: "occ_001", target: "job_003", relationType: "REQUIRES", confidence: "human", importance: 0.82, requiredLevel: "熟练" }),
  _e({ id: "e_004", source: "occ_002", target: "job_005", relationType: "REQUIRES", confidence: "human", importance: 0.88, requiredLevel: "精通" }),
  _e({ id: "e_005", source: "occ_003", target: "job_006", relationType: "REQUIRES", confidence: "human", importance: 0.92, requiredLevel: "精通" }),
  _e({ id: "e_006", source: "occ_001", target: "job_004", relationType: "REQUIRES", confidence: "rule", importance: 0.76, requiredLevel: "熟练" }),

  _e({ id: "e_007", source: "job_001", target: "sk_004", relationType: "REQUIRES", confidence: "human", importance: 0.97, requiredLevel: "精通" }),
  _e({ id: "e_008", source: "job_001", target: "sk_005", relationType: "REQUIRES", confidence: "human", importance: 0.96, requiredLevel: "精通" }),
  _e({ id: "e_009", source: "job_001", target: "sk_006", relationType: "REQUIRES", confidence: "human", importance: 0.92, requiredLevel: "熟练" }),
  _e({ id: "e_010", source: "job_001", target: "sk_001", relationType: "REQUIRES", confidence: "human", importance: 0.95, requiredLevel: "精通" }),
  _e({ id: "e_011", source: "job_001", target: "sk_018", relationType: "REQUIRES", confidence: "rule", importance: 0.84, requiredLevel: "熟练" }),
  _e({ id: "e_012", source: "job_001", target: "tl_001", relationType: "REQUIRES", confidence: "rule", importance: 0.88, requiredLevel: "熟练" }),
  _e({ id: "e_013", source: "job_001", target: "tk_002", relationType: "REQUIRES", confidence: "human", importance: 0.91, requiredLevel: "熟练" }),

  _e({ id: "e_014", source: "job_002", target: "sk_004", relationType: "REQUIRES", confidence: "human", importance: 0.94, requiredLevel: "精通" }),
  _e({ id: "e_015", source: "job_002", target: "sk_011", relationType: "REQUIRES", confidence: "human", importance: 0.92, requiredLevel: "精通" }),
  _e({ id: "e_016", source: "job_002", target: "sk_016", relationType: "REQUIRES", confidence: "rule", importance: 0.86, requiredLevel: "熟练" }),
  _e({ id: "e_017", source: "job_002", target: "tk_001", relationType: "REQUIRES", confidence: "human", importance: 0.89, requiredLevel: "熟练" }),
  _e({ id: "e_018", source: "job_002", target: "tl_004", relationType: "REQUIRES", confidence: "rule", importance: 0.85, requiredLevel: "熟练" }),

  _e({ id: "e_019", source: "job_003", target: "sk_007", relationType: "REQUIRES", confidence: "human", importance: 0.88, requiredLevel: "熟练" }),
  _e({ id: "e_020", source: "job_003", target: "sk_006", relationType: "REQUIRES", confidence: "rule", importance: 0.78, requiredLevel: "熟悉" }),
  _e({ id: "e_021", source: "job_003", target: "tl_006", relationType: "REQUIRES", confidence: "human", importance: 0.86, requiredLevel: "熟练" }),
  _e({ id: "e_022", source: "job_003", target: "tl_007", relationType: "REQUIRES", confidence: "rule", importance: 0.80, requiredLevel: "熟悉" }),
  _e({ id: "e_023", source: "job_003", target: "sk_015", relationType: "REQUIRES", confidence: "human", importance: 0.84, requiredLevel: "熟练" }),

  _e({ id: "e_024", source: "job_004", target: "sk_009", relationType: "REQUIRES", confidence: "human", importance: 0.93, requiredLevel: "精通" }),
  _e({ id: "e_025", source: "job_004", target: "sk_017", relationType: "REQUIRES", confidence: "human", importance: 0.88, requiredLevel: "精通" }),
  _e({ id: "e_026", source: "job_004", target: "sk_003", relationType: "REQUIRES", confidence: "human", importance: 0.90, requiredLevel: "熟练" }),
  _e({ id: "e_027", source: "job_004", target: "tk_003", relationType: "REQUIRES", confidence: "human", importance: 0.85, requiredLevel: "熟练" }),
  _e({ id: "e_028", source: "job_004", target: "sk_011", relationType: "REQUIRES", confidence: "rule", importance: 0.82, requiredLevel: "熟练" }),

  _e({ id: "e_029", source: "job_005", target: "sk_012", relationType: "REQUIRES", confidence: "human", importance: 0.91, requiredLevel: "精通" }),
  _e({ id: "e_030", source: "job_005", target: "sk_013", relationType: "REQUIRES", confidence: "human", importance: 0.97, requiredLevel: "精通" }),
  _e({ id: "e_031", source: "job_005", target: "tk_005", relationType: "REQUIRES", confidence: "human", importance: 0.87, requiredLevel: "熟练" }),
  _e({ id: "e_032", source: "job_005", target: "tl_008", relationType: "REQUIRES", confidence: "human", importance: 0.85, requiredLevel: "熟练" }),
  _e({ id: "e_033", source: "job_005", target: "tk_004", relationType: "REQUIRES", confidence: "rule", importance: 0.80, requiredLevel: "熟悉" }),

  _e({ id: "e_034", source: "job_006", target: "sk_014", relationType: "REQUIRES", confidence: "human", importance: 0.96, requiredLevel: "精通" }),
  _e({ id: "e_035", source: "job_006", target: "tl_009", relationType: "REQUIRES", confidence: "human", importance: 0.94, requiredLevel: "精通" }),
  _e({ id: "e_036", source: "job_006", target: "tl_006", relationType: "REQUIRES", confidence: "human", importance: 0.90, requiredLevel: "熟练" }),
  _e({ id: "e_037", source: "job_006", target: "sk_013", relationType: "REQUIRES", confidence: "human", importance: 0.88, requiredLevel: "熟练" }),

  _e({ id: "e_038", source: "sk_002", target: "sk_003", relationType: "BROADER_THAN", confidence: "human", importance: 0.95 }),
  _e({ id: "e_039", source: "sk_003", target: "sk_004", relationType: "BROADER_THAN", confidence: "human", importance: 0.92 }),
  _e({ id: "e_040", source: "sk_003", target: "sk_009", relationType: "BROADER_THAN", confidence: "human", importance: 0.88 }),
  _e({ id: "e_041", source: "sk_004", target: "sk_005", relationType: "BROADER_THAN", confidence: "human", importance: 0.90 }),
  _e({ id: "e_042", source: "sk_004", target: "sk_006", relationType: "BROADER_THAN", confidence: "rule", importance: 0.85 }),
  _e({ id: "e_043", source: "sk_004", target: "sk_008", relationType: "BROADER_THAN", confidence: "rule", importance: 0.82 }),
  _e({ id: "e_044", source: "sk_004", target: "sk_018", relationType: "BROADER_THAN", confidence: "rule", importance: 0.78 }),
  _e({ id: "e_045", source: "sk_009", target: "sk_017", relationType: "BROADER_THAN", confidence: "human", importance: 0.90 }),

  _e({ id: "e_046", source: "sk_003", target: "sk_004", relationType: "EVOLVES_INTO", confidence: "human", importance: 0.88 }),
  _e({ id: "e_047", source: "sk_005", target: "sk_006", relationType: "EVOLVES_INTO", confidence: "rule", importance: 0.80 }),
  _e({ id: "e_048", source: "sk_008", target: "sk_010", relationType: "EVOLVES_INTO", confidence: "auto", importance: 0.72 }),

  _e({ id: "e_049", source: "sk_005", target: "sk_007", relationType: "RELATED_TO", confidence: "human", importance: 0.93 }),
  _e({ id: "e_050", source: "sk_001", target: "sk_010", relationType: "RELATED_TO", confidence: "human", importance: 0.91 }),
  _e({ id: "e_051", source: "sk_006", target: "tl_001", relationType: "RELATED_TO", confidence: "human", importance: 0.95 }),
  _e({ id: "e_052", source: "sk_011", target: "tl_002", relationType: "RELATED_TO", confidence: "human", importance: 0.96 }),
  _e({ id: "e_053", source: "sk_015", target: "tl_003", relationType: "RELATED_TO", confidence: "human", importance: 0.94 }),
  _e({ id: "e_054", source: "sk_014", target: "tl_009", relationType: "RELATED_TO", confidence: "human", importance: 0.93 }),
  _e({ id: "e_055", source: "sk_007", target: "tl_005", relationType: "RELATED_TO", confidence: "rule", importance: 0.82 }),
  _e({ id: "e_056", source: "sk_004", target: "tl_010", relationType: "RELATED_TO", confidence: "rule", importance: 0.84 }),
  _e({ id: "e_057", source: "sk_004", target: "tl_004", relationType: "RELATED_TO", confidence: "human", importance: 0.95 }),
  _e({ id: "e_058", source: "tk_002", target: "sk_007", relationType: "RELATED_TO", confidence: "rule", importance: 0.78 }),

  _e({ id: "e_059", source: "job_001", target: "job_002", relationType: "SIMILAR_TO", confidence: "human", importance: 0.82 }),
  _e({ id: "e_060", source: "job_002", target: "job_003", relationType: "SIMILAR_TO", confidence: "rule", importance: 0.70 }),
  _e({ id: "e_061", source: "job_005", target: "job_006", relationType: "SIMILAR_TO", confidence: "rule", importance: 0.68 }),

  _e({ id: "e_062", source: "job_001", target: "cert_001", relationType: "REQUIRES", confidence: "rule", importance: 0.58, requiredLevel: "优先" }),
  _e({ id: "e_063", source: "job_002", target: "cert_002", relationType: "REQUIRES", confidence: "rule", importance: 0.66, requiredLevel: "优先" }),
  _e({ id: "e_064", source: "job_004", target: "cert_003", relationType: "REQUIRES", confidence: "auto", importance: 0.54, requiredLevel: "加分" }),
  _e({ id: "e_065", source: "job_003", target: "cert_004", relationType: "REQUIRES", confidence: "auto", importance: 0.52, requiredLevel: "加分" }),
  _e({ id: "e_066", source: "job_002", target: "cert_005", relationType: "REQUIRES", confidence: "auto", importance: 0.50, requiredLevel: "加分" }),
];

export const MOCK_GRAPH_DATA: DynamicGraphData = {
  nodes: MOCK_GRAPH_NODES,
  edges: MOCK_GRAPH_EDGES,
};

export function buildMockEvidence(nodeId: string): EvidenceRecord[] {
  const node = MOCK_GRAPH_NODES.find((n) => n.id === nodeId);
  if (!node) return [];
  const baseDate = new Date("2026-03-15");
  const platforms = ["智联招聘", "BOSS直聘", "前程无忧", "猎聘网", "拉勾网"];
  const companies = [
    "字节跳动", "阿里巴巴", "腾讯科技", "百度在线", "美团点评",
    "京东集团", "网易公司", "小米科技", "快手科技", "拼多多",
    "商汤科技", "旷视科技", "科大讯飞", "云从科技", "蚂蚁集团",
  ];
  const count = Math.min(8, Math.floor(3 + (node.demandLevel * 6)));
  const snippets = node.type === "Skill"
    ? [
        `要求熟练掌握${node.name}，有2年以上项目经验，能够独立完成复杂功能模块设计与开发。`,
        `精通${node.name}及相关技术栈，具备高并发系统设计与性能优化经验。`,
        `${node.name}基础扎实，理解底层实现原理，有开源社区贡献经历者优先。`,
        `具备${node.name}大型项目实战经验，熟悉最佳实践与常见坑点规避方案。`,
      ]
    : node.type === "JobRole"
    ? [
        `【${node.name}】负责核心AI系统的架构设计与编码实现，推动大模型在业务场景的规模化落地。`,
        `招聘${node.name}岗位，要求双一流硕士及以上学历，3年+相关工作经验，有顶会论文优先。`,
        `诚聘${node.name}，参与公司新一代智能平台的研发，深度接触前沿技术与大规模算力。`,
      ]
    : node.type === "Tool"
    ? [
        `要求熟悉${node.name}的核心原理与API使用，能完成复杂场景下的定制化开发。`,
        `具备${node.name}生产环境部署、调优与故障排查经验，熟悉集群架构。`,
        `熟练使用${node.name}进行项目开发，了解源码结构与扩展机制者优先。`,
      ]
    : [
        `${node.name}相关背景，有完整的项目生命周期管理经验与团队协作能力。`,
        `要求具备${node.name}领域的专业知识，持续学习跟进行业最新发展动态。`,
      ];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate.getTime() - i * 86400000 * (2 + Math.floor(Math.random() * 6)));
    return {
      id: `ev_${nodeId}_${i}`,
      companyName: companies[(i * 7 + 3) % companies.length],
      jobName: node.type === "Skill" || node.type === "Tool" || node.type === "Certificate"
        ? ["大模型应用工程师", "AI平台工程师", "后端开发工程师", "算法工程师", "数据开发工程师"][i % 5]
        : node.name,
      sourcePlatform: platforms[i % platforms.length],
      publishDate: d.toISOString().slice(0, 10),
      proficiency: ["精通", "熟练", "熟悉", "了解"][i % 4],
      snippet: snippets[i % snippets.length],
    };
  });
}

export function buildNodeDetail(nodeId: string): NodeDetailData | null {
  const node = MOCK_GRAPH_NODES.find((n) => n.id === nodeId);
  if (!node) return null;
  const inEdges = MOCK_GRAPH_EDGES.filter((e) => e.target === nodeId);
  const outEdges = MOCK_GRAPH_EDGES.filter((e) => e.source === nodeId);
  const neighbors = [
    ...inEdges.map((e) => {
      const nb = MOCK_GRAPH_NODES.find((n) => n.id === e.source)!;
      return { node: nb, edge: e, direction: "in" as const };
    }),
    ...outEdges.map((e) => {
      const nb = MOCK_GRAPH_NODES.find((n) => n.id === e.target)!;
      return { node: nb, edge: e, direction: "out" as const };
    }),
  ];
  const avgNeighborDemand = neighbors.length
    ? neighbors.reduce((s, { node: nb }) => s + nb.demandLevel, 0) / neighbors.length
    : 0;
  const totalDegree = neighbors.length;
  const centrality = totalDegree / MOCK_GRAPH_NODES.length;
  return {
    node,
    neighbors,
    evidence: buildMockEvidence(nodeId),
    statistics: {
      inDegree: inEdges.length,
      outDegree: outEdges.length,
      totalDegree,
      avgNeighborDemand: Number(avgNeighborDemand.toFixed(3)),
      centrality: Number(centrality.toFixed(3)),
    },
  };
}

export function searchGraph(keyword: string): { id: string; name: string; type: DynamicGraphNode["type"]; matchedAlias?: string }[] {
  if (!keyword?.trim()) return [];
  const kw = keyword.trim().toLowerCase();
  const result: { id: string; name: string; type: DynamicGraphNode["type"]; matchedAlias?: string }[] = [];
  for (const n of MOCK_GRAPH_NODES) {
    if (n.name.toLowerCase().includes(kw)) {
      result.push({ id: n.id, name: n.name, type: n.type });
    } else if (n.aliases?.some((a) => a.toLowerCase().includes(kw))) {
      const matched = n.aliases.find((a) => a.toLowerCase().includes(kw));
      result.push({ id: n.id, name: n.name, type: n.type, matchedAlias: matched });
    } else if (n.category?.toLowerCase().includes(kw)) {
      result.push({ id: n.id, name: n.name, type: n.type, matchedAlias: `分类:${n.category}` });
    }
  }
  return result.slice(0, 20);
}

export function findShortestPath(sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    return { found: true, path: [{ nodeId: sourceId }], hops: 0, totalImportance: 1 };
  }
  const adj = new Map<string, { edgeId: string; nodeId: string; importance: number }[]>();
  for (const e of MOCK_GRAPH_EDGES) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ edgeId: e.id, nodeId: e.target, importance: e.importance });
  }
  const prev = new Map<string, { nodeId: string; edgeId: string } | null>();
  const dist = new Map<string, number>();
  prev.set(sourceId, null);
  dist.set(sourceId, 0);
  const queue: { nodeId: string; cost: number }[] = [{ nodeId: sourceId, cost: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.nodeId === targetId) break;
    if (cur.cost > (dist.get(cur.nodeId) ?? Infinity)) continue;
    for (const nb of adj.get(cur.nodeId) ?? []) {
      const newCost = cur.cost + (1 / Math.max(0.1, nb.importance));
      if (newCost < (dist.get(nb.nodeId) ?? Infinity)) {
        dist.set(nb.nodeId, newCost);
        prev.set(nb.nodeId, { nodeId: cur.nodeId, edgeId: nb.edgeId });
        queue.push({ nodeId: nb.nodeId, cost: newCost });
      }
    }
  }
  if (!prev.has(targetId)) return { found: false, path: [], hops: -1, totalImportance: 0 };
  const revPath: { nodeId: string; edgeId?: string }[] = [];
  let cur: string | undefined = targetId;
  while (cur) {
    const p = prev.get(cur);
    const nextNodeId = p?.nodeId;
    revPath.push(p ? { nodeId: cur, edgeId: p.edgeId } : { nodeId: cur });
    cur = nextNodeId;
  }
  const path = revPath.reverse();
  const totalImp = path.slice(1).reduce((s, step) => {
    const e = MOCK_GRAPH_EDGES.find((x) => x.id === step.edgeId);
    return s + (e?.importance ?? 0);
  }, 0);
  return { found: true, path, hops: path.length - 1, totalImportance: Number(totalImp.toFixed(3)) };
}
