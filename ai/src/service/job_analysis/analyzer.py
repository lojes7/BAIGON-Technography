"""岗位描述分析契约与业务函数。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.llm.spark_model import SparkModel

MAX_JD_LENGTH = 50_000

JOB_ANALYSIS_SYSTEM_PROMPT = """
你是严谨的岗位描述（JD）分析器。请只分析用户消息中的 JD，并调用指定函数提交结果。

输出要求：
1. education 表示 JD 明确要求的最低学历，使用简洁的英文学历名称；未说明时返回 Unspecified。
2. skills 只包含 JD 中有文字依据的专业或技术技能，不得凭空补充技能。
3. 每个技能必须给出 name、proficiency 和 evidence，evidence 必须引用或忠实概括 JD 中的依据。
4. 同一技能只返回一次；不要把学历、工作年限、岗位职责或泛化性格描述当作技能。
5. proficiency 只能按以下标准选择：
   - Expert：JD 明确要求精通、专家级、深度掌握，或能够主导架构及复杂项目。
   - Advanced：JD 明确要求熟练掌握、独立完成生产级工作，或具有丰富实践经验。
   - Familiar：JD 明确要求熟悉、具有使用经验，或能够在工作中应用。
   - Basic：JD 仅要求了解、基础知识，或只提到技能名称而没有熟练度依据。
6. JD 未包含任何可识别技能时返回空 skills 数组。
7. 不要输出解释、Markdown 或普通正文，只能调用指定函数。
""".strip()

JOB_ANALYSIS_RESPONSE_FUNCTION = {
    "name": "submit_job_description_analysis",
    "description": "提交严格结构化的岗位学历与技能分析结果。",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["education", "skills"],
        "properties": {
            "education": {
                "type": "string",
                "minLength": 1,
                "description": "JD 的最低学历要求；未说明时为 Unspecified。",
            },
            "skills": {
                "type": "array",
                "maxItems": 100,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["name", "proficiency", "evidence"],
                    "properties": {
                        "name": {"type": "string", "minLength": 1},
                        "proficiency": {
                            "type": "string",
                            "enum": ["Expert", "Advanced", "Familiar", "Basic"],
                        },
                        "evidence": {"type": "string", "minLength": 1},
                    },
                },
            },
        },
    },
}


class SkillAnalysis(BaseModel):
    """单项技能及其 JD 依据。"""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    proficiency: Literal["Expert", "Advanced", "Familiar", "Basic"]
    evidence: str = Field(min_length=1, max_length=1_000)


class JobAnalysisResult(BaseModel):
    """JD 分析的固定返回结构。"""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    education: str = Field(min_length=1, max_length=100)
    skills: list[SkillAnalysis] = Field(max_length=100)

    @model_validator(mode="after")
    def validate_unique_skills(self) -> "JobAnalysisResult":
        """拒绝重复技能，避免调用方收到含义相同的多条结果。"""
        names = [skill.name.casefold() for skill in self.skills]
        if len(names) != len(set(names)):
            raise ValueError("skills 不能包含重复技能")
        return self


def analyze_job_description(chat_model: SparkModel, jd: str) -> JobAnalysisResult:
    """把 JD 作为唯一用户消息发送给星火，并严格校验函数参数。"""
    normalized_jd = jd.strip()
    if not normalized_jd:
        raise ValueError("jd 不能为空")
    if len(normalized_jd) > MAX_JD_LENGTH:
        raise ValueError(f"jd 长度不能超过 {MAX_JD_LENGTH} 个字符")

    arguments = chat_model.question(
        JOB_ANALYSIS_SYSTEM_PROMPT,
        normalized_jd,
        temperature=0.1,
        max_tokens=4096,
        response_function=JOB_ANALYSIS_RESPONSE_FUNCTION,
    )
    # 供应商输出不可信：只有通过 Pydantic 契约后才能返回给调用方。
    return JobAnalysisResult.model_validate_json(arguments)
