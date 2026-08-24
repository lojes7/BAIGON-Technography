# 百工谱 — gateway_service

## 统一响应格式

所有 API 响应必须遵循以下结构：

```json
// 成功
{ "code": 200, "data": { ... } }

// 失败（不携带消息；code 可以是业务错误码）
{ "code": 401 }
```

- 没有自定义业务错误码时，`code` 与 HTTP 状态码一致
- 有自定义业务错误码时，HTTP 状态码表达错误类别，`code` 返回业务错误码（例如 HTTP 403 + `40301`）
- 成功时 `code` 恒为 200，业务数据放在 `data` 中
- 失败时仅有 `code` 字段，无 `error` 消息

## 职责

Go + Gin 网关，负责：

- **请求路由**：将 REST 请求转换为 gRPC 调用，转发到后端微服务
- **JWT 鉴权**：按路由组挂载，验证请求中的 Bearer Token（无全局白名单机制）
- **限流**：基于 IP 的令牌桶限流（按需启用）
- **服务发现**：通过 Consul 动态发现后端 gRPC 服务地址
- **链路追踪**：每个请求注入雪花 ID 作为 `trace_id`

## API 端点

### POST /api/login — 用户登录

网关接收 REST JSON 请求，通过 gRPC 调用 occupation-service 中的 `UserService.Login` RPC，返回 JWT Token 和用户信息。

> **本接口不需要认证**。登录等公开端点直接挂在 api group 下（未挂载 Auth 中间件）。

| 项目 | 内容 |
|------|------|
| **Method** | POST |
| **Path** | `/api/login` |
| **Content-Type** | `application/json` |
| **Auth** | 不需要（公开端点） |

**请求体**

```json
{
  "uid": "admin",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 示例 | 说明 |
|------|------|------|------|------|
| `uid` | string | 是 | `"admin"` | 登录账号 |
| `password` | string | 是 | `"123456"` | 密码 |

**成功响应 (200)**

所有成功响应遵循统一格式 `{"code": 200, "data": {...}}`：

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJJZCI6MSwicm9sZSI6IkFETUlOIn0...",
    "user": {
      "id": 1234567890,
      "uid": "admin",
      "name": "管理员",
      "role": "ADMIN"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 状态码，恒为 200 |
| `data.token` | string | JWT，后续 API 请求放入 `Authorization: Bearer <token>` 请求头 |
| `data.user.id` | number | 用户 ID（雪花 ID） |
| `data.user.uid` | string | 登录账号 |
| `data.user.name` | string | 显示名称 |
| `data.user.role` | string | 角色（ADMIN / STUDENT / TEACHER / …） |

**错误响应**

所有错误响应遵循统一格式 `{"code": <标准或业务错误码>}`，**不携带消息**：

```json
{
  "code": 401
}
```

| HTTP 状态码 | `code` | 含义 |
|------------|--------|------|
| 400 | 400 | 请求体格式错误 |
| 401 | 401 | 账号或密码错误 |
| 403 | 403 | 账号已被锁定 |
| 503 | 503 | 合并服务不可用（occupation-service 连接失败或超时） |
| 500 | 500 | 内部服务错误 |

**cURL 示例**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "admin", "password": "123456"}'
```

---

### GET /api/auth/me — 查看当前用户资料

任意已登录用户可以查询 JWT 对应的账号与校园归属，不接受客户端传入的用户 ID。
响应 `data` 为扁平用户对象，包含 `id / uid / name / role / status`，以及
`university_id / university_name / school_id / school_name / department_id / department_name`。
未归属的组织 ID 为 `0`，名称为空字符串。

### 当前用户简历（`/api/auth/resumes`）

所有简历接口都要求 Bearer Token，用户身份只从 JWT 获取。文件由浏览器使用预签名 URL 直接
上传到 MinIO，文件字节不经过 gateway。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/resumes/upload-url` | 获取 PDF/DOCX 的 MinIO 预签名 PUT 地址 |
| POST | `/api/auth/resumes/upload-complete` | 确认直传完成，同步执行 OCR、AI 抽取、校验和落库 |
| GET | `/api/auth/resumes` | 返回当前用户最新的简历版本 |
| PUT | `/api/auth/resumes` | 保存一条不绑定文件的人工编辑版本 |

人工编辑请求只接收用户可编辑字段：

```json
{
  "content": null,
  "fields": {
    "education_experience": [],
    "work_experience": [],
    "project_experience": [],
    "professional_skills": [],
    "awards": []
  }
}
```

`content` 和各记录中的可选字符串可以为 `null`；`fields` 的五个根数组必须全部存在。
`proficiency` 非空时只能为 `Basic`、`Familiar`、`Advanced`、`Expert`。服务端生成记录 ID、
创建时间及 `EDITED` 来源，不接受客户端指定文件元数据或来源。

查询、编辑和上传完成均返回同一种 `data`：包含 `id/fileName/fileSize/content/createdAt/source/fields`。
`SYSTEM` 表示 OCR/AI 生成，`EDITED` 表示人工编辑；`EDITED` 的 `fileName/fileSize` 为 `null`。
无简历时 GET 仍返回 `{"code":200,"data":{}}`。

### ADMIN 用户管理（`/api/auth/users`）

以下接口均要求 Bearer Token，且只允许 **ADMIN** 角色访问。

#### POST /api/auth/users — 分页筛选用户

分页和筛选条件统一放在 JSON 请求体中：

```json
{
  "page": 0,
  "pageSize": 20,
  "name": "张",
  "role": "STUDENT",
  "universityId": 1,
  "schoolId": 1,
  "departmentId": 1
}
```

`role` 使用 `STUDENT / TEACHER / STUDENT_AFFAIR / DATA_ANALYST / DATA_REVIEWER / ADMIN /
CIVILIAN` 精确匹配；`name` 忽略大小写并执行包含匹配。三个组织 ID 来自下方的组织目录接口，
使用精确匹配；值为 `0` 或不传时不参与筛选。列表项返回完整 `UserData`，包含基础字段、
三级组织 ID 及名称，不返回密码。

#### GET /api/auth/users/{id} — 查看用户详情

ADMIN 通过用户 ID 查看用户账号和校园归属，返回与 `/api/auth/me` 相同的
扁平用户字段；用户不存在时返回 404。

#### POST /api/auth/users/{id}/block — 封禁用户

ADMIN 将指定用户状态设为 `LOCKED`。该操作是幂等的，重复封禁已锁定用户仍返回
200；响应 `data` 为更新后的完整 `UserData`，用户不存在时返回 404。

#### POST /api/auth/users/{id}/unlock — 解封用户

ADMIN 将指定用户状态设为 `NORMAL`。该操作是幂等的，重复解封正常用户仍返回
200；响应 `data` 为更新后的完整 `UserData`，用户不存在时返回 404。

#### 组织目录接口

| 方法 | 路径 | 额外参数 |
|---|---|---|
| GET | `/api/auth/users/universities` | 无 |
| GET | `/api/auth/users/schools` | 可选 `universityId` |
| GET | `/api/auth/users/departments` | 可选 `schoolId` |

三个接口均支持 `page`、`pageSize` 和 `keyword`。父级 ID 不传时返回全系统对应目录，传入时用于
级联筛选。列表项统一返回 `id` 和 `name`。

---

### GET /api/ping — 网关心跳

心跳探测端点，返回网关运行状态和 trace_id。**不需要认证**。

| 项目 | 内容 |
|------|------|
| **Method** | GET |
| **Path** | `/api/ping` |
| **Auth** | 不需要（公开端点） |

**成功响应 (200)**

```json
{
  "code": 200,
  "data": {
    "message": "baigon gateway is running",
    "trace_id": "1234567890123456789"
  }
}
```

一次请求必须覆盖任务的全部技能结果。通过项与修改后通过项写入 `job_skills`，拒绝项不写入；
`job_analysis_results` 只更新审核状态；修改后的技能字段直接写入 `job_skills`，不会进入或覆盖 AI 原始结果。

岗位分析审核确认 `jobs.major_id`、`jobs.occupation_id`，不修改 `reviewed_cleaned_job_sources`。

---

### GET /health — 健康检查

Consul 健康探测端点，**不需要认证**。

| 项目 | 内容 |
|------|------|
| **Method** | GET |
| **Path** | `/health` |

**响应 (200)**

```json
{
  "code": 200,
  "data": {
    "service": "gateway-service",
    "status": "healthy",
    "time": "2025-01-01T12:00:00+08:00"
  }
}
```

---

### 数据治理端点（`/api/auth/data-source`）

以下端点需要 **ADMIN / DATA_REVIEWER** 角色（Auth 验 JWT + RoleAuth 验角色）。

#### POST /api/auth/data-source — 分页查询清洗后岗位

请求体（分页 + 筛选）：

```json
{
  "page": 0,
  "pageSize": 20,
  "reviewStatus": "PENDING",
  "publishDateFrom": "2025-01-01T00:00:00+08:00",
  "publishDateTo": "2025-12-31T23:59:59+08:00"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码，从 0 开始，默认 0 |
| `pageSize` | number | 否 | 每页条数，默认 20 |
| `reviewStatus` | string | 否 | 复核状态：PENDING / PASSED / REJECTED，空=全部 |
| `publishDateFrom` / `publishDateTo` | string | 否 | 发布时间范围（ISO8601），可选 |

成功响应 `data` 内含 `items`（摘要：id / job_name / company_name / source_platform / publish_date / created_at / review_status）、`total`、`page`、`pageSize`。

#### GET /api/auth/data-source/{id} — 清洗后岗位详情

返回 `cleaned_job_sources` 全字段。`{id}` 为 cleaned_job_sources.id。

#### GET /api/auth/data-source/{id}/source — 原始记录追溯

返回对应 `job_sources` 原始记录（data-source 经 gRPC 调 crawler-service 查询）。不存在 → 404。

#### POST /api/auth/data-source/{id}/review — 复核通过

在事务中锁定目标记录，将 `cleaned_job_sources` 标记为 `PASSED`、写入 `reviewed_at/reviewed_by`，并把原业务数据写入 `reviewed_cleaned_job_sources`。审核结果沿用来源记录的 `trace_id`。

#### DELETE /api/auth/data-source/{id}/review — 复核拒绝

将 `cleaned_job_sources` 标记为 `REJECTED`，不写入 `reviewed_cleaned_job_sources`。

#### PUT /api/auth/data-source/{id}/review — 修改后通过复核

请求体携带修改后的字段（jobName / companyName / salary / city / education / experience / jobDescription）。`cleaned_job_sources` 只更新审核参数，原业务字段保持不变；合并编辑后的版本写入 `reviewed_cleaned_job_sources`，并沿用来源记录的 `trace_id`。

三个审核端点都使用数据库行级悲观锁。并发请求取得锁后如果发现状态已经不是 `PENDING`，返回 HTTP 403：

```json
{ "code": 40301 }
```

其他错误响应：400 参数错误 / 401 未认证 / 403 且 `code=403` 表示非 ADMIN·DATA_REVIEWER / 404 记录不存在 / 503 服务不可用。

---

## 专业、职业与岗位分析管理

所有接口位于 `/api/auth/occupation`。七个目录列表允许 **ADMIN / DATA_REVIEWER**，均为 GET 分页搜索，统一支持 `page`（从 0 开始）、`pageSize`（默认 20，最大 100）和 `keyword`（名称或编码）。

| 路径 | 额外查询参数 |
|---|---|
| `/discipline-categories` | 无 |
| `/major-categories` | `disciplineCategoryId` |
| `/majors` | `majorCategoryId` |
| `/occupation-major-categories` | 无 |
| `/occupation-sub-categories` | `occupationMajorCategoryId` |
| `/occupation-categories` | `occupationSubCategoryId` |
| `/occupations` | `occupationCategoryId` |

`majors` 和 `occupations` 的每一项都包含 `is_embed`，包括值为 `false` 时也不会省略。

任务管理接口：

- `GET /embedding/progress`：返回专业与职业各自的 `embedded/total`。
- `POST/GET/DELETE /majors/embedding`：启动、查询、停止专业名称向量化。
- `POST/GET/DELETE /occupations/embedding`：启动、查询、停止职业名称向量化。

专业与职业任务可以并行，同类型重复启动返回 HTTP 403。任务状态为 `idle/running/stopping/success/failed/stopped`；任务状态只保存在进程内，记录级 `embedding_status` 与向量持久化在数据库。

岗位分析审核允许 **ADMIN / DATA_REVIEWER**：

- `GET /job-analysis`：分页查询任务，`reviewStatus` 可选。
- `GET /job-analysis/{id}`：返回任务、专业/职业候选与 `job_analysis_results` 技能结果。
- `PUT /job-analysis/{id}/review`：确认专业、职业并逐条审核全部技能结果；两者均可选择对应目录中的任意有效记录。

审核请求示例：

```json
{
  "majorId": 456,
  "occupationId": 123,
  "skillReviews": [
    { "resultId": 1001, "action": "APPROVE" },
    {
      "resultId": 1002,
      "action": "APPROVE_WITH_EDIT",
      "skillName": "Microsoft Word",
      "skillProficiency": "Familiar",
      "evidence": "能够使用 Word 编写文档"
    },
    { "resultId": 1003, "action": "REJECT" }
  ]
}
```

---

## 岗位查询（`/api/jobs`）

以下端点要求 Bearer Token，所有已登录角色均可访问。

### POST /api/jobs — 分页筛选岗位

筛选条件统一通过 JSON 请求体传递：

```json
{
  "page": 0,
  "pageSize": 20,
  "name": "Java",
  "majorId": 456,
  "occupationId": 123,
  "major": "计算机",
  "city": "杭州",
  "province": "浙江",
  "salary": "20K",
  "company": "百工",
  "education": "本科",
  "nature": "全职",
  "companySize": "100-499人"
}
```

`majorId`、`occupationId` 精确匹配；其他文本字段忽略大小写并执行包含匹配。字段为空时不参与筛选。
响应 `data` 包含 `items`、`total`、`page`、`pageSize`。

### GET /api/jobs/{id} — 岗位详情

响应 `data` 包含 `job`、`major`、`occupation`、`jobSkills`。对应目录外键为空时
`major` 或 `occupation` 为 `null`；没有正式技能时 `jobSkills` 为空数组。

---

## 认证说明

鉴权中间件按**路由组**挂载，无全局白名单机制：

- **公开端点**（免鉴权）：`POST /api/login`、`GET /api/ping`、`GET /health`、`GET /swagger/*`
- **受保护端点**（需 Bearer Token）：`/api/auth` 路由组，以及显式挂载 Auth 的 `/api/jobs`

受保护端点需在请求头中携带 JWT：

```
Authorization: Bearer <token>
```

> **注意**：Auth 中间件已移除路径白名单逻辑，新增端点时必须显式声明——公开端点挂 api group，受保护端点挂 auth group，避免遗忘鉴权。

Token 由 occupation-service 的用户域签发，gateway 使用同一 `JWT_SECRET` 环境变量验签。

Claims 包含：`sub`(uid)、`userId`、`role`、`iat`、`exp`。

## 中间件链

请求按以下顺序经过中间件：

```
RequestID (trace_id 雪花 ID)
  → Logger (请求日志)
    → CORS (跨域)
      → [Auth] (JWT 鉴权，仅挂载于受保护路由组)
        → [RateLimit] (限流，当前注释未启用)
          → Handler (业务处理)
```

## 错误码总览

| HTTP 状态码 | 响应 `code` | 含义 |
|------------|---------------|------|
| 200 | 200 | 成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未认证 — Token 缺失、无效或过期；或账号密码错误 |
| 403 | 403 | 无权限 — 账号被锁定或角色不符合要求 |
| 403 | **40301** | 审核记录已被其他审核人处理 |
| 404 | 404 | 记录不存在 |
| 429 | 429 | 请求过于频繁（限流器启用时） |
| 500 | 500 | 服务内部错误 |
| 503 | 503 | 后端服务不可用 |

## 调用方约束

- 请求头 `Content-Type` 必须为 `application/json`
- 受保护接口需携带 `Authorization: Bearer <token>`
- 跨服务追踪可通过注入 `X-Trace-ID` 请求头实现（gateway 会透传或生成新的雪花 ID）
