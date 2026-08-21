"""用户简历与岗位匹配分析。"""

from src.service.job_match.analyzer import (
    JOB_MATCH_RESPONSE_FUNCTION,
    JOB_MATCH_SYSTEM_PROMPT,
    JobMatchProfile,
    JobMatchResult,
    ResumeMatchProfile,
    SkillLearningSuggestion,
    analyze_job_match,
)

__all__ = [
    "JOB_MATCH_RESPONSE_FUNCTION",
    "JOB_MATCH_SYSTEM_PROMPT",
    "JobMatchProfile",
    "JobMatchResult",
    "ResumeMatchProfile",
    "SkillLearningSuggestion",
    "analyze_job_match",
]
