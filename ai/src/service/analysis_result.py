"""跨 LLM 分析领域共享的已校验结果封装。"""

from dataclasses import dataclass
from typing import Generic, TypeVar


AnalysisValue = TypeVar("AnalysisValue")


@dataclass(frozen=True, slots=True)
class LLMAnalysisResult(Generic[AnalysisValue]):
    """同时保留已校验业务结果和未经加工的模型原始响应。"""

    value: AnalysisValue
    source_llm_response: str
