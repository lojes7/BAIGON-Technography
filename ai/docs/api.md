# 百工谱 — ai_service

## 职责

AI 服务已接入以下内部模型适配器，供后续 gRPC Handler 调用：

| 能力 | 适配器 | 环境变量 |
| --- | --- | --- |
| 对话与结构化抽取 | `src.llm.SparkModel` | `SPARK_API_PASSWORD`、`SPARK_MODEL` |
| 文本嵌入与相似度 | `src.llm.TextEmbedding` | `DASHSCOPE_API_KEY`、`DASHSCOPE_EMBEDDING_MODEL` |

`src.service.AIModelService` 是两项能力的统一业务入口。模型客户端采用延迟初始化：健康检查不会校验凭据，首次模型调用时才会验证对应环境变量。

## gRPC 接口

## 实体链接流程


## 错误码
| 错误码 | 含义 |
|--------|------|

## 调用方约束
