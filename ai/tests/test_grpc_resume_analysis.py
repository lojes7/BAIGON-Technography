"""AnalyzeResume gRPC Handler 测试。"""

import json
import unittest

import grpc

from src.llm.exceptions import ModelResponseError
from src.pb import ai_pb2
from src.server.grpc_server import AIServicer
from src.service.analysis_result import LLMAnalysisResult
from src.service.resume_analysis import ResumeAnalysisResult


class AbortError(RuntimeError):
    def __init__(self, code, details):
        super().__init__(details)
        self.code = code


class FakeContext:
    def abort(self, code, details):
        raise AbortError(code, details)


class FakeAIModelService:
    def analyze_resume(self, content):
        self.content = content
        return LLMAnalysisResult(
            ResumeAnalysisResult.model_validate(
                {
                    "education_experience": [],
                    "work_experience": [],
                    "project_experience": [],
                    "professional_skills": [
                        {"skill_name": "Java", "proficiency": "Advanced"}
                    ],
                    "awards": [],
                }
            ),
            "raw-resume-analysis",
        )


class InvalidResponseAIModelService:
    def analyze_resume(self, content):
        raise ModelResponseError("响应不合法", "raw-invalid-resume-analysis")


class GrpcResumeAnalysisTest(unittest.TestCase):
    def setUp(self):
        self.model_service = FakeAIModelService()
        self.servicer = AIServicer(self.model_service)
        self.context = FakeContext()

    def test_contract_contains_only_content_and_checked_json(self):
        request_fields = [
            field.name for field in ai_pb2.AnalyzeResumeRequest.DESCRIPTOR.fields
        ]
        response_fields = [
            field.name for field in ai_pb2.AnalyzeResumeResponse.DESCRIPTOR.fields
        ]

        self.assertEqual(request_fields, ["content"])
        self.assertEqual(
            response_fields,
            ["resume_json", "source_llm_response", "error_code"],
        )

    def test_analyze_resume_returns_canonical_json(self):
        response = self.servicer.AnalyzeResume(
            ai_pb2.AnalyzeResumeRequest(content="  熟练使用 Java  "),
            self.context,
        )

        result = json.loads(response.resume_json)
        self.assertEqual(result["professional_skills"][0]["proficiency"], "Advanced")
        self.assertEqual(response.source_llm_response, "raw-resume-analysis")
        self.assertEqual(response.error_code, "")
        self.assertEqual(self.model_service.content, "熟练使用 Java")

    def test_invalid_model_response_is_returned_for_task_audit(self):
        response = AIServicer(InvalidResponseAIModelService()).AnalyzeResume(
            ai_pb2.AnalyzeResumeRequest(content="简历原文"),
            self.context,
        )

        self.assertEqual(response.resume_json, "")
        self.assertEqual(response.source_llm_response, "raw-invalid-resume-analysis")
        self.assertEqual(response.error_code, "LLM_RESPONSE_INVALID")

    def test_empty_content_is_invalid_argument(self):
        with self.assertRaises(AbortError) as raised:
            self.servicer.AnalyzeResume(
                ai_pb2.AnalyzeResumeRequest(content=" "),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)


if __name__ == "__main__":
    unittest.main()
