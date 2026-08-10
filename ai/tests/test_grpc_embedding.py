"""EmbedText 与 BatchEmbedText 的 gRPC Handler 单元测试。"""

from types import SimpleNamespace
import unittest

import numpy as np

from src.pb import ai_pb2
from src.server.grpc_server import AIServicer, DEFAULT_DIMENSIONS


class FakeEmbeddingModel:
    """提供模型名，避免测试依赖真实 Qwen 配置。"""

    model_name = "qwen3.7-text-embedding"


class FakeAIModelService:
    """返回固定向量，验证 Handler 的请求转发和响应结构。"""

    embedding_model = FakeEmbeddingModel()

    def embed_text(self, text, **options):
        self.single_call = (text, options)
        if options["dimensions"] == DEFAULT_DIMENSIONS:
            return np.zeros(DEFAULT_DIMENSIONS, dtype=float)
        return np.array([0.1, 0.2], dtype=float)

    def embed_texts(self, texts, **options):
        self.batch_call = (texts, options)
        return np.array([[0.1, 0.2], [0.3, 0.4]], dtype=float)


class GrpcEmbeddingTest(unittest.TestCase):
    def setUp(self):
        self.service = FakeAIModelService()
        self.servicer = AIServicer(model_service=self.service)
        self.context = SimpleNamespace(abort=self.fail)

    def test_embed_text_returns_qwen_vector(self):
        response = self.servicer.EmbedText(
            ai_pb2.EmbedTextRequest(text="后端开发工程师", dimensions=2, trace_id="1001"),
            self.context,
        )

        # protobuf 的 float 为 32 位浮点，断言时保留合理的精度容差。
        self.assertAlmostEqual(response.embedding[0], 0.1, places=6)
        self.assertAlmostEqual(response.embedding[1], 0.2, places=6)
        self.assertEqual(response.dimensions, 2)
        self.assertEqual(response.model, "qwen3.7-text-embedding")
        self.assertEqual(self.service.single_call[0], "后端开发工程师")

    def test_embed_text_uses_1024_dimensions_by_default(self):
        response = self.servicer.EmbedText(
            ai_pb2.EmbedTextRequest(text="后端开发工程师", trace_id="1003"),
            self.context,
        )

        self.assertEqual(DEFAULT_DIMENSIONS, 1024)
        self.assertEqual(response.dimensions, 1024)
        self.assertEqual(len(response.embedding), 1024)
        self.assertEqual(self.service.single_call[1]["dimensions"], 1024)

    def test_batch_embed_text_preserves_order(self):
        response = self.servicer.BatchEmbedText(
            ai_pb2.BatchEmbedTextRequest(
                texts=["后端开发工程师", "数据分析师"],
                dimensions=2,
                chunk_size=2,
                trace_id="1002",
            ),
            self.context,
        )

        # 批量响应必须保持输入顺序；逐项用容差比较以适配 float32。
        vectors = [list(item.values) for item in response.embeddings]
        expected_vectors = [[0.1, 0.2], [0.3, 0.4]]
        for actual, expected in zip(vectors, expected_vectors, strict=True):
            for actual_value, expected_value in zip(actual, expected, strict=True):
                self.assertAlmostEqual(actual_value, expected_value, places=6)
        self.assertEqual(self.service.batch_call[0], ["后端开发工程师", "数据分析师"])


if __name__ == "__main__":
    unittest.main()
