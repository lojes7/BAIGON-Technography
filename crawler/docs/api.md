# 百工谱 — crawler_service

## 职责

多源数据采集服务。核心:

- **真实爬虫**:DrissionPage(Chromium 自动化)爬智联招聘,监听 `search/positions` 网络接口拿 JSON
- **增量检测**:每次任务所有分类从第 1 页开始;跨分类去重文件 `seen_numbers.txt`(job_number 稳定 ID 集合)保证不重复——去重集合即增量基线,集合里没有的就是新职位
- **后台异步**:`Crawl` 启动后台线程立即返回;`GetCrawlStatus` 查进度;`StopCrawl` 立即停止
- **清洗链路**:爬取 → 写 job_sources(PENDING)→ 清洗 → SUCCESS → Kafka 事件发 data-source
- **每条记录独立 trace_id**:爬虫生成时赋雪花 ID,不批量共享(job_sources 有 trace_id 唯一索引)
- **发布时间诚实处理**:解析失败存 NULL,不伪造当前时间

### 配置（`src/config/` 包）

| 文件 | 内容 |
|------|------|
| `job_list.py` | 分类 → 智联搜索 URL（16 个岗位分类） |
| `city_mapping.py` | 城市 → 省份映射 + get_province() |

改分类/城市映射不动爬虫代码。爬取参数（categories / max_documents）由 ADMIN 前端传参。

## gRPC 接口

### Crawl — 启动采集（异步）

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.crawler.CrawlerService/Crawl` |
| **对应 REST** | `POST /api/auth/crawl`（仅 ADMIN） |

**请求 — CrawlRequest**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 采集类型，目前仅支持 `JOB` |
| `categories` | repeated string | 否 | 要爬的岗位分类（ADMIN 前端配置），空=全部 16 个 |
| `pages_per_category` | int32 | 否 | 每分类最大页数，默认 5 |
| `max_documents` | int32 | 否 | 单分类最大条数，默认 1000 |
| `trace_id` / `user_id` / `user_name` / `user_ip` / `request_method` / `request_url` | — | 是 | 审计字段（gateway 透传） |

**响应 — CrawlResponse**（异步，立即返回）

```json
{ "code": 200, "data": { "count": "0", "trace_id": "...", "status": "running" } }
```

### GetCrawlStatus — 查询采集状态

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.crawler.CrawlerService/GetCrawlStatus` |
| **对应 REST** | `GET /api/auth/crawl` |

响应字段:

| 字段 | 说明 |
|------|------|
| `status` | idle / running / **stopping** / success / failed / stopped |
| `count` | 最近一次采集数量 |
| `message` | 附加信息（如失败原因） |
| `current_category` | 正在爬取的分类 |
| `progress` | 当前分类已完成页数 |
| `total_cleaned` | 累计清洗条数 |

### StopCrawl — 停止采集（立即生效）

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.crawler.CrawlerService/StopCrawl` |
| **对应 REST** | `DELETE /api/auth/crawl` |

设置停止信号,后台线程**立即中断**(不等当前页爬完):翻页/请求前检查、CDP fetch 用短超时(6s)后检查。已抓到的数据照常入库不丢,然后状态置 `stopped`。

### IngestData — 模拟采集（注入配置数据）

| 项目 | 内容 |
|------|------|
| **Full Method** | `/baigon.crawler.CrawlerService/IngestData` |
| **对应 REST** | `POST /api/auth/crawl/ingest`（仅 ADMIN） |

不真爬,由 ADMIN 提交配置好的岗位数据,**走与爬虫完全相同的流程**:写 job_sources → 清洗 → Kafka → data-source 落库。

**请求 — IngestDataRequest**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `jobs` | repeated IngestedJob | 是 | 注入的岗位数据（1~1000 条） |

`IngestedJob` 字段与爬虫产出的 JobRecord 完全一致:publish_date(ISO,可空)/ source_platform / source_url / city / tags / major / nature / salary / job_name / company_name / company_size / province / education / experience / job_description。

**响应**:`count`(注入并清洗条数)/ `trace_id` / `status`(success)。

**约束**:jobs 非空、≤ 1000 条;仅 ADMIN 可访问。

## 爬虫机制

### 支持分类（16 个）

人工智能 / 大数据 / 智能系统 / 物联网 / 云计算 / 自动化 / 后端开发 / 前端开发 / 测试软件 / 网络运维 / 嵌入式软件 / 数据挖掘 / 机器学习 / 硬件测试 / 计算机视觉 / 数据库工程师

### 字段映射（智联 JSON → job_sources）

| 智联字段 | job_sources 列 |
|----------|----------------|
| `name` | job_name |
| `salary60` | salary |
| `companyName` | company_name |
| `workCity` + 城市映射 | city / province |
| `workingExp` | experience |
| `education` | education |
| `industryName` | major |
| `companySize` | company_size |
| `propertyName` | nature |
| 描述（列表 DESC_FIELDS 或 CDP 详情页兜底） | job_description |
| 详情页技能标签 | tags |
| `firstPublishTime` | publish_date |
| 详情 URL | source_url |
| 固定 | source_platform = "智联招聘" |

### 关键文件

- `src/service/zhaopin_crawler.py` — 爬虫核心（迁移自 demo）
- 去重文件目录:`CRAWLER_PROGRESS_DIR`（默认 ./data，容器卷持久化，跨任务生效）

## 错误码（gRPC → HTTP）

| gRPC Status | HTTP | 场景 |
|-------------|------|------|
| `INVALID_ARGUMENT` | 400 | type 非 JOB |
| `FAILED_PRECONDITION` | 403 | 已有采集任务在运行 |
| `UNAVAILABLE` | 503 | crawler 服务不可用 |
| `INTERNAL` | 500 | 爬取异常 |

## 调用方约束

- 所有请求携带审计字段（gateway 从 JWT 透传，写 logs 表）
- 采集操作需 ADMIN 角色（gateway RoleAuth 校验）
- 爬取参数（categories / pages_per_category / max_documents）由 ADMIN 前端直接传参，不用配置文件
