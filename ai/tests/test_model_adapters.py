"""模型适配器单元测试：所有外部请求均由假客户端替代。"""

import unittest
from types import SimpleNamespace

import numpy as np

from src.config import model_config
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


class FakeFunctionCompletions:
    """模拟星火按要求调用指定结构化函数。"""

    def __init__(self, arguments: str, function_name: str = "submit_analysis"):
        self.arguments = arguments
        self.function_name = function_name
        self.request = None

    def create(self, **kwargs):
        self.request = kwargs
        message = SimpleNamespace(
            content="",
            tool_calls=[
                SimpleNamespace(
                    type="function",
                    function=SimpleNamespace(
                        name=self.function_name,
                        arguments=self.arguments,
                    ),
                )
            ],
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


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
    def test_embedding_model_only_exposes_batch_generation(self):
        """单条文本也必须通过一元素列表调用批量接口。"""
        model = TextEmbedding(api_key="test", client=SimpleNamespace())

        self.assertFalse(hasattr(model, "embedding"))

    def test_spark_model_uses_provider_model_id(self):
        """防止把产品名称 Spark-X2-Flash 误当成供应商 model 参数。"""
        self.assertEqual(model_config.spark_model, "spark-x")

    def test_spark_model_uses_openai_compatible_parameters(self):
        completions = FakeChatCompletions()
        client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        model = SparkModel(api_password="test", client=client)

        answer = model.question("系统提示", "用户问题", enable_web_search=True)

        self.assertEqual(answer, "模型回答")
        self.assertEqual(completions.request["model"], model_config.spark_model)
        self.assertEqual(completions.request["messages"][0]["role"], "system")
        self.assertEqual(completions.request["tools"][0]["type"], "web_search")
        self.assertEqual(
            completions.request["timeout"], model_config.provider_default_timeout_seconds
        )

    def test_embedding_batch_restores_input_order(self):
        client = SimpleNamespace(embeddings=FakeEmbeddings())
        model = TextEmbedding(api_key="test", client=client)

        vectors = model.embedding_batch(["第一条", "第二条"], dimensions=2)

        np.testing.assert_array_equal(vectors, np.array([[1.0, 0.0], [0.0, 1.0]]))

    def test_spark_model_forces_function_and_returns_arguments(self):
        completions = FakeFunctionCompletions('{"education":"Master","skills":[]}')
        client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        model = SparkModel(api_password="test", client=client)
        response_function = {
            "name": "submit_analysis",
            "description": "提交分析结果",
            "parameters": {"type": "object", "properties": {}},
        }

        arguments = model.question(
            "系统提示",
            "JD 原文",
            temperature=0.1,
            response_function=response_function,
        )

        self.assertEqual(arguments, '{"education":"Master","skills":[]}')
        self.assertEqual(completions.request["messages"][1]["content"], "JD 原文")
        self.assertEqual(completions.request["tools"][0]["function"], response_function)
        self.assertEqual(
            completions.request["tool_choice"],
            {"type": "function", "name": "submit_analysis"},
        )

    def test_spark_model_rejects_unexpected_function(self):
        completions = FakeFunctionCompletions("{}", function_name="other_function")
        client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        model = SparkModel(api_password="test", client=client)

        with self.assertRaisesRegex(RuntimeError, "非预期函数"):
            model.question(
                "系统提示",
                "JD 原文",
                response_function={
                    "name": "submit_analysis",
                    "parameters": {"type": "object"},
                },
            )

    def test_cosine_similarity_handles_zero_vector(self):
        similarity = TextEmbedding.cosine_sim(np.array([0.0, 0.0]), np.array([1.0, 0.0]))

        self.assertEqual(similarity, 0.0)
