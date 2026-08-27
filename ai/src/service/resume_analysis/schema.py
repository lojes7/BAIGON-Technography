"""星火 Function Calling 使用的简历 JSON Schema。"""

from src.service.resume_analysis.models import (
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_RESUME_ITEMS,
)

DATE_SCHEMA = {
    "type": "string",
    "pattern": r"^(?:|\d{4}(?:-\d{2}(?:-\d{2})?)?)$",
    "description": (
        "按原文精度使用 YYYY、YYYY-MM 或 YYYY-MM-DD；原文没有日期时为空字符串，"
        "原文使用点号或斜杠时仅将分隔符替换为连字符，"
        "不得补写原文缺失的月份或日期。"
    ),
}
NAME_SCHEMA = {"type": "string", "maxLength": MAX_NAME_LENGTH}
DESCRIPTION_SCHEMA = {
    "type": "string",
    "maxLength": MAX_DESCRIPTION_LENGTH,
    "description": "逐行复制原文描述并保留条目边界，不得概括、改写或补写。",
}


def object_array(properties: dict[str, dict], required: list[str]) -> dict:
    """构造字段完整、禁止扩展的对象数组 Schema。"""
    return {
        "type": "array",
        "maxItems": MAX_RESUME_ITEMS,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "required": required,
            "properties": properties,
        },
    }


RESUME_ANALYSIS_RESPONSE_FUNCTION = {
    "name": "submit_resume_analysis",
    "description": "提交只从简历原文逐字抽取的结构化结果。",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "education_experience",
            "work_experience",
            "project_experience",
            "professional_skills",
            "awards",
        ],
        "properties": {
            "education_experience": object_array(
                {
                    "major": NAME_SCHEMA,
                    "university_name": NAME_SCHEMA,
                    "start_date": DATE_SCHEMA,
                    "end_date": DATE_SCHEMA,
                    "description": DESCRIPTION_SCHEMA,
                },
                [
                    "major",
                    "university_name",
                    "start_date",
                    "end_date",
                    "description",
                ],
            ),
            "work_experience": object_array(
                {
                    "occupation_name": NAME_SCHEMA,
                    "company": NAME_SCHEMA,
                    "start_date": DATE_SCHEMA,
                    "end_date": DATE_SCHEMA,
                    "description": DESCRIPTION_SCHEMA,
                },
                [
                    "occupation_name",
                    "company",
                    "start_date",
                    "end_date",
                    "description",
                ],
            ),
            "project_experience": object_array(
                {
                    "project_name": NAME_SCHEMA,
                    "start_date": DATE_SCHEMA,
                    "end_date": DATE_SCHEMA,
                    "description": DESCRIPTION_SCHEMA,
                },
                ["project_name", "start_date", "end_date", "description"],
            ),
            "professional_skills": object_array(
                {
                    "skill_name": NAME_SCHEMA,
                    "proficiency": {
                        "type": "string",
                        "enum": ["", "Basic", "Familiar", "Advanced", "Expert"],
                    },
                },
                ["skill_name", "proficiency"],
            ),
            "awards": object_array(
                {
                    "award_name": NAME_SCHEMA,
                    "date": DATE_SCHEMA,
                    "description": DESCRIPTION_SCHEMA,
                },
                ["award_name", "date", "description"],
            ),
        },
    },
}
