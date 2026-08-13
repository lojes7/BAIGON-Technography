# 百工谱 — occupation_service

## 职责

`occupation-service` 已合并原 `data-source-service`，一个进程连接一个数据库，并在同一 gRPC 端口注册
`DataSourceService` 与 `OccupationService` 两套既有契约。主要职责包括：

- 消费 crawler 清洗完成事件并保存 `cleaned_job_sources`。
- 提供清洗数据查询、原始记录追溯和人工审核。
- 审核通过时在同一事务内保存审核快照、查询岗位别名并创建 `jobs`。
- 别名未命中时持久化分析任务，事务提交后由本地线程池异步调用 AI-service。
- 管理专业、职业目录及名称向量化任务。
- 通过 Consul 发现 crawler-service 与 ai-service。
- 所有领域共用一张 `logs` 业务审计表。

## 领域包结构

- 数据治理域：`entity/datasource`、`repository/datasource`、`service/datasource`、`kafka/crawler`。
- 专业域：`entity/major`、`repository/major`、`service/major`。
- 职业域：`entity/occupation`、`repository/occupation`、`service/occupation`。
- 岗位域：`entity/job`、`repository/job`。
- 岗位分析域：`entity/jobanalysis`、`repository/jobanalysis`、`service/jobanalysis`。
- 各层根包只保留共享基类、通用状态、审计上下文和跨领域协调器。

## 数据治理 API

REST 路径继续使用 `/api/auth/data-source`，protobuf 继续使用
`baigon.data_source.DataSourceService`，但 gateway 通过 Consul 连接 `occupation-service`。
所有接口允许 `ADMIN / DATA_REVIEWER`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/data-source` | 分页查询清洗岗位 |
| GET | `/api/auth/data-source/{id}` | 查看清洗岗位详情 |
| GET | `/api/auth/data-source/{id}/source` | 经 crawler-service 追溯原始记录 |
| POST | `/api/auth/data-source/{id}/review` | 审核通过 |
| DELETE | `/api/auth/data-source/{id}/review` | 审核拒绝 |
| PUT | `/api/auth/data-source/{id}/review` | 修改后通过 |

审核查询使用 `PESSIMISTIC_WRITE` 行锁。只有 `PENDING` 记录可处理；重复审核返回业务码
`40301`。原 `cleaned_job_sources` 的业务字段不会被审核编辑覆盖，编辑结果只进入
`reviewed_cleaned_job_sources`。

通过或修改后通过时，一个数据库事务同时完成：

1. 更新 `cleaned_job_sources` 审核状态。
2. 写入 `reviewed_cleaned_job_sources` 审核快照。
3. 用最终岗位名查询 `job_occupation_aliases`。
4. 无条件创建 `jobs`；命中别名时直接写入 `occupation_id`。
5. 未命中别名时创建 `PENDING` 的 `job_analysis_tasks`。

任一步失败时事务整体回滚。未命中别名的任务在事务提交后由本地专用线程池调用 AI-service，
不经过 Kafka。拒绝时只更新审核状态，不创建审核快照、岗位或分析任务。

## 岗位异步归类

Kafka 只保留 crawler-service 到 occupation-service 的清洗数据输入：
`baigon.crawler.document.ingested`。岗位与职业的归类过程不使用 Kafka。

岗位审核事务按 `trace_id` 和 `job_id` 幂等处理：

- 别名命中：直接填写 `jobs.occupation_id`。
- 别名未命中：创建唯一的 `job_analysis_tasks`，提交后异步调用 AI 获取前 5 个候选。
- AI 失败：`jobs` 保持存在，任务标记 `FAILED`，仍允许人工选择职业。

`trace_id` 从 crawler 清洗记录贯穿审核快照、`jobs`、分析任务及
`job_occupation_aliases`，是岗位归类的关键审计参数。

## 职业目录与岗位分析 API

REST 位于 `/api/auth/occupation`。目录读取和岗位分析允许 `ADMIN / DATA_REVIEWER`；
向量化任务管理仅允许 `ADMIN`。

### 目录查询

| 方法 | 路径 | 必填父级参数 |
|---|---|---|
| GET | `/discipline-categories` | 无 |
| GET | `/major-categories` | `disciplineCategoryId` |
| GET | `/majors` | `majorCategoryId` |
| GET | `/occupation-major-categories` | 无 |
| GET | `/occupation-sub-categories` | `occupationMajorCategoryId` |
| GET | `/occupation-categories` | `occupationSubCategoryId` |
| GET | `/occupations` | `occupationCategoryId` |

列表支持 `page`、`pageSize` 和 `keyword`。专业与职业条目的 `is_embed` 仅在
`embedding_status == SUCCESS` 时为真。

### 向量化管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/embedding/progress` | 查询专业与职业进度 |
| POST/GET/DELETE | `/majors/embedding` | 启动、查询、停止专业向量化 |
| POST/GET/DELETE | `/occupations/embedding` | 启动、查询、停止职业向量化 |

### 岗位分析审核

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/job-analysis` | 分页查询，可按 `reviewStatus` 筛选 |
| GET | `/job-analysis/{id}` | 查看任务与 AI 候选 |
| PUT | `/job-analysis/{id}/review` | 提交 `{ "occupationId": 123 }` |

最终职业可选择 `occupations` 中任意有效记录，不要求位于 AI 候选中。审核事务同时更新
`jobs.occupation_id`、`job_analysis_tasks` 和岗位名称别名；别名保存本次审核链路的
`trace_id`、`occupation_id` 与 `occupation_name`。

## 数据库初始化

本项目不维护迁移脚本，现有项目数据可直接丢弃。空库只执行两个入口：

- `occupation/init.sql`：依次加载 `sql/init-*.sql`。
- `occupation/data.sql`：在同一事务中加载 `sql/data-major.sql` 与
  `sql/data-occupation.sql`。

PostgreSQL 初始化只创建 `baigon_occupation`，不再创建 `baigon_data_source`。

## gRPC 错误映射

| gRPC | 响应码 | 场景 |
|---|---:|---|
| `INVALID_ARGUMENT` | 400 | 请求参数非法 |
| `FAILED_PRECONDITION` | 40301 | 清洗岗位已审核 |
| `FAILED_PRECONDITION` | 40302 | 岗位分析任务已审核 |
| `NOT_FOUND` | 404 | 记录或职业不存在 |
| `INTERNAL` | 500 | 服务内部错误 |
| `UNAVAILABLE` | 503 | crawler、AI 或服务发现不可用 |
