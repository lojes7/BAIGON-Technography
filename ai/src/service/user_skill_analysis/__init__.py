"""用户简历技能分析。"""

from src.service.user_skill_analysis.analyzer import (
    MAX_USER_SKILLS,
    UserSkillAnalysisResult,
    analyze_user_skills,
)

__all__ = [
    "MAX_USER_SKILLS",
    "UserSkillAnalysisResult",
    "analyze_user_skills",
]
