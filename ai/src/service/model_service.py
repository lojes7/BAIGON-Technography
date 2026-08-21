"""对话模型与嵌入模型的统一业务入口。"""

from typing import Any

import numpy as np

from src.llm.embedding_model import TextEmbedding
from src.llm.spark_model import SparkModel
from src.service.job_analysis import JobAnalysisResult, analyze_job_description
from src.service.job_match import (
    JobMatchProfile,
    JobMatchResult,
    ResumeMatchProfile,
    analyze_job_match,
)
from src.service.resume_analysis import ResumeAnalysisResult, analyze_resume
from src.service.user_skill_analysis import (
    UserSkillAnalysisResult,
    analyze_user_skills,
)


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

    def analyze_resume(self, content: str) -> ResumeAnalysisResult:
        """抽取简历字段，成功时只返回经过结构和来源校验的结果。"""
        return analyze_resume(self.chat_model, content)

    def analyze_user_skills(self, resume_content: str) -> UserSkillAnalysisResult:
        """抽取有简历原文证据的用户技能。"""
        return analyze_user_skills(self.chat_model, resume_content)

    def analyze_job_match(
        self,
        resume: ResumeMatchProfile,
        job: JobMatchProfile,
    ) -> JobMatchResult:
        """只使用简历结构化字段和 jobs 表字段完成人岗匹配。"""
        return analyze_job_match(self.chat_model, resume, job)

    @property
    def chat_model_name(self) -> str:
        """返回内部配置的对话模型名，不允许 RPC 请求覆盖。"""
        return self.chat_model.model_name

    def embed_texts(self, texts: list[str | None], **options: Any) -> np.ndarray:
        """批量生成文本向量。"""
        return self.embedding_model.embedding_batch(texts, **options)
