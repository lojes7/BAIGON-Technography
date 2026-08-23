"""JD 结构化分析业务契约测试。"""

import json
import unittest

from src.llm.exceptions import ModelResponseError
from src.llm.spark_model import LLMResponse
from src.service.job_analysis import analyze_job_description
from src.service.job_analysis.analyzer import (
    JOB_ANALYSIS_RESPONSE_FUNCTION,
    JOB_ANALYSIS_SYSTEM_PROMPT,
)


class FakeSparkModel:
    """返回指定函数参数，并记录 system prompt 与 JD。"""

    def __init__(self, result: dict):
        self.arguments = json.dumps(result, ensure_ascii=False)
        self.call = None

    def question(self, system_prompt, user_prompt, **options):
        self.call = (system_prompt, user_prompt, options)
        return LLMResponse(self.arguments, self.arguments)


class JobAnalysisTest(unittest.TestCase):
    def test_analyze_job_description_uses_jd_as_user_prompt(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Java 编程",
                        "proficiency": "ADVANCED",
                        "evidence": "熟练掌握 Java 并能独立开发生产系统。",
                    },
                    {
                        "name": "微软 Word 文档处理",
                        "proficiency": "FAMILIAR",
                        "evidence": "能够使用 MS Word 编写项目文档。",
                    }
                ],
            }
        )

        analyzed = analyze_job_description(model, "  招聘 Java 工程师  ")
        result = analyzed.value

        self.assertEqual(len(result.skills), 2)
        self.assertEqual(result.skills[1].name, "微软 Word 文档处理")
        self.assertEqual(result.skills[0].proficiency, "ADVANCED")
        self.assertEqual(model.call[1], "招聘 Java 工程师")
        self.assertEqual(model.call[2]["temperature"], 0.1)
        self.assertEqual(
            model.call[2]["response_function"]["name"],
            "submit_job_description_analysis",
        )
        self.assertEqual(analyzed.source_llm_response, model.arguments)

    def test_analyze_job_description_rejects_invalid_proficiency(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "RAG 检索增强生成",
                        "proficiency": "Proficient",
                        "evidence": "熟悉 RAG。",
                    }
                ],
            }
        )

        with self.assertRaises(ModelResponseError):
            analyze_job_description(model, "熟悉 RAG")

    def test_analyze_job_description_requires_evidence(self):
        model = FakeSparkModel(
            {
                "skills": [{"name": "Python 编程", "proficiency": "Basic"}],
            }
        )

        with self.assertRaises(ModelResponseError):
            analyze_job_description(model, "了解 Python")

    def test_analyze_job_description_rejects_extra_fields(self):
        model = FakeSparkModel(
            {
                "skills": [],
                "education": "Bachelor",
            }
        )

        with self.assertRaises(ModelResponseError):
            analyze_job_description(model, "岗位描述")

    def test_analyze_job_description_rejects_duplicate_skills(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {"name": "Java 编程", "proficiency": "BASIC", "evidence": "了解 Java"},
                    {"name": "java 编程", "proficiency": "ADVANCED", "evidence": "熟练使用 Java"},
                ],
            }
        )

        with self.assertRaises(ModelResponseError):
            analyze_job_description(model, "了解并熟练使用 Java")

    def test_analyze_job_description_accepts_english_technical_term(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "RAG",
                        "proficiency": "FAMILIAR",
                        "evidence": "熟悉 RAG。",
                    }
                ]
            }
        )

        result = analyze_job_description(model, "熟悉 RAG").value

        self.assertEqual(result.skills[0].name, "RAG")

    def test_analysis_schema_contains_only_complete_skill_list(self):
        parameters = JOB_ANALYSIS_RESPONSE_FUNCTION["parameters"]

        self.assertEqual(parameters["required"], ["skills"])
        self.assertEqual(list(parameters["properties"]), ["skills"])
        self.assertNotIn("maxItems", parameters["properties"]["skills"])
        self.assertIn("MS Word", JOB_ANALYSIS_SYSTEM_PROMPT)
        self.assertIn("不得遗漏", JOB_ANALYSIS_SYSTEM_PROMPT)
        proficiency_schema = parameters["properties"]["skills"]["items"][
            "properties"
        ]["proficiency"]
        self.assertEqual(
            proficiency_schema["enum"],
            ["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"],
        )

    def test_analyze_job_description_rejects_legacy_title_case_proficiency(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Java 编程",
                        "proficiency": "Advanced",
                        "evidence": "熟练使用 Java",
                    }
                ]
            }
        )

        with self.assertRaises(ModelResponseError):
            analyze_job_description(model, "熟练使用 Java")

    def test_analyze_job_description_rejects_empty_jd(self):
        model = FakeSparkModel({"skills": []})

        with self.assertRaisesRegex(ValueError, "jd 不能为空"):
            analyze_job_description(model, "   ")


if __name__ == "__main__":
    unittest.main()
