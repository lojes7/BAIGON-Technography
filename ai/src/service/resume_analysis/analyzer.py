"""简历结构化抽取业务编排。"""

import json

from src.config import model_config
from src.llm.exceptions import ModelResponseError
from src.llm.spark_model import SparkModel
from src.service.analysis_result import LLMAnalysisResult
from src.service.resume_analysis.grounding import ground_resume_analysis
from src.service.resume_analysis.models import (
    MAX_RESUME_CONTENT_LENGTH,
    ResumeAnalysisResult,
)
from src.service.resume_analysis.schema import RESUME_ANALYSIS_RESPONSE_FUNCTION

RESUME_ANALYSIS_SYSTEM_PROMPT = """
你是严格的简历字段抽取器。用户消息只包含 OCR 简历原文，你只能调用指定函数提交结果。

必须遵守：
1. 所有学校、专业、公司、岗位、项目、技能、奖项和描述都必须逐字复制自原文，禁止润色、概括、纠错、扩写或使用外部知识。
2. 不得根据学校、公司、岗位或项目名称推测其他字段，不得补写原文没有的信息。
3. 五个根数组必须全部返回；没有对应记录时返回空数组。
4. 每个对象的字段必须完整；原文找不到对应答案时填写空字符串，不得省略键或返回 null。
5. 日期只有在原文给出完整年月日时才可确定性转换为 YYYY-MM-DD；缺少年月日任一部分时填写空字符串。
6. proficiency 非空时只能是 Basic、Familiar、Advanced、Expert；只有技能上下文明确出现对应熟练度时才能填写，否则必须为空字符串。
7. 禁止返回解释、Markdown、普通正文或额外字段，只能调用 submit_resume_analysis 一次。
""".strip()


def strict_json_object(value: str) -> dict:
    """拒绝重复键和非标准常量，避免解析器静默覆盖模型字段。"""
    def unique_object(pairs: list[tuple[str, object]]) -> dict:
        result: dict = {}
        for key, item in pairs:
            if key in result:
                raise ValueError(f"JSON 包含重复字段: {key}")
            result[key] = item
        return result

    def reject_constant(constant: str):
        raise ValueError(f"JSON 包含非法常量: {constant}")

    result = json.loads(
        value,
        object_pairs_hook=unique_object,
        parse_constant=reject_constant,
    )
    if not isinstance(result, dict):
        raise ValueError("简历分析根节点必须是对象")
    return result


def analyze_resume(
    chat_model: SparkModel, content: str
) -> LLMAnalysisResult[ResumeAnalysisResult]:
    """调用模型后执行结构校验和原文来源校验。"""
    normalized_content = content.strip()
    if not normalized_content:
        raise ValueError("content 不能为空")
    if len(normalized_content) > MAX_RESUME_CONTENT_LENGTH:
        raise ValueError(
            f"content 长度不能超过 {MAX_RESUME_CONTENT_LENGTH} 个字符"
        )

    response = chat_model.question(
        RESUME_ANALYSIS_SYSTEM_PROMPT,
        normalized_content,
        temperature=0.1,
        max_tokens=8192,
        response_function=RESUME_ANALYSIS_RESPONSE_FUNCTION,
        timeout_seconds=model_config.provider_long_timeout_seconds,
    )
    # 模型参数先做严格结构校验，再清空没有原文依据的字段。
    try:
        untrusted_result = ResumeAnalysisResult.model_validate(
            strict_json_object(response.output)
        )
        result = ground_resume_analysis(untrusted_result, normalized_content)
    except ValueError as exception:
        raise ModelResponseError(
            "简历结构化响应校验失败", response.source_llm_response
        ) from exception
    return LLMAnalysisResult(result, response.source_llm_response)
