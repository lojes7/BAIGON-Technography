"""简历结构化抽取、格式校验和来源校验测试。"""

import json
from pathlib import Path
import unittest

from pydantic import ValidationError

from src.service.resume_analysis import ResumeAnalysisResult, analyze_resume
from src.service.resume_analysis.analyzer import RESUME_ANALYSIS_SYSTEM_PROMPT
from src.service.resume_analysis.schema import RESUME_ANALYSIS_RESPONSE_FUNCTION


def empty_result() -> dict:
    return {
        "education_experience": [],
        "work_experience": [],
        "project_experience": [],
        "professional_skills": [],
        "awards": [],
    }


class FakeSparkModel:
    """返回指定函数参数并记录模型调用。"""

    def __init__(self, result: dict):
        self.arguments = json.dumps(result, ensure_ascii=False)
        self.call = None

    def question(self, system_prompt, user_prompt, **options):
        self.call = (system_prompt, user_prompt, options)
        return self.arguments


class ResumeAnalysisTest(unittest.TestCase):
    def test_format_json_is_accepted_as_the_canonical_shape(self):
        format_path = Path(__file__).resolve().parents[2] / "format.json"
        example = json.loads(format_path.read_text(encoding="utf-8"))

        result = ResumeAnalysisResult.model_validate(example)

        self.assertEqual(
            list(result.model_dump()),
            [
                "education_experience",
                "work_experience",
                "project_experience",
                "professional_skills",
                "awards",
            ],
        )

    def test_analyze_resume_returns_only_grounded_content(self):
        model_result = empty_result()
        model_result["education_experience"] = [
            {
                "major": "软件工程",
                "university_name": "不存在大学",
                "start_date": "2015-09-01",
                "end_date": "2019-06-01",
                "description": "",
            }
        ]
        model_result["professional_skills"] = [
            {"skill_name": "Java", "proficiency": "Expert"}
        ]
        model = FakeSparkModel(model_result)
        content = (
            "2015年9月1日至2019年6月1日，软件工程。\n"
            "专业技能：精通 Java。"
        )

        result = analyze_resume(model, content)

        self.assertEqual(result.education_experience[0].major, "软件工程")
        self.assertEqual(result.education_experience[0].university_name, "")
        self.assertEqual(result.education_experience[0].start_date, "2015-09-01")
        self.assertEqual(result.professional_skills[0].proficiency, "Expert")
        self.assertEqual(model.call[1], content)
        self.assertEqual(model.call[2]["temperature"], 0.1)
        self.assertEqual(
            model.call[2]["response_function"]["name"],
            "submit_resume_analysis",
        )

    def test_hallucinated_record_is_removed(self):
        model_result = empty_result()
        model_result["work_experience"] = [
            {
                "occupation_name": "架构师",
                "company": "虚构公司",
                "start_date": "",
                "end_date": "",
                "description": "",
            }
        ]

        result = analyze_resume(FakeSparkModel(model_result), "本人没有工作经历。")

        self.assertEqual(result.work_experience, [])

    def test_incomplete_source_date_is_cleared(self):
        model_result = empty_result()
        model_result["awards"] = [
            {
                "award_name": "优秀员工奖",
                "date": "2022-12-01",
                "description": "",
            }
        ]

        result = analyze_resume(
            FakeSparkModel(model_result),
            "2022年12月获得优秀员工奖。",
        )

        self.assertEqual(result.awards[0].date, "")

    def test_proficiency_without_matching_source_term_is_cleared(self):
        model_result = empty_result()
        model_result["professional_skills"] = [
            {"skill_name": "Python", "proficiency": "Advanced"}
        ]

        result = analyze_resume(FakeSparkModel(model_result), "技能：Python。")

        self.assertEqual(result.professional_skills[0].proficiency, "")

    def test_invalid_proficiency_is_rejected(self):
        model_result = empty_result()
        model_result["professional_skills"] = [
            {"skill_name": "Java", "proficiency": "Skilled"}
        ]

        with self.assertRaises(ValidationError):
            analyze_resume(FakeSparkModel(model_result), "熟练使用 Java。")

    def test_missing_or_extra_root_field_is_rejected(self):
        missing = empty_result()
        missing.pop("awards")
        with self.assertRaises(ValidationError):
            analyze_resume(FakeSparkModel(missing), "简历原文")

        extra = empty_result()
        extra["summary"] = "擅自生成的摘要"
        with self.assertRaises(ValidationError):
            analyze_resume(FakeSparkModel(extra), "简历原文")

    def test_wrong_scalar_type_and_duplicate_keys_are_rejected(self):
        wrong_type = empty_result()
        wrong_type["professional_skills"] = [
            {"skill_name": 123, "proficiency": ""}
        ]
        with self.assertRaises(ValidationError):
            analyze_resume(FakeSparkModel(wrong_type), "技能 123")

        model = FakeSparkModel(empty_result())
        model.arguments = """
            {
              "education_experience": [],
              "education_experience": [],
              "work_experience": [],
              "project_experience": [],
              "professional_skills": [],
              "awards": []
            }
        """
        with self.assertRaisesRegex(ValueError, "重复字段"):
            analyze_resume(model, "简历原文")

    def test_schema_and_prompt_forbid_generated_text(self):
        parameters = RESUME_ANALYSIS_RESPONSE_FUNCTION["parameters"]

        self.assertFalse(parameters["additionalProperties"])
        self.assertEqual(
            parameters["properties"]["professional_skills"]["items"]
            ["properties"]["proficiency"]["enum"],
            ["", "Basic", "Familiar", "Advanced", "Expert"],
        )
        self.assertIn("逐字复制", RESUME_ANALYSIS_SYSTEM_PROMPT)
        self.assertIn("不得补写", RESUME_ANALYSIS_SYSTEM_PROMPT)

    def test_empty_content_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "content 不能为空"):
            analyze_resume(FakeSparkModel(empty_result()), "   ")


if __name__ == "__main__":
    unittest.main()
