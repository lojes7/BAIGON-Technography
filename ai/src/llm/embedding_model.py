"""阿里云百炼文本嵌入模型适配器。"""

from typing import Any

import numpy as np
from openai import OpenAI

from src.config import config
from src.llm.exceptions import ModelConfigurationError

class TextEmbedding:
    """调用百炼 OpenAI 兼容接口生成文本向量并计算相似度。"""

    DEFAULT_DIMENSION = 1024

    def __init__(
        self,
        model_name: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        client: OpenAI | Any | None = None,
    ):
        self.model_name = model_name or config.embedding_model
        self.api_key = api_key if api_key is not None else config.dashscope_api_key
        self.base_url = base_url or config.dashscope_base_url
        # 与对话模型一致，延迟连接可让无凭据的健康检查正常工作。
        self._client = client

    def _get_client(self) -> OpenAI | Any:
        """获取嵌入客户端，并在实际调用前校验 API 密钥。"""
        if self._client is not None:
            return self._client
        if not self.api_key:
            raise ModelConfigurationError("未配置 DASHSCOPE_API_KEY")

        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def embedding(
        self,
        text: str,
        dimensions: int = DEFAULT_DIMENSION,
        encoding_format: str = "float",
    ) -> np.ndarray:
        """生成单条文本向量。"""
        if not isinstance(text, str):
            raise TypeError("text 必须是字符串")
        result = self._create_embeddings([text], dimensions, encoding_format)
        return np.asarray(result[0], dtype=float)

    def embedding_batch(
        self,
        input_list: list[str | None],
        dimensions: int = DEFAULT_DIMENSION,
        encoding_format: str = "float",
        chunk_size: int = 20,
    ) -> np.ndarray:
        """分批生成向量，返回顺序严格与输入文本顺序一致。"""
        if dimensions <= 0:
            raise ValueError("dimensions 必须大于 0")
        if chunk_size <= 0:
            raise ValueError("chunk_size 必须大于 0")
        if not input_list:
            return np.empty((0, dimensions), dtype=float)

        all_embeddings: list[list[float]] = []
        for start in range(0, len(input_list), chunk_size):
            # 保持输入与结果一一对应，None 统一转为空文本。
            texts = ["" if text is None else str(text) for text in input_list[start : start + chunk_size]]
            all_embeddings.extend(self._create_embeddings(texts, dimensions, encoding_format))

        return np.asarray(all_embeddings, dtype=float)

    def _create_embeddings(
        self,
        texts: list[str],
        dimensions: int,
        encoding_format: str,
    ) -> list[list[float]]:
        """调用接口，并按供应商返回的 index 恢复原始顺序。"""
        if dimensions <= 0:
            raise ValueError("dimensions 必须大于 0")
        response = self._get_client().embeddings.create(
            model=self.model_name,
            input=texts,
            dimensions=dimensions,
            encoding_format=encoding_format,
        )
        data = response.model_dump()["data"]
        sorted_data = sorted(data, key=lambda item: item["index"])
        if len(sorted_data) != len(texts):
            raise RuntimeError("嵌入接口返回数量与输入数量不一致")
        return [item["embedding"] for item in sorted_data]

    @staticmethod
    def cosine_sim(vec1: np.ndarray, vec2: np.ndarray) -> float:
        """计算两个向量的余弦相似度；零向量的相似度固定为 0。"""
        norm_product = np.linalg.norm(vec1) * np.linalg.norm(vec2)
        if norm_product == 0:
            return 0.0
        return float(np.dot(vec1, vec2) / norm_product)

    @staticmethod
    def cosine_batch(vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        """计算一个向量与矩阵每一行向量的余弦相似度。"""
        dot = matrix @ vec
        denominator = np.linalg.norm(vec) * np.linalg.norm(matrix, axis=1)
        return np.divide(dot, denominator, out=np.zeros_like(dot, dtype=float), where=denominator != 0)
