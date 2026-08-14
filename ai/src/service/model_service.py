"""对话模型与嵌入模型的统一业务入口。"""

from typing import Any

import numpy as np

from src.llm.embedding_model import TextEmbedding
from src.llm.spark_model import SparkModel
from src.service.job_analysis import JobAnalysisResult, analyze_job_description


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

    def analyze_job_description(self, jd: str) -> JobAnalysisResult:
        """分析 JD，成功时只返回经过固定契约校验的结果。"""
        return analyze_job_description(self.chat_model, jd)

    def embed_texts(self, texts: list[str | None], **options: Any) -> np.ndarray:
        """批量生成文本向量。"""
        return self.embedding_model.embedding_batch(texts, **options)
