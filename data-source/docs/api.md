# 百工谱 — data_source_service

## 职责

数据清洗、质量治理、人工复核工作流。职责包括:

- **消费 crawler 采集完成事件**(Kafka `baigon.crawler.document.ingested`),将清洗后明细写入 `cleaned_job_sources` 表
- 提供清洗后岗位数据的分页查询、详情查询、原始记录追溯
- 人工复核工作流(通过 / 拒绝 / 修改后通过)
- 追溯原始记录时经 gRPC 调 crawler-service 查询 `job_sources` 表(跨库)

## Kafka 消费

### 消费的 topic

| topic | 生产者 | 内容 |
|-------|--------|------|
| `baigon.crawler.document.ingested` | crawler-service | 采集完成事件,携带清洗后明细 |

消费者:`com.baigon.datasource.kafka.CrawlerEventConsumer`,group-id `data-source-service`。

### 事件结构

```json
{
  "message_id": "<uuid>",
  "trace_id": "<雪花 ID>",
  "event_type": "baigon.crawler.document.ingested",
  "timestamp": "<UTC ISO8601>",
  "source_service": "crawler-service",
  "payload": {
    "source_document_id": "...",
    "evidence_chain_id": "...",
    "document_count": 100,
    "user_id": 1,
    "user_name": "admin",
    "user_ip": "127.0.0.1",
    "documents": [
      {
        "publish_date": "2025-01-01T00:00:00+00:00",
        "source_platform": "拉勾",
        "source_url": "...",
        "city": "北京",
        "tags": "Java、Go",
        "major": "计算机科学与技术",
        "nature": "全职",
        "salary": "15-25K",
        "job_name": "后端开发工程师",
        "company_name": "字节跳动",
        "company_size": "1000-9999人",
        "province": "北京市",
        "education": "本科",
        "experience": "1-3年",
        "job_description": "..."
      }
    ]
  }
}
```

### 落库逻辑

1. 解析事件信封,取 `payload.user_id/user_name/user_ip`(操作者用户上下文)与顶层 `trace_id`
2. 遍历 `payload.documents[]`,每条转 `CleanedJobSource` 实体(`publish_date` ISO → `OffsetDateTime`)
3. 调用 `CleanedJobSourceService.saveCleaned()`,雪花 ID 生成主键、`review_status` 默认 `PENDING`、写入 logs 表审计
4. 单条失败不影响其他条(逐条独立);整体解析失败记录 ERROR 日志不重试(桩阶段)

## gRPC 接口

服务端 `com.baigon.datasource.grpc.DataSourceGrpcService`(端口 50052),客户端为 gateway。

### ListCleanedJobs — 分页查询

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.data_source.DataSourceService/ListCleanedJobs` |
| **对应 REST** | `POST /api/auth/data-source` |

请求关键字段:`page`(从 0)/ `page_size` / `review_status`(PENDING/PASSED/REJECTED,空=全部)/ `publish_date_from` / `publish_date_to`(ISO8601,可选)

响应:`items[]`(摘要:id/job_name/company_name/source_platform/publish_date/created_at/review_status)+ `total` + `page` + `page_size`

### GetCleanedJob — 详情

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.data_source.DataSourceService/GetCleanedJob` |
| **对应 REST** | `GET /api/auth/data-source/{id}` |

请求:`id`(cleaned_job_sources.id)。响应:`job` 全字段。不存在 → `NOT_FOUND`。

### GetSourceJob — 原始记录追溯

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.data_source.DataSourceService/GetSourceJob` |
| **对应 REST** | `GET /api/auth/data-source/{id}/source` |

流程:按 id 查 cleaned_job_sources 拿 `trace_id` → **经 gRPC 调 crawler-service 的 `GetJobSourceByTraceId`** 查询 job_sources → 返回 `source` 全字段。crawler 不可用 → `UNAVAILABLE`。

### ReviewJob — 人工复核

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.data_source.DataSourceService/ReviewJob` |
| **对应 REST** | `POST/DELETE/PUT /api/auth/data-source/{id}/review` |

请求:`id` + `action`(`APPROVE` 通过 / `REJECT` 拒绝 / `APPROVE_WITH_EDIT` 修改后通过)+ `edited`(修改后字段,仅 EDIT 用)

行为:通过 → `review_status=PASSED` + `reviewed_at/reviewed_by`;拒绝 → `REJECTED`;修改后通过 → 应用 edited 业务字段后 `PASSED`。

## 错误码（gRPC → HTTP）

| gRPC Status | HTTP | 场景 |
|-------------|------|------|
| `INVALID_ARGUMENT` | 400 | 参数错误 / review_status 枚举不合法 |
| `NOT_FOUND` | 404 | 记录不存在 |
| `UNAVAILABLE` | 503 | crawler-service 不可用 |
| `INTERNAL` | 500 | 服务内部错误 |

## 调用方约束

- 所有请求 message 携带审计字段:`trace_id` / `user_id` / `user_name` / `user_ip` / `request_method` / `request_url`(gateway 从 JWT 透传,用于写 logs 表)
- 复核操作需 ADMIN / DATA_REVIEWER 角色(由 gateway RoleAuth 校验)
