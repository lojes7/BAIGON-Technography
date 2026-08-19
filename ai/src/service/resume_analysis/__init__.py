"""简历结构化抽取。"""

from src.service.resume_analysis.analyzer import (
    RESUME_ANALYSIS_SYSTEM_PROMPT,
    analyze_resume,
)
from src.service.resume_analysis.models import (
    MAX_RESUME_CONTENT_LENGTH,
    ResumeAnalysisResult,
)

__all__ = [
    "MAX_RESUME_CONTENT_LENGTH",
    "RESUME_ANALYSIS_SYSTEM_PROMPT",
    "ResumeAnalysisResult",
    "analyze_resume",
]
