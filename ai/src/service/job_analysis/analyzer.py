"""岗位描述分析契约与业务函数。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.config import model_config
from src.llm.exceptions import ModelResponseError
from src.llm.spark_model import SparkModel
from src.service.analysis_result import LLMAnalysisResult

MAX_JD_LENGTH = 50_000

JOB_ANALYSIS_SYSTEM_PROMPT = """
你是严谨的岗位描述（JD）分析器。请只分析用户消息中的 JD，并调用指定函数提交结果。

输出要求：
1. skills 必须完整覆盖 JD 中明确提到的每一项技能，不得遗漏，也不得凭空补充。
2. 技能不限于专业技术：编程语言、框架、工具和软件、办公软件、设备操作、业务知识、方法论、语言能力、沟通协作及管理能力等，只要 JD 将其表述为任职能力或工作中需要使用的能力，都应抽取。例如“能够使用 MS Word”应抽取为一项技能。
3. 职责描述中的技能同样必须抽取；若一句话同时提到多个不同技能或工具，应拆成多项，不要合并成一个笼统名称。同一技能的重复表述则只返回一次。
4. 每个 name 优先使用简洁的中文技能名称。技术或产品专名可保留，例如“RAG”做为一个技术专有名词，可以使用英文。
5. 每个技能必须给出 name、proficiency 和 evidence，evidence 必须直接填写 JD 原文片段，不得概括，不得在首尾添加字符。
6. 不要把学历、工作年限、岗位名称、工作地点、薪资福利或单纯的性格形容词当作技能。
7. proficiency 只能按以下标准选择：
   - EXPERT：JD 明确要求精通、专家级、深度掌握，或能够主导架构及复杂项目。
   - ADVANCED：JD 明确要求熟练掌握、独立完成生产级工作，或具有丰富实践经验。
   - FAMILIAR：JD 明确要求熟悉、具有使用经验，或能够在工作中应用。
   - BASIC：JD 仅要求了解、基础知识，或只提到技能名称而没有熟练度依据。
8. JD 未包含任何可识别技能时返回空 skills 数组。
9. 不要输出 education 或其他字段；不要输出解释、Markdown 或普通正文，只能调用指定函数。
""".strip()

JOB_ANALYSIS_RESPONSE_FUNCTION = {
    "name": "submit_job_description_analysis",
    "description": "提交完整且经过结构化的岗位技能分析结果。",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["skills"],
        "properties": {
            "skills": {
                "type": "array",
                "description": "JD 中明确提到的全部技能；不同技能分别列出，不得遗漏。",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["name", "proficiency", "evidence"],
                    "properties": {
                        "name": {
                            "type": "string",
                            "minLength": 1,
                            "description": "优先中文技能名称；技术或产品专名可保留英文。",
                        },
                        "proficiency": {
                            "type": "string",
                            "enum": ["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"],
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
    proficiency: Literal["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"]
    evidence: str = Field(min_length=1, max_length=1_000)


class JobAnalysisResult(BaseModel):
    """JD 分析的固定返回结构。"""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    skills: list[SkillAnalysis]

    @model_validator(mode="after")
    def validate_unique_skills(self) -> "JobAnalysisResult":
        """拒绝重复技能，避免调用方收到含义相同的多条结果。"""
        names = [skill.name.casefold() for skill in self.skills]
        if len(names) != len(set(names)):
            raise ValueError("skills 不能包含重复技能")
        return self


def analyze_job_description(
    chat_model: SparkModel, jd: str
) -> LLMAnalysisResult[JobAnalysisResult]:
    """把 JD 作为唯一用户消息发送给星火，并严格校验函数参数。"""
    normalized_jd = jd.strip()
    if not normalized_jd:
        raise ValueError("jd 不能为空")
    if len(normalized_jd) > MAX_JD_LENGTH:
        raise ValueError(f"jd 长度不能超过 {MAX_JD_LENGTH} 个字符")

    response = chat_model.question(
        JOB_ANALYSIS_SYSTEM_PROMPT,
        normalized_jd,
        temperature=0.1,
        max_tokens=4096,
        response_function=JOB_ANALYSIS_RESPONSE_FUNCTION,
        # 长 JD 的结构化分析使用独立期限，不能沿用普通问答的 25 秒。
        timeout_seconds=model_config.provider_job_analysis_timeout_seconds,
    )
    # 供应商输出不可信：失败时仍保留原始响应供任务审查。
    try:
        result = JobAnalysisResult.model_validate_json(response.output)
    except ValueError as exception:
        raise ModelResponseError(
            "JD 分析响应校验失败", response.source_llm_response
        ) from exception
    return LLMAnalysisResult(result, response.source_llm_response)
