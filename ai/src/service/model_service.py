"""对话模型与嵌入模型的统一业务入口。"""

from typing import Any

import numpy as np

from src.llm.embedding_model import TextEmbedding
from src.llm.spark_model import SparkModel


class AIModelService:
    """供后续 gRPC Handler 调用的模型服务门面。"""

    def __init__(
        self,
        chat_model: SparkModel | None = None,
        embedding_model: TextEmbedding | None = None,
    ):
        self.chat_model = chat_model or SparkModel()
        self.embedding_model = embedding_model or TextEmbedding()

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        **options: Any,
    ) -> str:
        """调用星火模型生成结构化抽取或普通文本结果。"""
        return self.chat_model.question(system_prompt, user_prompt, **options)

    def embed_text(self, text: str, **options: Any) -> np.ndarray:
        """生成单条文本向量。"""
        return self.embedding_model.embedding(text, **options)

    def embed_texts(self, texts: list[str | None], **options: Any) -> np.ndarray:
        """批量生成文本向量。"""
        return self.embedding_model.embedding_batch(texts, **options)
