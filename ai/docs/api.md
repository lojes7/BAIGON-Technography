# 百工谱 — ai_service

## 职责

AI 服务已接入以下内部模型适配器，供后续 gRPC Handler 调用：

| 能力 | 适配器 | 部署密钥 | 内部配置 |
| --- | --- | --- | --- |
| 对话与结构化抽取 | `src.llm.SparkModel` | `SPARK_API_PASSWORD` | `src/config.py` |
| 文本嵌入与相似度 | `src.llm.TextEmbedding` | `DASHSCOPE_API_KEY` | `src/config.py` |

`src.service.AIModelService` 是两项能力的统一业务入口。模型名称、模型地址、向量维度与批次限制是服务内部参数，统一放在 `src/config.py`，不由 Docker Compose 注入；API 密钥仍由部署环境提供。模型客户端采用延迟初始化：健康检查不会校验凭据，首次模型调用时才会验证对应环境变量。

## gRPC 接口

服务定义位于 `proto/ai/ai.proto`，当前已提供以下内部接口：

| RPC | 请求 | 返回 | 说明 |
| --- | --- | --- | --- |
| `AnalyzeJobDescription` | 仅 `jd` | `skills` 对象列表 | 使用星火完整抽取技能，并返回强类型对象 |
| `AnalyzeResume` | 仅 OCR `content` | `resume_json` | 返回符合 `format.json` 且经过原文来源校验的 JSON |
| `EmbedText` | `text`、可选 `dimensions` | 单条 `embedding` | 为一段非空文本生成 Qwen 向量 |
| `BatchEmbedText` | `texts`、可选 `dimensions` / `chunk_size` | `embeddings` | 批量生成向量，返回顺序严格对应输入顺序 |

- `dimensions=0` 时使用服务默认值 `1024`；允许范围为 `1` 至 `4096`。
- `chunk_size=0` 时批量请求使用默认值 `20`；允许范围为 `1` 至 `100`。
- 单次 `BatchEmbedText` 最多接收 `1000` 条非空文本。
- 两个嵌入请求均可携带 `trace_id` 和用户上下文字段，供调用链审计使用。

`AnalyzeJobDescription` 与嵌入接口相互独立，请求严格只包含 `jd`。服务把 JD
直接作为星火调用的 user prompt，并使用固定 Function Calling Schema 约束模型输出。
模型返回的 JSON 先由 Pydantic 解析并校验，gRPC 层再将结果映射为
`repeated AnalyzedSkill skills`，不会向调用方返回 JSON 字符串：

```json
{
  "skills": [
    {
      "name": "JavaScript Web 开发",
      "proficiency": "Expert",
      "evidence": "能够使用 JavaScript 构建多个 Web 应用。"
    },
    {
      "name": "微软 Word 文档处理",
      "proficiency": "Familiar",
      "evidence": "能够使用 MS Word 编写项目文档。"
    }
  ]
}
```

`proficiency` 仅允许 `Expert`、`Advanced`、`Familiar`、`Basic`。每个技能都必须
提供非空 `evidence`；`name` 优先使用中文，RAG 等技术或产品专名允许保留英文。
专业技术、办公软件、设备操作、业务知识、
方法论、语言、沟通协作和管理能力等均属于技能；同一句中的不同技能会拆分返回，
职责中的技能也不会忽略。学历不属于本接口的输出。

`AnalyzeResume` 只接收 OCR 原文，不接收文件、MinIO 地址或用户信息。模型返回值先经过
Pydantic 严格结构校验，再对每个非空名称、描述和日期执行确定性原文匹配；找不到来源的
字段会被清空，没有可确认身份字段的整条记录会被移除。熟练度只有在技能所在原文分句中
出现明确依据时才可填写，非空值只能是 `Basic`、`Familiar`、`Advanced`、`Expert`。
最终结果固定包含 `education_experience`、`work_experience`、`project_experience`、
`professional_skills`、`awards` 五个数组，缺失字段使用空字符串，缺失类别使用空数组。

## 实体链接流程


## 错误码
| 错误码 | 含义 |
|--------|------|
| `INVALID_ARGUMENT` | 文本为空、批量过大、维度或分批大小非法 |
| `FAILED_PRECONDITION` | 未配置对应接口需要的模型密钥 |
| `INTERNAL` | 模型调用失败、JD/简历输出不符合契约，或向量数量/维度异常 |

## 调用方约束

调用方应把相同的 `dimensions` 用于建库、写入和检索；否则向量库会拒绝维度不一致的向量。模型名由 `src/config.py` 统一配置，不能在单次 RPC 请求中任意切换。

## 根目录演示程序

先确保本地 AI stub 已生成且 AI 服务正在运行：

```bash
make -C proto python-ai
```

单独测试 JD 分析：

```bash
python ai_service_demo.py analyze-jd --jd-file ./sample-jd.txt
```

单独测试嵌入：

```bash
python ai_service_demo.py embed --text "Java 开发工程师"
```

单独测试简历分析：

```bash
python resume_analysis_demo.py --content-file ./sample-resume.txt
```

演示程序默认读取根目录 `.env` 的 `AI_GRPC_PORT`（当前为 `50013`，映射到容器内
`50053`）；需要其他地址时设置 `AI_GRPC_ADDR`。本地不经 Compose 直接启动 AI 服务时，
可设置 `AI_GRPC_ADDR=localhost:50053`。
