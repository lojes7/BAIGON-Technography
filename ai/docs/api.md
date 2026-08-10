# 百工谱 — ai_service

## 职责

AI 服务已接入以下内部模型适配器，供后续 gRPC Handler 调用：

| 能力 | 适配器 | 环境变量 |
| --- | --- | --- |
| 对话与结构化抽取 | `src.llm.SparkModel` | `SPARK_API_PASSWORD`、`SPARK_MODEL` |
| 文本嵌入与相似度 | `src.llm.TextEmbedding` | `DASHSCOPE_API_KEY`、`DASHSCOPE_EMBEDDING_MODEL` |

`src.service.AIModelService` 是两项能力的统一业务入口。模型客户端采用延迟初始化：健康检查不会校验凭据，首次模型调用时才会验证对应环境变量。

## gRPC 接口

服务定义位于 `proto/ai/ai.proto`，当前已提供以下内部接口：

| RPC | 请求 | 返回 | 说明 |
| --- | --- | --- | --- |
| `EmbedText` | `text`、可选 `dimensions` | 单条 `embedding` | 为一段非空文本生成 Qwen 向量 |
| `BatchEmbedText` | `texts`、可选 `dimensions` / `chunk_size` | `embeddings` | 批量生成向量，返回顺序严格对应输入顺序 |

- `dimensions=0` 时使用服务默认值 `1024`；允许范围为 `1` 至 `4096`。
- `chunk_size=0` 时批量请求使用默认值 `20`；允许范围为 `1` 至 `100`。
- 单次 `BatchEmbedText` 最多接收 `1000` 条非空文本。
- 两个请求均可携带 `trace_id` 和用户上下文字段，供调用链审计使用。

## 实体链接流程


## 错误码
| 错误码 | 含义 |
|--------|------|
| `INVALID_ARGUMENT` | 文本为空、批量过大、维度或分批大小非法 |
| `FAILED_PRECONDITION` | 未配置 `DASHSCOPE_API_KEY` |
| `INTERNAL` | Qwen 调用失败，或供应商返回的向量数量、维度异常 |

## 调用方约束

调用方应把相同的 `dimensions` 用于建库、写入和检索；否则向量库会拒绝维度不一致的向量。模型名由 `DASHSCOPE_EMBEDDING_MODEL` 统一配置，不能在单次 RPC 请求中任意切换。
