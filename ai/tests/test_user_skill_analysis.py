"""用户简历技能分析业务契约测试。"""

import json
import unittest

from pydantic import ValidationError

from src.service.user_skill_analysis import analyze_user_skills
from src.service.user_skill_analysis.analyzer import (
    USER_SKILL_ANALYSIS_RESPONSE_FUNCTION,
    USER_SKILL_ANALYSIS_SYSTEM_PROMPT,
)
from src.service.resume_analysis import MAX_RESUME_CONTENT_LENGTH


class FakeSparkModel:
    """返回固定函数参数并记录调用。"""

    def __init__(self, result: dict):
        self.arguments = json.dumps(result, ensure_ascii=False)
        self.call = None

    def question(self, system_prompt, user_prompt, **options):
        self.call = (system_prompt, user_prompt, options)
        return self.arguments


class UserSkillAnalysisTest(unittest.TestCase):
    def test_extracts_uppercase_skills_with_grounded_evidence(self):
        content = "参与支付系统建设，熟练使用 Java。熟悉 Kubernetes 部署。"
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Java",
                        "proficiency": "ADVANCED",
                        "evidence": "熟练使用 Java",
                    },
                    {
                        "name": "Kubernetes",
                        "proficiency": "FAMILIAR",
                        "evidence": "熟悉 Kubernetes 部署",
                    },
                ]
            }
        )

        result = analyze_user_skills(model, f"  {content}  ")

        self.assertEqual([item.name for item in result.skills], ["Java", "Kubernetes"])
        self.assertEqual(result.skills[0].proficiency, "ADVANCED")
        self.assertEqual(model.call[1], content)
        self.assertEqual(model.call[2]["temperature"], 0.1)
        self.assertEqual(
            model.call[2]["response_function"]["name"],
            "submit_user_skill_analysis",
        )

    def test_evidence_allows_only_normalized_original_fragment(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Python",
                        "proficiency": "FAMILIAR",
                        "evidence": "使用 Python 开发数据服务",
                    }
                ]
            }
        )

        result = analyze_user_skills(model, "使用  Python\n开发数据服务")

        self.assertEqual(result.skills[0].name, "Python")

    def test_rejects_ungrounded_evidence(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Go",
                        "proficiency": "EXPERT",
                        "evidence": "精通 Go 并主导大型架构",
                    }
                ]
            }
        )

        with self.assertRaisesRegex(ValueError, "无法在简历原文中定位"):
            analyze_user_skills(model, "了解 Go")

    def test_rejects_legacy_title_case_and_extra_fields(self):
        legacy_model = FakeSparkModel(
            {
                "skills": [
                    {
                        "name": "Java",
                        "proficiency": "Advanced",
                        "evidence": "熟练使用 Java",
                    }
                ]
            }
        )
        extra_model = FakeSparkModel({"skills": [], "summary": "无"})

        with self.assertRaises(ValidationError):
            analyze_user_skills(legacy_model, "熟练使用 Java")
        with self.assertRaises(ValidationError):
            analyze_user_skills(extra_model, "候选人简历")

    def test_rejects_duplicate_skills(self):
        model = FakeSparkModel(
            {
                "skills": [
                    {"name": "Java", "proficiency": "BASIC", "evidence": "了解 Java"},
                    {"name": "java", "proficiency": "ADVANCED", "evidence": "熟练 Java"},
                ]
            }
        )

        with self.assertRaisesRegex(ValidationError, "重复技能"):
            analyze_user_skills(model, "了解 Java，也曾熟练 Java")

    def test_empty_resume_is_rejected_before_model_call(self):
        model = FakeSparkModel({"skills": []})

        with self.assertRaisesRegex(ValueError, "resume_content 不能为空"):
            analyze_user_skills(model, "  ")
        self.assertIsNone(model.call)

    def test_overlong_resume_is_rejected_before_model_call(self):
        model = FakeSparkModel({"skills": []})

        with self.assertRaisesRegex(ValueError, "长度不能超过"):
            analyze_user_skills(model, "简" * (MAX_RESUME_CONTENT_LENGTH + 1))
        self.assertIsNone(model.call)

    def test_schema_and_prompt_enforce_grounding(self):
        parameters = USER_SKILL_ANALYSIS_RESPONSE_FUNCTION["parameters"]
        proficiency = parameters["properties"]["skills"]["items"]["properties"][
            "proficiency"
        ]

        self.assertEqual(list(parameters["properties"]), ["skills"])
        self.assertEqual(
            proficiency["enum"],
            ["EXPERT", "ADVANCED", "FAMILIAR", "BASIC"],
        )
        self.assertIn("原文中连续出现", USER_SKILL_ANALYSIS_SYSTEM_PROMPT)
        self.assertIn("不可信数据", USER_SKILL_ANALYSIS_SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
