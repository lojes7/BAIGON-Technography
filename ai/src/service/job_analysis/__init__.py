"""岗位描述结构化分析。"""

from src.service.job_analysis.analyzer import (
    MAX_JD_LENGTH,
    JobAnalysisResult,
    SkillAnalysis,
    analyze_job_description,
)

__all__ = [
    "MAX_JD_LENGTH",
    "JobAnalysisResult",
    "SkillAnalysis",
    "analyze_job_description",
]
