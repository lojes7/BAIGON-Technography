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
| `AnalyzeJobDescription` | 仅 `jd` | `skills`、内部审查字段 | 使用星火完整抽取技能，并返回强类型对象 |
| `AnalyzeResume` | 仅 OCR `content` | `resume_json`、内部审查字段 | 返回符合 `format.json` 且经过原文来源校验的 JSON |
| `AnalyzeUserSkills` | `resume_content`、审计字段 | `skills`、`model`、内部审查字段 | 提取有简历原文证据的用户技能 |
| `AnalyzeJobMatch` | `resume`、`job`、审计字段 | 分数、摘要、建议、`model`、内部审查字段 | 只使用五组结构化简历字段与 `jobs` 表公开字段完成人岗匹配 |
| `EmbedText` | `text`、可选 `dimensions` | 单条 `embedding` | 为一段非空文本生成 Qwen 向量 |
| `BatchEmbedText` | `texts`、可选 `dimensions` / `chunk_size` | `embeddings` | 批量生成向量，返回顺序严格对应输入顺序 |

- `dimensions=0` 时使用服务默认值 `1024`；允许范围为 `1` 至 `4096`。
- `chunk_size=0` 时批量请求使用默认值 `20`；允许范围为 `1` 至 `100`。
- 单次 `BatchEmbedText` 最多接收 `1000` 条非空文本。
- `AnalyzeUserSkills`、`AnalyzeJobMatch` 和两个嵌入请求均可携带
  `trace_id / user_id / user_name / user_ip / request_method / request_url`，
  供调用链审计使用。这些字段不会进入模型提示词。
- 四个对话模型 RPC 的响应都包含内部字段 `source_llm_response / error_code`。前者保存未经业务
  校验的供应商助手消息，后者为空表示成功；模型已经返回内容但未通过契约校验时返回
  `LLM_RESPONSE_INVALID`。调用方必须据此把已预先创建的分析任务标记为 `SUCCESS` 或 `FAILED`，
  且不得把原始响应暴露到公开 API。

`AnalyzeJobDescription` 与嵌入接口相互独立，请求严格只包含 `jd`。服务把 JD
直接作为星火调用的 user prompt，并使用固定 Function Calling Schema 约束模型输出。
模型返回的 JSON 先由 Pydantic 解析并校验，gRPC 层再将结果映射为
`repeated AnalyzedSkill skills`，不会向调用方返回 JSON 字符串：

```json
{
  "skills": [
    {
      "name": "JavaScript Web 开发",
      "proficiency": "EXPERT",
      "evidence": "能够使用 JavaScript 构建多个 Web 应用。"
    },
    {
      "name": "微软 Word 文档处理",
      "proficiency": "FAMILIAR",
      "evidence": "能够使用 MS Word 编写项目文档。"
    }
  ]
}
```

`AnalyzeJobDescription` 和 `AnalyzeUserSkills` 共用的 `AnalyzedSkill.proficiency`
仅允许 `EXPERT`、`ADVANCED`、`FAMILIAR`、`BASIC`。每个技能都必须
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
该接口与根目录 `format.json` 的既有契约保持一致，其 `proficiency` 仍使用
`Basic / Familiar / Advanced / Expert`，不受 `AnalyzedSkill` 全大写调整影响。

### 用户技能分析

`AnalyzeUserSkills` 使用当前用户最新简历的完整正文，返回技能、熟练度、原文证据和
服务端实际配置的模型名。调用方不能在请求中指定模型。服务会先用 Pydantic 拒绝额外字段、
非法熟练度、重复技能和超长结果，再确定性检查每条 `evidence` 是否能在归一化后的简历原文
中连续定位；任一证据无法回溯时整次调用失败，不返回部分结果。

```json
{
  "skills": [
    {
      "name": "Java",
      "proficiency": "ADVANCED",
      "evidence": "熟练使用 Java 开发后端服务"
    }
  ],
  "model": "spark-x"
}
```

技能分析日志只记录 `trace_id`、简历长度、技能数量和模型名，不记录简历正文或证据。

### 人岗匹配

`AnalyzeJobMatch.resume` 的 `ResumeMatchProfile` 只包含当前最新 `resumes` 记录的
`education_experiences`、`work_experiences`、`project_experiences`、
`professional_skills`、`awards` 五个 JSONB 数组。接口不接收也不读取可能为空的
`resumes.content`；五组结构化数据同时为空或结构不合法时拒绝请求。

`AnalyzeJobMatch.job` 的 `JobMatchProfile` 只包含以下 `jobs` 表公开业务字段：

`name`、`publish_date`、`source_platform`、`source_url`、`tags`、`major`、
`nature`、`salary`、`company_name`、`company_size`、`city`、`province`、
`education`、`experience`、`job_description`、`occupation_id`。

`occupation_id` 为空时传 `0`。请求没有 `job_analysis_results`、`job_skills`、职业详情、
`trace_id`（岗位来源字段）、`job_number` 或表审计时间等内容。AI 只比较本次请求中的结构化简历与
岗位快照，不读取岗位分析结果，也不联网。两份数据都按不可信数据处理，其中的提示词不能
覆盖系统规则；姓名、性别、年龄等无关属性不得影响分数。

```json
{
  "score": 82,
  "summary": "主要后端能力符合要求，但简历尚未证明容器编排实践。",
  "skills_to_learn": [
    {
      "skill_name": "Kubernetes",
      "reason": "岗位要求容器编排经验，简历没有相关证据。",
      "suggestion": "学习 Deployment 与 Service，并完成一次部署实践。"
    }
  ],
  "action_suggestions": [
    "在简历中补充可核验的部署项目成果。"
  ],
  "model": "spark-x"
}
```

`score` 必须是 `0` 至 `100` 的整数；摘要和每项建议均不能为空，技能建议按技能名去重，
行动建议在自身列表内去重。完全匹配时两个建议数组可以为空。日志只记录结构化简历条目数、建议数量、模型名和
`trace_id`，不记录简历字段、岗位正文、模型原始响应或具体建议。模型原始响应只写入调用方的
内部分析任务表。

## 实体链接流程


## 错误码
| 错误码 | 含义 |
|--------|------|
| `INVALID_ARGUMENT` | 文本为空、结构化简历或岗位无可分析信息、字段结构或长度非法、批量过大、维度或分批大小非法 |
| `FAILED_PRECONDITION` | 未配置对应接口需要的模型密钥 |
| `UNAVAILABLE` | 用户技能分析或人岗匹配的模型供应商暂时不可用 |
| 响应 `error_code=LLM_RESPONSE_INVALID` | 对话模型已返回内容，但输出不符合契约或证据无法回溯 |
| `INTERNAL` | 未预期的服务异常，或向量数量/维度异常 |

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
