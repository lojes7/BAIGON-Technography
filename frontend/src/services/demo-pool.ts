// 演示数据池：真实 API 返回数据不足（total < 100）时，在内存中拼接补足到 120 条。
// 字段格式与真实数据完全一致（含 2026-08~09 真实时间线），页面无感知；
// 仅在本模块登记演示 ID（Map 精确匹配，绝不误伤真实雪花 ID），供详情 / 溯源 / 审核兜底。
import type {
  PaginatedData, JobData, JobDetail, MajorCatalogItem, OccupationCatalogItem, JobSkillData,
  ListJobsParams, DataSourceItem, DataSourceDetail, SourceJobDetail,
  DataSourceListParams, JobMatchResult, SkillLearningSuggestion,
} from "../types/api";

export const DEMO_TARGET = 120;
export const DEMO_REAL_THRESHOLD = 100;

/* ═══════════════ 基础语料（确定性轮转，无随机数 → 刷新后分页顺序稳定） ═══════════════ */

const CITIES: ReadonlyArray<readonly [string, string]> = [
  ["北京", "北京市"], ["上海", "上海市"], ["广州", "广东省"], ["深圳", "广东省"],
  ["杭州", "浙江省"], ["成都", "四川省"], ["武汉", "湖北省"],
];
const DISTRICTS: Record<string, string[]> = {
  北京: ["海淀区", "朝阳区", "大兴区"], 上海: ["浦东新区", "徐汇区", "闵行区"],
  广州: ["天河区", "海珠区", "黄埔区"], 深圳: ["南山区", "福田区", "龙岗区"],
  杭州: ["西湖区", "滨江区", "余杭区"], 成都: ["高新区", "武侯区", "天府新区"],
  武汉: ["洪山区", "东湖高新区", "江汉区"],
};

const COMPANIES = [
  "华为技术有限公司", "阿里巴巴（中国）有限公司", "腾讯科技（深圳）有限公司", "字节跳动",
  "美团", "京东集团", "网易（杭州）网络有限公司", "百度在线网络技术（北京）有限公司",
  "小米科技", "拼多多", "快手", "滴滴出行", "蚂蚁集团", "小红书", "哔哩哔哩",
  "科大讯飞", "商汤科技", "海康威视", "大疆创新", "宁德时代新能源科技股份有限公司",
  "比亚迪", "蔚来汽车", "理想汽车", "小鹏汽车", "中兴通讯", "顺丰科技",
  "平安科技", "招商银行信用卡中心", "中国电信天翼云", "咪咕文化科技",
  "米哈游", "莉莉丝游戏", "同程旅行", "携程集团", "唯品会", "货拉拉",
];

const SIZES = ["100-499人", "500-999人", "1000-9999人", "10000人以上"];
const EDU = ["本科", "本科", "大专", "硕士", "不限"];
const EXP = ["1-3年", "3-5年", "3-5年", "5-10年", "应届生", "经验不限"];
const TAGS = ["五险一金", "带薪年假", "节日福利", "弹性工作", "年度体检", "股票期权", "免费班车", "下午茶", "定期团建", "住房补贴"];
const REVIEWERS = ["admin", "zhangwei", "reviewer01"];

const pick = <T,>(arr: readonly T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length];

/* ═══════════════ 专业 / 职业语料 ═══════════════ */

const MAJOR_DEFS: ReadonlyArray<readonly [string, string, string]> = [ // [名称, 专业代码, 门类]
  ["计算机科学与技术", "080901", "08"], ["软件工程", "080902", "08"], ["网络工程", "080903", "08"],
  ["人工智能", "080717T", "08"], ["数据科学与大数据技术", "080910T", "08"], ["统计学", "071201", "07"],
  ["数学与应用数学", "070101", "07"], ["信息管理与信息系统", "120102", "12"], ["电子商务", "120801", "12"],
  ["数字媒体技术", "080906", "08"], ["视觉传达设计", "130502", "13"], ["工业设计", "080205", "08"],
  ["动画", "130310", "13"], ["通信工程", "080703", "08"], ["自动化", "080801", "08"],
];

const MAJORS: MajorCatalogItem[] = MAJOR_DEFS.map(([name, code, cat], i) => ({
  id: String(7700000000000000000n + BigInt(i)),
  code, name, majorCategoryId: cat, isEmbed: true,
}));
const MAJOR_BY_NAME = new Map(MAJORS.map(m => [m.name, m]));

interface OccupationDef { code: string; name: string; description: string }
const OCCUPATIONS: Record<string, OccupationDef> = {
  frontend: { code: "2-02-10", name: "软件工程技术人员", description: "从事软件需求分析、设计、编码、测试与维护的工程技术人员，覆盖前端、后端与全栈方向。" },
  backend: { code: "2-02-10", name: "软件工程技术人员", description: "从事软件需求分析、设计、编码、测试与维护的工程技术人员，覆盖前端、后端与全栈方向。" },
  algorithm: { code: "2-02-07", name: "人工智能工程技术人员", description: "从事人工智能算法研发、模型训练、系统集成与应用部署的专业技术人员。" },
  data: { code: "2-02-08", name: "大数据工程技术人员", description: "从事大数据采集、清洗、存储、分析、可视化及平台架构设计的工程技术人员。" },
  test: { code: "2-02-11", name: "软件质量与测试工程技术人员", description: "从事软件质量保障、测试方案设计、自动化测试与缺陷分析的工程技术人员。" },
  ops: { code: "2-02-12", name: "计算机网络工程技术人员", description: "从事计算机网络规划、部署、运维保障与云平台管理的工程技术人员。" },
  product: { code: "2-06-02", name: "信息管理工程技术人员", description: "从事产品规划、需求分析、项目管理与信息化方案设计的专业人员。" },
  design: { code: "2-12-04", name: "艺术设计专业人员", description: "从事视觉传达、交互体验与数字媒体设计的专业人员。" },
};
const OCCUPATION_DATA: Record<string, OccupationCatalogItem> = Object.fromEntries(
  Object.entries(OCCUPATIONS).map(([k, o], i) => [k, {
    id: String(7800000000000000000n + BigInt(i)), isEmbed: true,
    code: o.code, name: o.name, occupationCategoryId: "2", description: o.description,
  }]),
);

/** 按公开目录 lookup 契约解析演示专业，供岗位详情继续使用 ID 引用。 */
export function lookupDemoMajors(ids: Array<string | number>): MajorCatalogItem[] {
  const requested = new Set(ids.map(String));
  return MAJORS.filter((major) => requested.has(major.id));
}

/** 按公开目录 lookup 契约解析演示职业，避免把演示 ID 发送到真实后端。 */
export function lookupDemoOccupations(ids: Array<string | number>): OccupationCatalogItem[] {
  const requested = new Set(ids.map(String));
  return Object.values(OCCUPATION_DATA).filter((occupation) => requested.has(occupation.id));
}

/* ═══════════════ 8 大方向 × 15 变体岗位画像 ═══════════════ */

type Prof = "EXPERT" | "ADVANCED" | "FAMILIAR" | "BASIC";
interface SkillSpec { name: string; proficiency: Prof; requirement: string }
interface DirectionProfile {
  titles: string[];
  majors: string[];
  salary: [number, number];
  skills: SkillSpec[];
  duties: string[];
  demands: string[];
  bonus: string;
}

const PROFILES: Record<string, DirectionProfile> = {
  frontend: {
    titles: ["前端开发工程师", "Web前端开发工程师", "高级前端开发工程师", "资深前端工程师", "前端架构师", "React开发工程师", "Vue开发工程师", "小程序开发工程师", "H5开发工程师", "大屏可视化开发工程师", "Node.js开发工程师", "全栈开发工程师", "跨端开发工程师", "前端技术专家", "前端开发实习生"],
    majors: ["软件工程", "计算机科学与技术", "网络工程", "数字媒体技术"],
    salary: [16, 30],
    skills: [
      { name: "React", proficiency: "EXPERT", requirement: "精通 React 及其生态，具备大型单页应用的架构与性能调优经验" },
      { name: "TypeScript", proficiency: "ADVANCED", requirement: "熟练使用 TypeScript 进行大型前端项目的类型化开发" },
      { name: "Vue", proficiency: "ADVANCED", requirement: "熟练掌握 Vue3 组合式 API，理解其响应式实现原理" },
      { name: "CSS3", proficiency: "ADVANCED", requirement: "对 CSS 布局与动画有深入理解，能高保真还原设计稿" },
      { name: "Webpack", proficiency: "FAMILIAR", requirement: "熟悉 Webpack/Vite 构建优化，能独立完成工程化配置" },
      { name: "Node.js", proficiency: "FAMILIAR", requirement: "熟悉 Node.js 服务端开发，能搭建 BFF 中间层" },
      { name: "前端性能优化", proficiency: "BASIC", requirement: "了解首屏加载、长列表渲染等常见性能优化手段" },
    ],
    duties: ["负责公司核心业务前端页面的开发与维护，保证多端体验一致性", "与产品、设计、后端协作，高质量还原交互稿并按期交付", "参与前端工程化建设，沉淀通用组件与最佳实践"],
    demands: ["本科及以上学历，计算机相关专业，2 年以上前端开发经验", "具备扎实的 HTML/CSS/JavaScript 基础与良好的编码习惯", "有良好的沟通协作能力与责任心，能独立推进任务落地"],
    bonus: "有开源项目、技术博客或 Github 高星项目者优先",
  },
  backend: {
    titles: ["Java开发工程师", "Java高级开发工程师", "资深Java工程师", "Go开发工程师", "Python开发工程师", "后端架构师", "微服务开发工程师", "服务端开发工程师", "C++开发工程师", "中间件开发工程师", "分布式系统工程师", "PHP开发工程师", ".NET开发工程师", "后端技术专家", "后端开发实习生"],
    majors: ["软件工程", "计算机科学与技术", "通信工程", "自动化"],
    salary: [18, 34],
    skills: [
      { name: "Java", proficiency: "EXPERT", requirement: "精通 Java 基础与 JVM 原理，具备扎实的编码功底" },
      { name: "Spring Boot", proficiency: "EXPERT", requirement: "精通 Spring Boot/Spring Cloud 微服务开发" },
      { name: "MySQL", proficiency: "ADVANCED", requirement: "熟练掌握 MySQL 索引优化与事务隔离机制" },
      { name: "Redis", proficiency: "ADVANCED", requirement: "熟练使用 Redis 缓存方案，理解缓存穿透/雪崩等问题" },
      { name: "微服务架构", proficiency: "ADVANCED", requirement: "熟练掌握服务拆分、限流熔断等微服务治理方案" },
      { name: "Kafka", proficiency: "FAMILIAR", requirement: "熟悉 Kafka 消息队列的使用与常见调优手段" },
      { name: "Docker", proficiency: "FAMILIAR", requirement: "熟悉 Docker 容器化部署与镜像构建流程" },
    ],
    duties: ["负责核心业务服务端的设计、开发与迭代，保障系统稳定性", "参与系统架构评审，持续优化接口性能与存储模型", "编写单元测试与接口文档，参与代码评审与技术分享"],
    demands: ["本科及以上学历，计算机相关专业，3 年以上服务端开发经验", "深入理解常用数据结构与算法，具备高并发场景处理经验", "有良好的沟通协作能力与责任心，能承受一定工作压力"],
    bonus: "有大型分布式系统、中间件或开源社区贡献经验者优先",
  },
  algorithm: {
    titles: ["算法工程师", "机器学习工程师", "深度学习工程师", "NLP算法工程师", "计算机视觉工程师", "推荐算法工程师", "搜索算法工程师", "大模型算法工程师", "AIGC算法工程师", "风控算法工程师", "数据挖掘工程师", "语音识别工程师", "多模态算法工程师", "图像算法工程师", "算法实习生"],
    majors: ["人工智能", "计算机科学与技术", "数学与应用数学", "自动化"],
    salary: [25, 45],
    skills: [
      { name: "Python", proficiency: "EXPERT", requirement: "精通 Python，具备规范的工程化编码能力" },
      { name: "PyTorch", proficiency: "EXPERT", requirement: "精通 PyTorch 深度学习框架，有模型训练与调优实战经验" },
      { name: "机器学习", proficiency: "EXPERT", requirement: "精通常见机器学习算法及其工业界落地实践" },
      { name: "深度学习", proficiency: "ADVANCED", requirement: "熟练掌握 Transformer/CNN 等主流网络结构" },
      { name: "大语言模型", proficiency: "ADVANCED", requirement: "熟悉大模型微调（SFT/LoRA）与推理部署流程" },
      { name: "SQL", proficiency: "FAMILIAR", requirement: "熟悉 SQL，能独立完成特征数据的提取与加工" },
      { name: "CUDA编程", proficiency: "BASIC", requirement: "了解 GPU 编程模型，有算子优化经验者优先" },
    ],
    duties: ["负责业务算法模型的训练、评估与上线，持续提升核心指标", "跟进学界与工业界前沿算法，完成技术选型与工程化落地", "与工程团队协作完成模型服务的部署、监控与迭代"],
    demands: ["硕士及以上学历，计算机/数学相关专业，2 年以上算法落地经验", "扎实的机器学习/深度学习理论基础与优秀的数据敏感度", "能独立完成从数据构建到模型上线的完整闭环"],
    bonus: "在 NeurIPS/ICML/CVPR 等顶会发表过论文者优先",
  },
  data: {
    titles: ["数据分析师", "高级数据分析师", "数据开发工程师", "大数据开发工程师", "数据仓库工程师", "ETL工程师", "数据治理工程师", "商业分析师", "BI工程师", "用户增长分析师", "数据运营专员", "数据科学工程师", "埋点数据分析师", "数据产品经理", "数据实习生"],
    majors: ["数据科学与大数据技术", "统计学", "计算机科学与技术", "信息管理与信息系统"],
    salary: [14, 28],
    skills: [
      { name: "SQL", proficiency: "EXPERT", requirement: "精通 SQL，能编写复杂查询并完成性能优化" },
      { name: "Python", proficiency: "ADVANCED", requirement: "熟练使用 Python 进行数据处理与分析建模" },
      { name: "Hive", proficiency: "ADVANCED", requirement: "熟练掌握 Hive 数仓开发与分区/索引优化" },
      { name: "数据仓库", proficiency: "ADVANCED", requirement: "熟悉维度建模方法论，有大型数仓分层建设经验" },
      { name: "Spark", proficiency: "FAMILIAR", requirement: "熟悉 Spark 原理，有离线/实时任务开发经验" },
      { name: "BI可视化", proficiency: "FAMILIAR", requirement: "熟悉 Tableau/Superset 等 BI 工具的看板搭建" },
      { name: "Flink", proficiency: "BASIC", requirement: "了解 Flink 实时计算框架，有实时数仓经验者优先" },
    ],
    duties: ["负责业务数据体系的开发与维护，保障数据准确性与时效性", "搭建并优化数据仓库分层模型，支撑报表与分析需求", "深入业务场景完成专题分析，输出可执行的策略建议"],
    demands: ["本科及以上学历，统计/计算机相关专业，2 年以上数据领域经验", "对数据敏感，具备优秀的业务理解与跨团队沟通能力", "能独立完成从数据采集、加工到分析报告的完整链路"],
    bonus: "有电商/金融/本地生活等大型业务数仓经验者优先",
  },
  test: {
    titles: ["测试工程师", "高级测试工程师", "自动化测试工程师", "测试开发工程师", "性能测试工程师", "功能测试工程师", "接口测试工程师", "安全测试工程师", "移动端测试工程师", "游戏测试工程师", "QA工程师", "质量保障工程师", "测试组长", "测试经理", "测试实习生"],
    majors: ["软件工程", "计算机科学与技术", "自动化"],
    salary: [12, 24],
    skills: [
      { name: "自动化测试", proficiency: "EXPERT", requirement: "精通 Selenium/Playwright 自动化框架与 PO 模式设计" },
      { name: "接口测试", proficiency: "EXPERT", requirement: "精通 Postman/JMeter 接口测试与断言设计" },
      { name: "Java", proficiency: "ADVANCED", requirement: "熟练使用 Java 编写测试脚本与测试工具" },
      { name: "Python", proficiency: "ADVANCED", requirement: "熟练使用 Python 进行测试脚本与数据构造" },
      { name: "性能测试", proficiency: "ADVANCED", requirement: "熟练掌握 JMeter 压测方案与性能瓶颈定位" },
      { name: "测试用例设计", proficiency: "ADVANCED", requirement: "熟练运用等价类/边界值/场景法设计高质量用例" },
      { name: "CI/CD", proficiency: "FAMILIAR", requirement: "熟悉 Jenkins/GitLab CI 持续集成流水线" },
    ],
    duties: ["负责产品功能测试与版本质量保障，跟踪缺陷闭环", "建设并维护自动化测试体系，提升回归测试效率", "参与需求评审与方案设计，提前识别质量风险"],
    demands: ["本科及以上学历，计算机相关专业，2 年以上测试经验", "熟悉软件测试理论与主流测试工具，具备脚本开发能力", "工作细致耐心，具备良好的风险意识与推动能力"],
    bonus: "有大型项目性能/安全测试经验或测试平台建设经验者优先",
  },
  ops: {
    titles: ["运维工程师", "高级运维工程师", "DevOps工程师", "SRE工程师", "云计算工程师", "网络工程师", "系统运维工程师", "数据库管理员（DBA）", "Kubernetes工程师", "容器云工程师", "IT运维专员", "系统管理员", "安全运维工程师", "运维架构师", "运维实习生"],
    majors: ["网络工程", "计算机科学与技术", "通信工程"],
    salary: [13, 26],
    skills: [
      { name: "Linux", proficiency: "EXPERT", requirement: "精通 Linux 系统管理与性能排查，熟悉内核参数调优" },
      { name: "Kubernetes", proficiency: "EXPERT", requirement: "精通 K8s 集群部署、调度与故障排查" },
      { name: "Docker", proficiency: "ADVANCED", requirement: "熟练掌握 Docker 镜像构建与容器网络" },
      { name: "Shell", proficiency: "ADVANCED", requirement: "熟练使用 Shell/Python 编写自动化运维脚本" },
      { name: "Prometheus", proficiency: "ADVANCED", requirement: "熟练搭建 Prometheus+Grafana 监控告警体系" },
      { name: "Ansible", proficiency: "FAMILIAR", requirement: "熟悉 Ansible 批量配置管理与发布编排" },
      { name: "云平台运维", proficiency: "FAMILIAR", requirement: "熟悉阿里云/AWS 核心产品的运维与成本优化" },
    ],
    duties: ["负责线上服务的部署、监控与应急响应，保障 SLA 达标", "建设自动化运维工具链，持续提升发布与扩缩容效率", "完善监控告警与容量规划体系，推动成本优化"],
    demands: ["本科及以上学历，计算机相关专业，3 年以上运维经验", "熟悉主流云平台与容器化技术栈，具备故障应急处理能力", "有强烈的稳定性意识与责任心，能参与 7x24 值班轮岗"],
    bonus: "持有 CKA/ACP 等云与容器认证者优先",
  },
  product: {
    titles: ["产品经理", "高级产品经理", "AI产品经理", "B端产品经理", "C端产品经理", "策略产品经理", "增长产品经理", "数据产品经理", "硬件产品经理", "解决方案经理", "产品运营专员", "用户研究员", "需求分析师", "产品总监", "产品实习生"],
    majors: ["信息管理与信息系统", "电子商务", "计算机科学与技术"],
    salary: [15, 30],
    skills: [
      { name: "需求分析", proficiency: "EXPERT", requirement: "精通需求收集、分析与 PRD 文档撰写" },
      { name: "竞品分析", proficiency: "ADVANCED", requirement: "熟练开展竞品调研并输出可落地的差异化方案" },
      { name: "用户研究", proficiency: "ADVANCED", requirement: "熟练运用用户访谈、问卷与数据分析进行需求验证" },
      { name: "Axure", proficiency: "FAMILIAR", requirement: "熟悉 Axure/Figma 原型设计工具" },
      { name: "数据分析", proficiency: "FAMILIAR", requirement: "熟悉 A/B 测试与核心指标体系的设计方法" },
      { name: "项目管理", proficiency: "FAMILIAR", requirement: "熟悉敏捷开发流程，能协调多角色推进版本落地" },
    ],
    duties: ["负责产品线的需求调研、规划与版本节奏管理", "撰写高质量 PRD 与原型，协同研发、设计推动落地", "跟踪上线效果与核心指标，持续迭代优化产品方案"],
    demands: ["本科及以上学历，3 年以上互联网产品经验", "具备优秀的逻辑思维与文档表达能力", "有强烈的用户视角与数据驱动的产品方法论"],
    bonus: "有 AI/数据/平台类产品从 0 到 1 经验者优先",
  },
  design: {
    titles: ["UI设计师", "高级UI设计师", "UX设计师", "交互设计师", "视觉设计师", "平面设计师", "品牌设计师", "动效设计师", "3D设计师", "游戏UI设计师", "全链路设计师", "插画设计师", "包装设计师", "设计经理", "设计实习生"],
    majors: ["数字媒体技术", "视觉传达设计", "工业设计", "动画"],
    salary: [11, 24],
    skills: [
      { name: "Figma", proficiency: "EXPERT", requirement: "精通 Figma 设计交付与组件库搭建" },
      { name: "视觉设计", proficiency: "EXPERT", requirement: "精通版式/配色/栅格系统，具备优秀的审美能力" },
      { name: "交互设计", proficiency: "ADVANCED", requirement: "熟练运用交互设计方法，能独立完成复杂流程设计" },
      { name: "设计系统", proficiency: "ADVANCED", requirement: "有设计系统（Design Token）建设与推动落地经验" },
      { name: "Sketch", proficiency: "FAMILIAR", requirement: "熟悉 Sketch 设计稿的整理与标注规范" },
      { name: "AE动效", proficiency: "BASIC", requirement: "了解 After Effects 动效设计，能输出可实现的动效参数" },
    ],
    duties: ["负责产品界面与视觉风格的定义与持续打磨", "参与需求讨论，输出高保真界面稿与交互说明", "维护设计规范与组件库，保障多产品体验一致性"],
    demands: ["本科及以上学历，设计相关专业，2 年以上 UI/UX 经验", "具备扎实的视觉表现力与优秀的作品集", "熟悉产品设计全流程，能与研发高效协作"],
    bonus: "有 B 端中后台或数据可视化产品设计经验者优先",
  },
};

/* ═══════════════ 时间线：按 5 个导入批次脉冲式入库（与「最近注入批次」表严格同源） ═══════════════ */

const DAY_MS = 86400000;
const pad2 = (n: number) => String(n).padStart(2, "0");
function fmt(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

// 批次口径与数据导入页 recentBatches 完全一致：批次日 = 趋势图主峰，样本数 = 各日柱高之和。
// 每个批次的样本按 spread（[距批次日的天数, 条数]）散落到批次日前后几天，
// 形成"主峰 + 次峰 + 零星散柱"的真实导入节奏；全月合计恒等于 120（与样本总量同源）。
const INGEST_BATCHES = [
  { baseMs: Date.UTC(2026, 7, 1, 11, 20), platform: "CSV 注入", count: 46, spread: [[0, 20], [1, 12], [2, 8], [3, 4], [5, 2]] },
  { baseMs: Date.UTC(2026, 7, 9, 21, 47), platform: "智联招聘", count: 38, spread: [[0, 16], [1, 11], [2, 6], [4, 3], [6, 2]] },
  { baseMs: Date.UTC(2026, 7, 16, 10, 5), platform: "BOSS直聘", count: 22, spread: [[0, 9], [1, 6], [2, 4], [4, 3]] },
  { baseMs: Date.UTC(2026, 7, 24, 14, 32), platform: "CSV 注入", count: 10, spread: [[0, 4], [1, 3], [3, 2], [5, 1]] },
  { baseMs: Date.UTC(2026, 8, 1, 9, 26), platform: "前程无忧", count: 4, spread: [[0, 4]] },
] as const;
const BATCH_START: number[] = [];
{
  let acc = 0;
  for (const b of INGEST_BATCHES) { BATCH_START.push(acc); acc += b.count; }
}
const batchOf = (i: number) => INGEST_BATCHES[BATCH_START.findLastIndex((start) => start <= i)];
// 每条样本距离所属批次日的天数（按 spread 顺序铺满 120 条）
const ITEM_DAY_OFFSET: number[] = [];
for (const b of INGEST_BATCHES) {
  for (const [off, n] of b.spread) {
    for (let k = 0; k < n; k++) ITEM_DAY_OFFSET.push(off);
  }
}

function sourceUrlOf(platform: string, tail: string): string {
  switch (platform) {
    case "BOSS直聘": return `https://www.zhipin.com/job_detail/${tail}.html`;
    case "前程无忧": return `https://jobs.51job.com/all/${tail}.html`;
    case "猎聘": return `https://www.liepin.com/job/${tail}.shtml`;
    case "拉勾网": return `https://www.lagou.com/jobs/${tail}.html`;
    default: return `https://www.zhaopin.com/job/${tail}`;
  }
}

function buildDescription(p: DirectionProfile, i: number, salary: string, tags: string): string {
  const d1 = pick(p.duties, i); const d2 = pick(p.duties, i + 1); const d3 = pick(p.duties, i + 2);
  const r1 = pick(p.demands, i); const r2 = pick(p.demands, i + 1); const r3 = pick(p.demands, i + 2);
  return `【岗位职责】\n1、${d1}；\n2、${d2}；\n3、${d3}。\n【任职要求】\n1、${r1}；\n2、${r2}；\n3、${r3}；\n4、${p.bonus}。\n【薪资福利】\n${salary}｜${tags}`;
}

/* ═══════════════ 生成 120 条岗位（8 方向交错排布，页面分布自然） ═══════════════ */

const DIR_KEYS = ["frontend", "backend", "algorithm", "data", "test", "ops", "product", "design"] as const;
type DirKey = (typeof DIR_KEYS)[number];

function demoJobSkillId(jobIndex: number, skillIndex: number): string {
  return String(7900000000000000000n + BigInt(jobIndex * 16 + skillIndex));
}

export const DEMO_JOBS: JobData[] = Array.from({ length: DEMO_TARGET }, (_, i) => {
  const dir = DIR_KEYS[i % 8] as DirKey;
  const p = PROFILES[dir];
  const v = Math.floor(i / 8); // 方向内变体序号 0-14
  const name = p.titles[v];
  const isIntern = name.includes("实习");

  const [city, province] = pick(CITIES, i * 3 + v);
  const companyName = pick(COMPANIES, i * 5 + 3);
  const batch = batchOf(i);
  const platform = batch.platform; // 平台 = 所属批次采集渠道（与批次表/平台占比同源）
  const major = pick(p.majors, i + v);

  let salary: string;
  if (isIntern) salary = `${180 + (i % 4) * 10}-${280 + (i % 3) * 10}元/天`;
  else {
    const lo = p.salary[0] + (v % 4) * 3;
    const hi = lo + 8 + (v % 3) * 4;
    salary = `${lo}-${hi}K·${13 + (v % 4)}薪`;
  }

  const tags = [pick(TAGS, i), pick(TAGS, i + 3), pick(TAGS, i + 6), pick(TAGS, i + 9)].join(",");
  // 入库时间：批次日 + spread 天偏移 + 批内 3 分钟步进（+秒级抖动）
  const createdMs = batch.baseMs
    + ITEM_DAY_OFFSET[i] * DAY_MS
    + (i - BATCH_START[INGEST_BATCHES.indexOf(batch)]) * 3 * 60000
    + (i * 17 % 55) * 1000;
  const publishMs = createdMs - (2 + (i * 5) % 21) * 3600000;
  const id = String(7500000000000000000n + BigInt(i));

  return {
    id,
    name,
    occupationId: OCCUPATION_DATA[dir].id,
    majorId: MAJOR_BY_NAME.get(major)?.id ?? null,
    jobSkillIds: p.skills.map((_, skillIndex) => demoJobSkillId(i, skillIndex)),
    publishDate: fmt(publishMs),
    sourcePlatform: platform,
    sourceUrl: sourceUrlOf(platform, id.slice(-8)),
    city,
    tags,
    major,
    nature: isIntern ? "实习" : "全职",
    salary,
    companyName,
    companySize: pick(SIZES, i * 3 + v),
    province,
    education: isIntern ? "本科" : pick(EDU, i + v),
    experience: isIntern ? "应届生" : pick(EXP, i + v),
    jobDescription: buildDescription(p, i + v, salary, tags),
    createdAt: fmt(createdMs),
    updatedAt: fmt(createdMs),
  } satisfies JobData;
});

export const demoJobById = new Map(DEMO_JOBS.map(j => [j.id, j]));

/* ═══════════════ 派生：清洗后数据源 / 原始记录（带真实差异，供溯源 diff 演示） ═══════════════ */

interface DemoSource { item: DataSourceItem; detail: DataSourceDetail; source: SourceJobDetail }

function rawSalaryOf(salary: string): string {
  const m = salary.match(/^(\d+)-(\d+)K/);
  if (!m) return salary.replace("元/天", "/天");
  return `${(Number(m[1]) / 10).toFixed(1)}万-${(Number(m[2]) / 10).toFixed(1)}万/月`;
}
function rawDescriptionOf(desc: string, company: string): string {
  return `公司简介：${company}诚邀有志之士加入，与我们共同成长！\r\n\r\n${desc.replace(/\n/g, "\r\n")}\r\n\r\n简历投递：hr-recruit@company.com（邮件标题请注明应聘岗位与姓名）`;
}

export const DEMO_SOURCES: DemoSource[] = DEMO_JOBS.map((j, i) => {
  const dsId = String(7600000000000000000n + BigInt(i));
  const reviewRoll = (i * 7 + 3) % 10;
  const reviewStatus = reviewRoll < 6 ? "PASSED" : reviewRoll < 9 ? "PENDING" : "REJECTED";
  const createdMs = Date.parse(j.createdAt.replace(" ", "T") + "Z");
  // 复核时间不越过「今天」（2026-09-01 20:00），避免详情页出现未来时间戳
  const reviewedMs = Math.min(
    createdMs + (2 + (i * 11) % 25) * 3600000,
    Date.UTC(2026, 8, 1, 20, 0),
  );

  const item: DataSourceItem = {
    id: dsId,
    jobName: j.name,
    companyName: j.companyName,
    sourcePlatform: j.sourcePlatform,
    publishDate: j.publishDate,
    createdAt: j.createdAt,
    reviewStatus,
  };

  const detail: DataSourceDetail = {
    id: dsId,
    publishDate: j.publishDate,
    sourcePlatform: j.sourcePlatform,
    sourceUrl: j.sourceUrl,
    city: j.city,
    tags: j.tags,
    major: j.major,
    nature: j.nature,
    salary: j.salary,
    jobName: j.name,
    companyName: j.companyName,
    companySize: j.companySize,
    province: j.province,
    education: j.education,
    experience: j.experience,
    jobDescription: j.jobDescription,
    reviewStatus,
    reviewedAt: reviewStatus === "PENDING" ? null : fmt(reviewedMs),
    reviewedBy: reviewStatus === "PENDING" ? null : pick(REVIEWERS, i),
    createdAt: j.createdAt,
  };

  const [district] = [pick(DISTRICTS[j.city] ?? ["中心城区"], i)];
  const source: SourceJobDetail = {
    id: `src-${dsId.slice(-10)}`,
    publishDate: j.publishDate.slice(0, 10),
    sourcePlatform: j.sourcePlatform,
    sourceUrl: j.sourceUrl,
    city: `${j.city}·${district}`,
    tags: (j.tags ?? "").split(",").join(" 、 "),
    major: "计算机相关专业",
    nature: j.nature,
    salary: rawSalaryOf(j.salary),
    jobName: j.name,
    companyName: j.companyName,
    companySize: j.companySize,
    province: "",
    education: j.education === "不限" ? "" : `${j.education}及以上`,
    experience: j.experience === "经验不限" ? "" : `${j.experience}经验`,
    jobDescription: rawDescriptionOf(j.jobDescription, j.companyName),
  };

  return { item, detail, source };
});

export const demoSourceById = new Map(DEMO_SOURCES.map(s => [s.item.id, s]));

/* ═══════════════ 列表补足：内存过滤 + 分页拼接 ═══════════════ */

// 与后端一致的"文本字段包含匹配"（majorId/occupationId 精确匹配）
export function filterDemoJobs(params?: ListJobsParams): JobData[] {
  const kw = (v?: string) => (v ?? "").trim();
  const name = kw(params?.name);
  const company = kw(params?.company);
  const city = kw(params?.city);
  const province = kw(params?.province);
  const salary = kw(params?.salary);
  const education = kw(params?.education);
  const nature = kw(params?.nature);
  const companySize = kw(params?.companySize);
  const major = kw(params?.major);
  const majorId = params?.majorId != null && params.majorId !== "" ? String(params.majorId) : "";
  const occupationId = params?.occupationId != null && params.occupationId !== "" ? String(params.occupationId) : "";
  return DEMO_JOBS.filter(j =>
    (!name || j.name.includes(name)) &&
    (!company || j.companyName.includes(company)) &&
    (!city || j.city.includes(city)) &&
    (!province || j.province.includes(province)) &&
    (!salary || j.salary.includes(salary)) &&
    (!education || j.education.includes(education)) &&
    (!nature || j.nature.includes(nature)) &&
    (!companySize || j.companySize.includes(companySize)) &&
    (!major || j.major.includes(major)) &&
    (!majorId || String(j.majorId ?? "") === majorId) &&
    (!occupationId || String(j.occupationId ?? "") === occupationId));
}

// 数据源列表过滤：兼容 UI 的 PENDING/PASSED/REJECTED 与后端的 REVIEW_* 状态值
function statusMatch(filter: string, status: string): boolean {
  if (filter === status) return true;
  if (filter === "REVIEW_PASSED") return status === "PASSED";
  if (filter === "REVIEW_REJECT") return status === "REJECTED";
  return false;
}

export function filterDemoSources(params?: DataSourceListParams): DataSourceItem[] {
  const status = (params?.reviewStatus ?? "").trim();
  const from = (params?.publishDateFrom ?? "").trim();
  const to = (params?.publishDateTo ?? "").trim();
  return DEMO_SOURCES.filter(({ item }) => {
    if (status && !statusMatch(status, item.reviewStatus)) return false;
    const day = item.publishDate.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }).map(({ item }) => item);
}

// 拼接策略：真实数据占 [0, realTotal)，演示数据占 [realTotal, realTotal+need)，按页切片。
// 演示池全量补位（total = 真实 + 120），与 live-stats 的动态 KPI 口径保持一致；
// 真实数据达到 DEMO_REAL_THRESHOLD 时视为真实环境，不再拼接演示数据。
export function mergeDemoPage<T>(
  real: PaginatedData<T> | null,
  demoFiltered: T[],
  page: number,
  pageSize: number,
): PaginatedData<T> {
  const realItems = real?.items ?? [];
  const realTotal = real?.total ?? 0;
  if (realTotal >= DEMO_REAL_THRESHOLD) {
    return { items: realItems, total: realTotal, page, pageSize };
  }
  const need = demoFiltered.length;
  const start = Math.max(0, Math.min(page * pageSize - realTotal, need));
  const end = Math.max(0, Math.min((page + 1) * pageSize - realTotal, need));
  return {
    items: [...realItems, ...demoFiltered.slice(start, end)],
    total: realTotal + need,
    page,
    pageSize,
  };
}

/* ═══════════════ 详情兜底：岗位详情 / 人岗匹配 ═══════════════ */

export function isDemoJobId(id: string | number): boolean {
  return demoJobById.has(String(id));
}

export function buildDemoJobSkills(job: JobData): JobSkillData[] {
  const dir = DIR_KEYS.find(k => PROFILES[k].titles.includes(job.name)) ?? "frontend";
  const p = PROFILES[dir];
  const jobIdx = DEMO_JOBS.findIndex(x => x.id === job.id);
  return p.skills.map((s, si) => ({
    id: demoJobSkillId(jobIdx, si),
    jobId: job.id,
    // 少量技能保留"待归一"状态，更贴近真实数据分布
    skillId: (jobIdx % 7 === 3 && si === p.skills.length - 1)
      ? null
      : String(8000000000000000000n + BigInt(MAJOR_DEFS.length + Object.keys(PROFILES).length * 8 + jobIdx * 16 + si)),
    skillName: s.name,
    skillProficiency: s.proficiency,
    evidence: s.requirement,
  }));
}

export function lookupDemoJobSkills(ids: Array<string | number>): JobSkillData[] {
  const requested = new Set(ids.map(String));
  return DEMO_JOBS.flatMap(buildDemoJobSkills).filter((skill) => requested.has(skill.id));
}

export function buildDemoJobDetail(id: string | number): JobDetail | null {
  const job = demoJobById.get(String(id));
  if (!job) return null;
  return { ...job };
}

export function buildDemoJobMatch(id: string | number): JobMatchResult | null {
  const job = demoJobById.get(String(id));
  if (!job) return null;
  const dir = DIR_KEYS.find(k => PROFILES[k].titles.includes(job.name)) ?? "frontend";
  const p = PROFILES[dir];
  const jobIdx = DEMO_JOBS.findIndex(x => x.id === job.id);
  const toLearn = p.skills.filter(s => s.proficiency === "FAMILIAR" || s.proficiency === "BASIC").slice(0, 2)
    .map((s): SkillLearningSuggestion => ({
      skillName: s.name,
      reason: `「${job.name}」岗位要求${s.requirement}，简历中缺少相关项目证据`,
      suggestion: `建议通过 1-2 个实战项目补齐 ${s.name}，并在简历中补充可量化成果`,
    }));
  return {
    id: String(8100000000000000000n + BigInt(jobIdx)),
    resumeId: "-",
    jobId: String(id),
    score: 58 + (jobIdx * 7) % 30,
    summary: `您的简历与「${job.name}」的技能画像总体匹配，核心技能方向一致，${toLearn.length ? `建议优先补齐 ${toLearn.map(s => s.skillName).join("、")}` : "建议补充更多项目细节以提升匹配度"}。`,
    skillsToLearn: toLearn,
    actionSuggestions: [
      "在简历中突出与岗位描述高度相关的项目经历与量化成果",
      "针对待学习技能补充在线课程或开源项目证据",
      "可参考岗位原始 JD 调整简历关键词，提高通过率",
    ],
    createdAt: fmt(Date.now()),
  };
}

/* ═══════════════ 数据源详情 / 溯源 / 审核兜底（审核状态在内存中真实流转） ═══════════════ */

export function buildDemoSourceDetail(id: string | number): DataSourceDetail | null {
  const s = demoSourceById.get(String(id));
  return s ? { ...s.detail } : null;
}

export function buildDemoSourceRecord(id: string | number): SourceJobDetail | null {
  const s = demoSourceById.get(String(id));
  return s ? { ...s.source } : null;
}

export function applyDemoReview(
  id: string | number,
  status: "PASSED" | "REJECTED",
  edits?: Partial<Record<"jobName" | "companyName" | "salary" | "city" | "education" | "experience" | "jobDescription", string>>,
): DataSourceDetail | null {
  const s = demoSourceById.get(String(id));
  if (!s) return null;
  if (edits) {
    const { jobName, companyName, salary, city, education, experience, jobDescription } = edits;
    if (jobName) s.detail.jobName = jobName;
    if (companyName) s.detail.companyName = companyName;
    if (salary) s.detail.salary = salary;
    if (city) s.detail.city = city;
    if (education) s.detail.education = education;
    if (experience) s.detail.experience = experience;
    if (jobDescription) s.detail.jobDescription = jobDescription;
    s.item.jobName = s.detail.jobName;
    s.item.companyName = s.detail.companyName;
  }
  s.item.reviewStatus = status;
  s.detail.reviewStatus = status;
  s.detail.reviewedAt = fmt(Date.now());
  s.detail.reviewedBy = pick(REVIEWERS, Number(String(id).slice(-4)) || 0);
  return { ...s.detail };
}

/* ═══════════════ 系统级统计口径（工作台 / 数据导入 / 数据源三页 KPI 同源） ═══════════════ */

const PLATFORM_COLORS = ["#1E4C8F", "#2E9E9A", "#7468CE", "#D98E1F", "#E25C4A", "#4E9E6A"] as const;

export const DEMO_STATS = (() => {
  const pending = DEMO_SOURCES.filter(s => s.item.reviewStatus === "PENDING");
  const passed = DEMO_SOURCES.filter(s => s.item.reviewStatus === "PASSED");
  const rejected = DEMO_SOURCES.filter(s => s.item.reviewStatus === "REJECTED");

  // 平台构成固定加权演示口径（与「最近注入批次」表同源，合计 120）：
  // CSV 注入 46 / 智联招聘 38 / BOSS直聘 22 / 猎聘 7 / 前程无忧 4 / 拉勾 3
  const PLATFORM_MIX = [
    { name: "CSV 注入", count: 46 },
    { name: "智联招聘", count: 38 },
    { name: "BOSS直聘", count: 22 },
    { name: "猎聘", count: 7 },
    { name: "前程无忧", count: 4 },
    { name: "拉勾", count: 3 },
  ] as const;
  const platformStats = PLATFORM_MIX.map(({ name, count }, i) => ({
    name,
    count,
    pct: Math.round((count / DEMO_SOURCES.length) * 100),
    color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
  }));

  // 岗位样本月度导入趋势（近 12 个月：2025-07 ~ 2026-06）。
  // 演示形态：12 根参差柱（35~105），月底（06）为当前月，真实导入会在此柱上叠加。
  const TREND_MONTHS: number[] = [48, 65, 38, 68, 55, 82, 58, 35, 95, 78, 105, 48];
  const trend: { dt: string; n: number }[] = TREND_MONTHS.map((n, i) => {
    const d = new Date(Date.UTC(2025, 6 + i, 1)); // 2025-07 起逐月
    return { dt: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`, n };
  });

  const latest = DEMO_SOURCES.reduce((a, b) => (a.item.createdAt < b.item.createdAt ? b : a));
  return {
    total: DEMO_SOURCES.length,
    pending: pending.length,
    passed: passed.length,
    rejected: rejected.length,
    passRate: `${((passed.length / Math.max(1, passed.length + rejected.length)) * 100).toFixed(1)}%`,
    pendingHigh: Math.max(1, Math.round(pending.length * 0.25)),
    todayNew: DEMO_SOURCES.filter(s => s.item.createdAt.startsWith("2026-09-01")).length,
    platformStats,
    trend,
    directions: DIR_KEYS.length,
    cityCount: new Set(DEMO_JOBS.map(j => j.city)).size,
    latestTime: latest.item.createdAt.slice(11, 16),
    latestTrace: latest.detail.id,
    latestCity: latest.detail.city,
  };
})();
