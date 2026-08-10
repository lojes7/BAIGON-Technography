# 百工谱 — ai_service gRPC 服务端实现

import logging
from typing import Any

import grpc

from src.config import model_config
from src.llm.exceptions import ModelConfigurationError
from src.pb import ai_pb2, ai_pb2_grpc
from src.service.model_service import AIModelService

logger = logging.getLogger(__name__)

# 当前 Qwen 嵌入模型的默认输出维度，建库和检索必须保持一致。
DEFAULT_DIMENSIONS = model_config.embedding_default_dimensions
DEFAULT_CHUNK_SIZE = model_config.embedding_default_chunk_size
MAX_BATCH_SIZE = model_config.embedding_max_batch_size
MAX_CHUNK_SIZE = model_config.embedding_max_chunk_size


class AIServicer(ai_pb2_grpc.AIServiceServicer):
    """AIService gRPC 实现：当前提供 Qwen 文本向量能力。"""

    def __init__(self, model_service: AIModelService | Any | None = None):
        # 支持注入,在不调用外部模型的情况下测试 Handler。
        self.model_service = model_service or AIModelService()

    def EmbedText(self, request, context):
        """调用 Qwen 生成单条文本的嵌入向量。"""
        text = request.text.strip()
        if not text:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "text 不能为空")

        dimensions = request.dimensions or DEFAULT_DIMENSIONS
        self._validate_dimensions(dimensions, context)

        try:
            vector = self.model_service.embed_text(text, dimensions=dimensions)
            values = self._vector_values(vector)
            self._validate_vector_dimensions(values, dimensions)
            logger.info("EmbedText 完成: trace_id=%s, dimensions=%d", request.trace_id, dimensions)
            return ai_pb2.EmbedTextResponse(
                embedding=values,
                dimensions=len(values),
                model=self.model_service.embedding_model.model_name,
            )
        except ModelConfigurationError:
            logger.exception("EmbedText 失败：Qwen 嵌入模型未配置, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "嵌入模型未配置")
        except Exception:
            logger.exception("EmbedText 失败, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.INTERNAL, "嵌入服务暂不可用")

    def BatchEmbedText(self, request, context):
        """调用 Qwen 分批生成文本嵌入向量，结果与输入顺序一一对应。"""
        texts = list(request.texts)
        if not texts:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 不能为空")
        if len(texts) > MAX_BATCH_SIZE:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 数量超过上限")
        if any(not text.strip() for text in texts):
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 不能包含空文本")

        dimensions = request.dimensions or DEFAULT_DIMENSIONS
        chunk_size = request.chunk_size or DEFAULT_CHUNK_SIZE
        self._validate_dimensions(dimensions, context)
        if not 1 <= chunk_size <= MAX_CHUNK_SIZE:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "chunk_size 不在允许范围内")

        try:
            matrix = self.model_service.embed_texts(
                texts,
                dimensions=dimensions,
                chunk_size=chunk_size,
            )
            if len(matrix) != len(texts):
                raise RuntimeError("嵌入向量数量与输入文本数量不一致")

            embeddings = []
            for vector in matrix:
                values = self._vector_values(vector)
                self._validate_vector_dimensions(values, dimensions)
                embeddings.append(ai_pb2.EmbeddingVector(values=values))

            logger.info(
                "BatchEmbedText 完成: trace_id=%s, count=%d, dimensions=%d",
                request.trace_id,
                len(texts),
                dimensions,
            )
            return ai_pb2.BatchEmbedTextResponse(
                embeddings=embeddings,
                dimensions=dimensions,
                model=self.model_service.embedding_model.model_name,
            )
        except ModelConfigurationError:
            logger.exception("BatchEmbedText 失败：Qwen 嵌入模型未配置, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "嵌入模型未配置")
        except Exception:
            logger.exception("BatchEmbedText 失败, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.INTERNAL, "嵌入服务暂不可用")

    @staticmethod
    def _validate_dimensions(dimensions: int, context) -> None:
        """限制客户端传入的向量维度，避免异常的大响应占用 gRPC 资源。"""
        if not 1 <= dimensions <= model_config.embedding_max_dimensions:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "dimensions 不在允许范围内")

    @staticmethod
    def _vector_values(vector: Any) -> list[float]:
        """将 NumPy 向量转换为 protobuf 的 float 字段。"""
        return [float(value) for value in vector]

    @staticmethod
    def _validate_vector_dimensions(values: list[float], dimensions: int) -> None:
        """供应商返回维度不符合请求时中止响应，避免脏向量入库。"""
        if len(values) != dimensions:
            raise RuntimeError(
                f"嵌入接口返回维度异常：期望 {dimensions}，实际 {len(values)}"
            )
