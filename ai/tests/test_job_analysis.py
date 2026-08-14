"""JD 结构化分析业务契约测试。"""

import json
import unittest

from pydantic import ValidationError

from src.service.job_analysis import analyze_job_description


class FakeSparkModel:
    """返回指定函数参数，并记录 system prompt 与 JD。"""

    def __init__(self, result: dict):
        self.arguments = json.dumps(result, ensure_ascii=False)
        self.call = None

    def question(self, system_prompt, user_prompt, **options):
        self.call = (system_prompt, user_prompt, options)
        return self.arguments


class JobAnalysisTest(unittest.TestCase):
    def test_analyze_job_description_uses_jd_as_user_prompt(self):
        model = FakeSparkModel(
            {
                "education": "Bachelor",
                "skills": [
                    {
                        "name": "Java",
                        "proficiency": "Advanced",
                        "evidence": "熟练掌握 Java 并能独立开发生产系统。",
                    }
                ],
            }
        )

        result = analyze_job_description(model, "  招聘 Java 工程师  ")

        self.assertEqual(result.education, "Bachelor")
        self.assertEqual(result.skills[0].proficiency, "Advanced")
        self.assertEqual(model.call[1], "招聘 Java 工程师")
        self.assertEqual(model.call[2]["temperature"], 0.1)
        self.assertEqual(
            model.call[2]["response_function"]["name"],
            "submit_job_description_analysis",
        )

    def test_analyze_job_description_rejects_invalid_proficiency(self):
        model = FakeSparkModel(
            {
                "education": "Master",
                "skills": [
                    {
                        "name": "RAG",
                        "proficiency": "Proficient",
                        "evidence": "熟悉 RAG。",
                    }
                ],
            }
        )

        with self.assertRaises(ValidationError):
            analyze_job_description(model, "熟悉 RAG")

    def test_analyze_job_description_requires_evidence(self):
        model = FakeSparkModel(
            {
                "education": "Unspecified",
                "skills": [{"name": "Python", "proficiency": "Basic"}],
            }
        )

        with self.assertRaises(ValidationError):
            analyze_job_description(model, "了解 Python")

    def test_analyze_job_description_rejects_extra_fields(self):
        model = FakeSparkModel(
            {
                "education": "Unspecified",
                "skills": [],
                "summary": "不允许出现的字段",
            }
        )

        with self.assertRaises(ValidationError):
            analyze_job_description(model, "岗位描述")

    def test_analyze_job_description_rejects_duplicate_skills(self):
        model = FakeSparkModel(
            {
                "education": "Unspecified",
                "skills": [
                    {"name": "Java", "proficiency": "Basic", "evidence": "了解 Java"},
                    {"name": "java", "proficiency": "Advanced", "evidence": "熟练使用 Java"},
                ],
            }
        )

        with self.assertRaisesRegex(ValidationError, "重复技能"):
            analyze_job_description(model, "了解并熟练使用 Java")

    def test_analyze_job_description_rejects_empty_jd(self):
        model = FakeSparkModel({"education": "Unspecified", "skills": []})

        with self.assertRaisesRegex(ValueError, "jd 不能为空"):
            analyze_job_description(model, "   ")


if __name__ == "__main__":
    unittest.main()
