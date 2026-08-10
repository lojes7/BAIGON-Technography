"""模型适配器单元测试：所有外部请求均由假客户端替代。"""

import unittest
from types import SimpleNamespace

import numpy as np

from src.llm.embedding_model import TextEmbedding
from src.llm.spark_model import SparkModel


class FakeChatCompletions:
    """记录星火请求参数并返回固定文本。"""

    def __init__(self):
        self.request = None

    def create(self, **kwargs):
        self.request = kwargs
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="模型回答"))]
        )


class FakeEmbeddings:
    """模拟乱序返回，用于验证适配器会按 index 排序。"""

    def create(self, **kwargs):
        return SimpleNamespace(
            model_dump=lambda: {
                "data": [
                    {"index": 1, "embedding": [0.0, 1.0]},
                    {"index": 0, "embedding": [1.0, 0.0]},
                ]
            }
        )


class ModelAdapterTest(unittest.TestCase):
    def test_spark_model_uses_openai_compatible_parameters(self):
        completions = FakeChatCompletions()
        client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        model = SparkModel(api_password="test", client=client)

        answer = model.question("系统提示", "用户问题", enable_web_search=True)

        self.assertEqual(answer, "模型回答")
        self.assertEqual(completions.request["model"], "spark-x")
        self.assertEqual(completions.request["messages"][0]["role"], "system")
        self.assertEqual(completions.request["tools"][0]["type"], "web_search")

    def test_embedding_batch_restores_input_order(self):
        client = SimpleNamespace(embeddings=FakeEmbeddings())
        model = TextEmbedding(api_key="test", client=client)

        vectors = model.embedding_batch(["第一条", "第二条"], dimensions=2)

        np.testing.assert_array_equal(vectors, np.array([[1.0, 0.0], [0.0, 1.0]]))

    def test_cosine_similarity_handles_zero_vector(self):
        similarity = TextEmbedding.cosine_sim(np.array([0.0, 0.0]), np.array([1.0, 0.0]))

        self.assertEqual(similarity, 0.0)
