// 新版统一响应格式：{ code: number, data: T }，无 message 字段
export interface ApiResponse<T> {
  code: number;
  data: T;
}

// 新版分页格式：pageSize (camelCase)
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OccupationFamily {
  id: string;
  name: string;
}

export interface OccupationItem {
  id: string;
  name: string;
  occupation_family: OccupationFamily | null;
  abilities_count: number;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface OccupationDetail extends OccupationItem {
  required_abilities: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CreateOccupationBody {
  occupation_name: string;
  occupation_family_id: string;
}

export interface OccupationMutationResult {
  occupation_id: string;
  occupation_name: string;
}

export interface ReviewBody {
  review_status: string;
}

export interface OccupationReviewResult {
  occupation_id: string;
  review_status: string;
}

export interface AbilityItem {
  id: string;
  name: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AbilityDetail = AbilityItem;

export interface CreateAbilityBody {
  name: string;
}

export interface AbilityMutationResult {
  ability_id: string;
  ability_name: string;
}

export interface AbilityReviewResult {
  ability_id: string;
  review_status: string;
}

export interface OccupationFamilyItem {
  id: string;
  name: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccupationFamilyDetail {
  id: string;
  name: string;
  major: { id: string; name: string };
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  occupations: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CreateOccupationFamilyBody {
  occupation_family_name: string;
  major_id: string;
}

export interface OccupationFamilyMutationResult {
  occupation_family_id: string;
  occupation_family_name: string;
}

export interface OccupationFamilyReviewResult {
  occupation_family_id: string;
  review_status: string;
}

export interface MajorItem {
  id: string;
  name: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MajorDetail {
  id: string;
  name: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  occupation_families: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CreateMajorBody {
  major_name: string;
}

export interface MajorMutationResult {
  major_id: string;
  major_name: string;
}

export interface MajorReviewResult {
  major_id: string;
  review_status: string;
}

export interface CreateStudentAffairBody {
  uid: string;
  name: string;
  password?: string;
  department_id?: string;
}

export interface CreateStudentAffairResult {
  user_id: string;
  uid: string;
  name: string;
  role: string;
  student_affair_id: string;
}

export interface StudentAffairItem {
  id: string;
  uid: string;
  name: string;
  department: { id: string; name: string } | null;
  status: "NORMAL" | "LOCKED";
  created_at: string;
}

export interface ImportError {
  row: number;
  uid: string;
  reason: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

// ── 管理员模块：院系管理 ──
export interface SchoolItem {
  id: string;
  name: string;
}

export interface CreateSchoolBody {
  name: string;
}

export interface SchoolMutationResult {
  school_id: string;
  name: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  school_id: string;
}

export interface CreateDepartmentBody {
  name: string;
  school_id: string;
}

export interface DepartmentMutationResult {
  department_id: string;
  name: string;
  school_id: string;
}

// ── 用户状态管理 ──
export interface UserStatusBody {
  status: "NORMAL" | "LOCKED";
}

// ── 数据人员管理 ──
export interface CreateDataStaffBody {
  uid: string;
  name: string;
  password?: string;
  role: string;
}

export interface DataStaffResult {
  user_id: string;
  uid: string;
  name: string;
  role: string;
}

// ── 用户列表 ──
export interface UserItem {
  user_id: string;
  uid: string;
  name: string;
  role: string;
  status: string;
  school: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  created_at: string;
}

// ── 统计分析模块 ──

// 1. 岗位能力图谱
export interface AbilityGraphScope {
  city_id: string;
  city_name: string;
  major_id: string;
  major_name: string;
  company_id: string;
  company_name: string;
  period: string;
}

export interface AbilityGraphSummary {
  node_count: number;
  edge_count: number;
  family_count: number;
  job_count: number;
  skill_count: number;
  tool_count: number;
}

export interface GraphNode {
  id: string;
  entity_id: string;
  type: string;
  name: string;
  coverage: number;
  related_job_count: number;
  sample_count: number;
  review_status: string;
  active: boolean;
}

export interface GraphEdge {
  id: string;
  entity_id: string;
  source_id: string;
  target_id: string;
  type: string;
  weight: number;
  support_count: number;
  proficiency: string;
  review_status: string;
  confirmed: boolean;
  has_evidence: boolean;
  active: boolean;
}

export interface AbilityGraphData {
  scope: AbilityGraphScope;
  summary: AbilityGraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
}

// 2. 图谱节点详情
export interface EvidenceItem {
  data_source_id: string;
  job_id: string;
  job_name: string;
  company_name: string;
  publish_date: string;
  source_platform: string;
  source_url: string;
  proficiency: string;
  payload: Record<string, unknown>;
}

export interface GraphNodeDetail {
  id: string;
  entity_id: string;
  type: string;
  name: string;
  coverage: number;
  related_job_count: number;
  company_count: number;
  sample_count: number;
  review_status: string;
  evidence: EvidenceItem[];
  warnings: string[];
}

// 3. 图谱周期比较
export interface GraphComparisonScope {
  city_id: string;
  major_id: string;
  company_id: string;
  base_period: string;
  compare_period: string;
}

export interface ComparisonSummary {
  added_skills: number;
  removed_skills: number;
  rising_skills: number;
  declining_skills: number;
  added_relations: number;
  removed_relations: number;
  strengthened_relations: number;
  weakened_relations: number;
}

export interface SkillChange {
  change_type: string;
  skill_id: string;
  skill_name: string;
  base_coverage: number;
  compare_coverage: number;
  change_pp: number;
}

export interface RelationChange {
  edge_id: string;
  job_id: string;
  skill_id: string;
  base_support_count: number;
  compare_support_count: number;
  base_weight: number;
  compare_weight: number;
  change_pp: number;
  change_type: string;
}

export interface GraphComparisonData {
  scope: GraphComparisonScope;
  summary: ComparisonSummary;
  base_graph: { period: string; nodes: GraphNode[]; edges: GraphEdge[] };
  compare_graph: { period: string; nodes: GraphNode[]; edges: GraphEdge[] };
  changes: SkillChange[];
  relation_changes: RelationChange[];
  warnings: string[];
}

// 4. 能力演化趋势
export interface EvolutionTrendScope {
  city_id: string;
  major_id: string;
  company_id: string;
  from_period: string;
  to_period: string;
}

export interface EvolutionTrendSummary {
  emerging: number;
  rising: number;
  stable: number;
  declining: number;
}

export interface TrendSkill {
  id: string;
  name: string;
}

export interface TrendPoint {
  skill_id: string;
  coverage: number;
  skill_count: number;
  total_count: number;
}

export interface TrendSeries {
  period: string;
  points: TrendPoint[];
}

export interface TrendRanking {
  rank: number;
  skill_id: string;
  name: string;
  change_pp: number;
  status: string;
}

export interface TrendDetail {
  skill_id: string;
  name: string;
  base_coverage: number;
  current_coverage: number;
  change_pp: number;
  company_count: number;
  sample_count: number;
  status: string;
}

export interface EvolutionTrendData {
  scope: EvolutionTrendScope;
  summary: EvolutionTrendSummary;
  skills: TrendSkill[];
  series: TrendSeries[];
  ranking: TrendRanking[];
  details: TrendDetail[];
}

// 5. 演化事件列表
export interface EvolutionEventItem {
  event_key: string;
  skill_id: string;
  skill_name: string;
  event_type: string;
  base_period: string;
  compare_period: string;
  base_coverage: number;
  current_coverage: number;
  change_pp: number;
  company_count: number;
  sample_count: number;
}

// 6. 演化事件详情
export interface EventMetrics {
  base_period: string;
  compare_period: string;
  base_coverage: number;
  current_coverage: number;
  change_pp: number;
  company_count: number;
  sample_count: number;
}

export interface EvolutionEventDetail {
  skill_id: string;
  skill_name: string;
  event_type: string;
  metrics: EventMetrics;
  evidence: EvidenceItem[];
  warnings: string[];
}

// 7. 能力组合演化
export interface ComboEvolutionScope {
  city_id: string;
  major_id: string;
  company_id: string;
  base_period: string;
  compare_period: string;
}

export interface ComboCenterSkill {
  id: string;
  name: string;
}

export interface ComboNode {
  skill_id: string;
  name: string;
  center: boolean;
}

export interface ComboEdge {
  source_skill_id: string;
  target_skill_id: string;
  cooccurrence_count: number;
  cooccurrence_rate: number;
  status: string;
}

export interface ComboNetwork {
  nodes: ComboNode[];
  edges: ComboEdge[];
}

export interface ComboChange {
  skill_id: string;
  name: string;
  change_type: string;
  base_rate: number;
  compare_rate: number;
  change_pp: number;
}

export interface ComboEvidenceJob {
  job_id: string;
  job_name: string;
  skill_ids: string[];
  cooccurrence_count: number;
  sample_count: number;
}

export interface ComboEvolutionData {
  scope: ComboEvolutionScope;
  center_skill: ComboCenterSkill;
  network: ComboNetwork;
  changes: ComboChange[];
  evidence_jobs: ComboEvidenceJob[];
  warnings: string[];
}

// ── 数据工程师模块（新版 API）──

// 启动采集响应
export interface CrawlerResult {
  count: string;
  trace_id: string;
}

// 采集状态响应
export interface CrawlerStatus {
  status: "idle" | "running" | "success" | "failed" | "stopped";
  count: string;
  message: string;
}

// 清洗后岗位列表摘要（后端返回 snake_case）
export interface DataSourceItem {
  id: string;
  job_name: string;
  company_name: string;
  source_platform: string;
  publish_date: string;
  created_at: string;
  review_status: string;
}

// 清洗后岗位详情（全字段，后端 snake_case）
export interface DataSourceDetail {
  id: string;
  trace_id: string;
  publish_date: string;
  source_platform: string;
  source_url: string;
  city: string;
  tags: string;
  major: string;
  nature: string;
  salary: string;
  job_name: string;
  company_name: string;
  company_size: string;
  province: string;
  education: string;
  experience: string;
  job_description: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// 原始记录（追溯用，后端 snake_case）
export interface SourceJobDetail {
  id: string;
  trace_id: string;
  publish_date: string;
  source_platform: string;
  source_url: string;
  city: string;
  tags: string;
  major: string;
  nature: string;
  salary: string;
  job_name: string;
  company_name: string;
  company_size: string;
  province: string;
  education: string;
  experience: string;
  job_description: string;
  clean_status: string;
}

// 复核响应
export interface DataSourceReviewResult {
  job: DataSourceDetail;
}

// 数据源列表查询参数
export interface DataSourceListParams {
  page?: number;
  pageSize?: number;
  reviewStatus?: string;
  publishDateFrom?: string;
  publishDateTo?: string;
}

// ── 模拟采集（ingest）模块 ──

// 单条注入岗位数据（字段与爬虫产出 JobRecord 一致，snake_case）
export interface IngestJob {
  publish_date?: string;
  source_platform?: string;
  source_url?: string;
  city?: string;
  tags?: string;
  major?: string;
  nature?: string;
  salary?: string;
  job_name: string;
  company_name?: string;
  company_size?: string;
  province?: string;
  education?: string;
  experience?: string;
  job_description?: string;
}

// 模拟采集响应
export interface IngestResult {
  count: string;
  trace_id: string;
  status: string;
}

// ── 专业职业管理（occupation）模块 ──

// 目录项（学科门类 / 专业类 / 职业大类 / 职业中类 / 职业小类）
export interface CatalogItem {
  id: string; // 雪花 ID int64，lossless 解析为字符串避免精度丢失
  code: string;
  name: string;
}

// 可向量化目录项（专业 / 职业），is_embed 表示名称是否已完成向量化
export interface EmbeddableCatalogItem extends CatalogItem {
  is_embed: boolean;
}

// 目录分页响应（gateway 返回 pageSize，字段为 camelCase）
export interface CatalogPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 向量化进度（embedded / total）
export interface EmbeddingProgress {
  embedded: number;
  total: number;
}

// 专业、职业与规范技能向量化进度汇总
export interface EmbeddingProgressResponse {
  majors: EmbeddingProgress;
  occupations: EmbeddingProgress;
  skills: EmbeddingProgress;
}

// 向量化任务状态（gateway 返回 camelCase）
export interface EmbeddingTaskStatus {
  status: string;
  traceId: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  message: string;
  startedAt: string;
  finishedAt: string;
}

// ── 学生能力分析模块 ──

export interface AnalysisRequest {
  major_id: string;
  city_id: string;
}

export interface AbilityComparison {
  ability_name: string;
  required_proficiency: string;
  student_proficiency: string;
  status: string;
}

export interface AnalysisResult {
  analysis_id: string;
  task_status: string;
  comparison: AbilityComparison[];
  missing_abilities: string[];
  ai_suggestion: string;
}

// ── 岗位模块（市场招聘岗位）──

export interface JobItem {
  job_id: string;
  occupation_name: string;
  company_name: string;
  city_name: string;
  source_url: string;
}

export interface JobAbility {
  ability_id: string;
  ability_name: string;
  proficiency: string;
}

export interface JobAbilities {
  job_id: string;
  major_id: string;
  major_name: string;
  city_id: string;
  city_name: string;
  abilities: JobAbility[];
}

// ── 数据复核员模块 ──

export interface AiAnalysisItem {
  id: string;
  data_source_id: string;
  job_id: string;
  task_status: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── 教师模块 ──

export interface TeacherStudentItem {
  student_id: string;
  uid: string;
  name: string;
  status: string;
  department_id: string;
  created_at: string;
}

// ── 8.1 当前用户资料（GET /api/auth/me）──
// 扁平用户对象：基础字段为 camelCase，组织字段为 snake_case（后端 userData 混合返回）
export interface CurrentUser {
  id: string; // 雪花 ID int64，lossless 解析为字符串
  uid: string;
  name: string;
  role: string;
  status: string;
  university_id: string | number; // 未归属为 0，否则雪花 ID
  university_name: string;
  school_id: string | number;
  school_name: string;
  department_id: string | number;
  department_name: string;
}

// ── 8.2 用户管理（仅 ADMIN）──

// 分页查询用户请求体（POST /api/auth/users）
export interface ListUsersParams {
  page?: number; // 从 0 开始
  pageSize?: number;
  name?: string; // 包含匹配
  role?: string; // 精确匹配
  universityId?: number;
  schoolId?: number;
  departmentId?: number;
}

// 组织目录项（高校 / 学院 / 系部，统一返回 id + name）
export interface OrganizationItem {
  id: string;
  name: string;
}

// ── 8.3 用户简历直传（已登录用户）──

// 熟练度枚举（后端 ai-service 契约：空串或四档）
export type ResumeProficiency = "" | "Basic" | "Familiar" | "Advanced" | "Expert";

// 教育经历
export interface EducationExperience {
  major: string;
  university_name: string;
  start_date: string; // YYYY-MM-DD 或空串
  end_date: string;
  description: string;
}

// 工作经历
export interface WorkExperience {
  occupation_name: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
}

// 项目经历
export interface ProjectExperience {
  project_name: string;
  start_date: string;
  end_date: string;
  description: string;
}

// 专业技能
export interface ProfessionalSkill {
  skill_name: string;
  proficiency: ResumeProficiency;
}

// 获奖
export interface ResumeAward {
  award_name: string;
  date: string; // YYYY-MM-DD 或空串
  description: string;
}

// 五类结构化字段（与 ai-service format.json 完全一致）
export interface ResumeFields {
  education_experience: EducationExperience[];
  work_experience: WorkExperience[];
  project_experience: ProjectExperience[];
  professional_skills: ProfessionalSkill[];
  awards: ResumeAward[];
}

// 简历对象（GET /api/auth/resumes / 完成上传 / 编辑后返回）
// EDITED 记录不绑定文件，fileName/fileSize/content 允许为 null
export interface ResumeData {
  id: string;
  fileName: string | null;
  fileSize: number | null;
  content: string | null; // OCR 提取文字
  createdAt: string;
  fields: ResumeFields; // 校验并规范化后的五类结构化字段
  source: string; // SYSTEM / EDITED
}

// 创建直传地址请求体（POST /api/auth/resumes/upload-url）
export interface CreateResumeUploadParams {
  fileName: string; // PDF / DOCX
  fileSize: number; // 最大 10 MiB
}

// 直传地址响应
export interface ResumeUploadUrlResult {
  uploadId: string | number; // 自增主键，number（不超 2^53，安全）
  uploadUrl: string;
  method: string;
  contentType: string;
  expiresAt: string;
}

// 完成上传请求体（POST /api/auth/resumes/upload-complete）
export interface CompleteResumeUploadParams {
  uploadId: string | number;
  fileName: string;
}

// 编辑简历请求体（PUT /api/auth/resumes）
export interface EditMyResumeParams {
  content?: string; // 可选正文
  fields: ResumeFields; // 完整五类字段
}

// ── 8.4 岗位分析审核（ADMIN / DATA_REVIEWER）──

// 岗位分析任务摘要（分页列表项）
export interface JobAnalysisTaskSummary {
  id: string;
  jobId: string;
  traceId: string;
  jobName: string;
  taskStatus: string;
  reviewStatus: string;
  selectedOccupationId: string | number | null;
  modelName: string;
  errorMsg: string;
  attempts: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | number | null;
  occupationAnalysisStatus: string;
  jdAnalysisStatus: string;
  jobMajor: string;
  selectedMajorId: string | number | null;
  majorAnalysisStatus: string;
}

// 职业候选
export interface JobAnalysisCandidate {
  occupationId: string | number;
  occupationName: string;
  rank: number;
  similarity: number;
}

// 专业候选
export interface JobAnalysisMajorCandidate {
  majorId: string | number;
  majorName: string;
  rank: number;
  similarity: number;
}

// 岗位技能分析结果
export interface JobAnalysisResult {
  id: string;
  jobId: string;
  skillName: string;
  skillProficiency: string;
  evidence: string;
  rank: number;
  reviewStatus: string;
  reviewAction: string;
  reviewedSkillName: string;
  reviewedSkillProficiency: string;
  reviewedEvidence: string;
  reviewedAt: string | null;
  reviewedBy: string | number | null;
}

// 岗位分析任务详情
export interface JobAnalysisTaskDetail {
  task: JobAnalysisTaskSummary;
  candidates: JobAnalysisCandidate[];
  majorCandidates: JobAnalysisMajorCandidate[];
  results: JobAnalysisResult[];
}

// 逐条技能审核项（PUT /job-analysis/{id}/review）
export interface JobAnalysisSkillReviewInput {
  resultId: string | number;
  action: "APPROVE" | "APPROVE_WITH_EDIT" | "REJECT";
  skillName?: string; // 仅 APPROVE_WITH_EDIT
  skillProficiency?: string; // 仅 APPROVE_WITH_EDIT
  evidence?: string; // 仅 APPROVE_WITH_EDIT
}

// 审核请求体
export interface ReviewJobAnalysisParams {
  majorId: string | number;
  occupationId: string | number;
  skillReviews: JobAnalysisSkillReviewInput[];
}

// ── 8.5 岗位技能归一审核（ADMIN / DATA_REVIEWER）──

// 全局规范技能（GET /api/auth/occupation/skills）
export interface CanonicalSkillItem {
  id: string;
  name: string;
  is_embed: boolean;
}

export type SkillResolutionAction = "SELECT_CANDIDATE" | "SELECT_EXISTING" | "CREATE_NEW";

export interface JobSkillResolutionTaskSummary {
  id: string;
  jobSkillId: string;
  jobId: string;
  traceId: string;
  skillName: string;
  taskStatus: string;
  reviewStatus: string;
  resolutionAction: string;
  selectedSkillId: string | number | null;
  modelName: string;
  errorMsg: string;
  attempts: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | number | null;
}

export interface JobSkillResolutionCandidate {
  skillId: string;
  skillName: string;
  rank: number;
  similarity: number;
}

export interface JobSkillResolutionTaskDetail {
  task: JobSkillResolutionTaskSummary;
  jobSkill: JobSkillData;
  candidates: JobSkillResolutionCandidate[];
}

export type ReviewJobSkillResolutionParams =
  | {
      resolutionAction: "SELECT_CANDIDATE" | "SELECT_EXISTING";
      skillId: string | number;
    }
  | {
      resolutionAction: "CREATE_NEW";
      newSkillName: string;
    };

// ── 8.6 岗位查询（所有已登录角色）──

// 已审核岗位数据（POST /api/jobs 列表项 / 详情 job）
export interface JobData {
  id: string;
  name: string;
  occupationId: string | number | null;
  majorId: string | number | null;
  publishDate: string;
  sourcePlatform: string;
  sourceUrl: string;
  city: string;
  tags: string;
  major: string;
  nature: string;
  salary: string;
  companyName: string;
  companySize: string;
  province: string;
  education: string;
  experience: string;
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
}

// 岗位关联专业
export interface JobMajorData {
  id: string;
  code: string;
  name: string;
  majorCategoryId: string | number;
}

// 岗位关联职业
export interface JobOccupationData {
  id: string;
  code: string;
  name: string;
  occupationCategoryId: string | number;
  description: string;
}

// 正式岗位技能
export interface JobSkillData {
  id: string;
  skillId: string | number | null;
  skillName: string;
  skillProficiency: string;
  evidence: string;
}

// 岗位列表查询请求体
export interface ListJobsParams {
  page?: number; // 从 0 开始
  pageSize?: number;
  name?: string;
  occupationId?: string | number; // 精确匹配
  majorId?: string | number; // 精确匹配
  major?: string;
  city?: string;
  province?: string;
  salary?: string;
  company?: string;
  education?: string;
  nature?: string;
  companySize?: string;
}

// 岗位详情聚合
export interface JobDetail {
  job: JobData;
  major: JobMajorData | null;
  occupation: JobOccupationData | null;
  jobSkills: JobSkillData[];
}

// ── 8.7 用户技能分析与能力时间线（已登录用户）──

// 技能熟练度（ai-service AnalyzedSkill 契约，全大写四档）
export type SkillProficiency = "EXPERT" | "ADVANCED" | "FAMILIAR" | "BASIC";

// 对外技能记录（AnalyzeMyResumeSkills / ListMySkills 返回，不含内部任务/模型/trace）
export interface UserSkillData {
  id: string; // 雪花 ID，lossless 解析为字符串
  resumeId: string;
  skillName: string;
  proficiency: string; // EXPERT / ADVANCED / FAMILIAR / BASIC
  evidence: string; // 简历原文证据
  createdAt: string;
}

// 分析我的简历技能响应（POST /api/auth/resumes/analyze-skills）
export interface AnalyzeResumeSkillsResult {
  resumeId: string;
  skills: UserSkillData[];
}

// 能力时间线响应（GET /api/auth/me/skills，无记录时 items 为空数组）
export interface MySkillsResult {
  items: UserSkillData[];
}

// ── 8.8 人岗匹配（POST /api/jobs/{id}/match）──

// 待学习技能建议
export interface SkillLearningSuggestion {
  skillName: string;
  reason: string; // 岗位要求与简历差距的原因
  suggestion: string; // 学习建议
}

// 人岗匹配结果
export interface JobMatchResult {
  id: string;
  resumeId: string;
  jobId: string;
  score: number; // 0~100 整数
  summary: string; // 匹配度摘要
  skillsToLearn: SkillLearningSuggestion[];
  actionSuggestions: string[]; // 行动建议
  createdAt: string;
}

// ── 审计日志（按服务独立分页）──

export type AuditLogSource = "occupation" | "crawler" | "ai";
export type AuditLogLevel = "" | "INFO" | "WARNING" | "ERROR";

export interface AuditLogItem {
  id: string;
  traceId: string;
  userId: string;
  userName: string;
  userType: string;
  userIp: string;
  level: Exclude<AuditLogLevel, "">;
  requestMethod: string;
  requestUrl: string;
  errorMsg: string;
  detail: string;
  createdAt: string;
  sourceService: AuditLogSource;
}

export interface PagedSearchAuditLogsParams {
  page?: number;
  pageSize?: number;
  level?: AuditLogLevel;
  createdAtFrom?: string;
  createdAtTo?: string;
  targetUserId?: string;
  userType?: string;
}
