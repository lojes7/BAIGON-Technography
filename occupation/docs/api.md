# 百工谱 — occupation_service

## 职责

- 分页搜索学科门类、专业类、专业、职业大类/中类/小类与职业。
- 由 ADMIN 分别启动、查询和停止专业名称、职业名称的后台向量化任务。
- 通过 Consul 发现 `ai-service`，调用 `BatchEmbedText` 生成 1024 维向量。
- 保存每条数据的向量化状态并写 `logs` 业务审计表。

## 领域包结构

- 专业域文件分别放在 `entity/major`、`repository/major`、`service/major`。
- 职业域文件分别放在 `entity/occupation`、`repository/occupation`、`service/occupation`。
- 各层根包只保留两个领域共享的基类、日志、向量化契约和后台任务协调器，不再集中堆放具体目录业务文件。

## REST API

REST 由 gateway 暴露，全部位于 `/api/auth/occupation`，需要登录且仅 `ADMIN` 可访问。

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

所有列表支持 `page`（从 0 开始）、`pageSize`（默认 20，最大 100）和 `keyword`（名称/编码模糊搜索）。专业与职业条目额外返回 `is_embed`；它严格由 `embedding_status == SUCCESS` 判断。

### 向量化管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/embedding/progress` | 返回专业与职业的 `embedded/total` |
| POST | `/majors/embedding` | 启动专业任务 |
| GET | `/majors/embedding` | 查询专业任务状态 |
| DELETE | `/majors/embedding` | 停止专业任务 |
| POST | `/occupations/embedding` | 启动职业任务 |
| GET | `/occupations/embedding` | 查询职业任务状态 |
| DELETE | `/occupations/embedding` | 停止职业任务 |

## 两类状态

数据库的 `embedding_status` 使用 PostgreSQL `task_status`：

```text
PENDING / SUCCESS / FAILED
```

后台任务运行态只保存在 occupation 进程中：

```text
idle / running / stopping / success / failed / stopped
```

专业与职业任务拥有独立状态和停止信号，可以并行；同一类型同一时间只能运行一个。服务重启后运行态回到 `idle`，但向量与记录状态保留；再次启动会处理本轮开始时的全部 `PENDING/FAILED` 快照并跳过 `SUCCESS`。

任务按配置批量调用 AI。批次失败时写入 `FAILED` 和 `embedding_error`，然后继续后续批次；当前不执行自动重试，`embedding_next_retry_at` 保持 `NULL`。停止操作取消当前 AI gRPC 调用，未完成记录保持 `PENDING`。

## 数据库升级

- 新建数据库由 `occupation/init.sql` 创建字段和索引。
- 已有数据库需由有权限的管理员执行 `occupation/migrations/20260812_add_catalog_embeddings.sql`。

## gRPC 错误映射

| gRPC | HTTP | 场景 |
|---|---:|---|
| `INVALID_ARGUMENT` | 400 | 分页或父级 ID 非法 |
| `FAILED_PRECONDITION` | 403 | 同类型任务已经运行 |
| `INTERNAL` | 500 | occupation 内部错误 |
| `UNAVAILABLE` | 503 | 服务发现或后端服务不可用 |
