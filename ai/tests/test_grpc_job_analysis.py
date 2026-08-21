"""AnalyzeJobDescription gRPC Handler 测试。"""

import unittest

import grpc

from src.pb import ai_pb2
from src.server.grpc_server import AIServicer
from src.service.job_analysis import JobAnalysisResult


class AbortError(RuntimeError):
    """模拟 context.abort 的不返回行为。"""

    def __init__(self, code, details):
        super().__init__(details)
        self.code = code


class FakeContext:
    def abort(self, code, details):
        raise AbortError(code, details)


class FakeAIModelService:
    def analyze_job_description(self, jd):
        self.jd = jd
        return JobAnalysisResult.model_validate(
            {
                "skills": [
                    {
                        "name": "JavaScript Web 开发",
                        "proficiency": "EXPERT",
                        "evidence": "能够使用 JavaScript 构建多个 Web 应用。",
                    },
                    {
                        "name": "微软 Word 文档处理",
                        "proficiency": "FAMILIAR",
                        "evidence": "能够使用 MS Word 编写项目文档。",
                    }
                ],
            }
        )


class GrpcJobAnalysisTest(unittest.TestCase):
    def setUp(self):
        self.service = FakeAIModelService()
        self.servicer = AIServicer(model_service=self.service)
        self.context = FakeContext()

    def test_request_contract_contains_only_jd(self):
        field_names = [
            field.name
            for field in ai_pb2.AnalyzeJobDescriptionRequest.DESCRIPTOR.fields
        ]

        self.assertEqual(field_names, ["jd"])

    def test_response_contract_returns_skill_object_list(self):
        field_names = [
            field.name
            for field in ai_pb2.AnalyzeJobDescriptionResponse.DESCRIPTOR.fields
        ]

        self.assertEqual(field_names, ["skills"])

    def test_analyze_job_description_returns_validated_skill_objects(self):
        response = self.servicer.AnalyzeJobDescription(
            ai_pb2.AnalyzeJobDescriptionRequest(jd="  JD 原文  "),
            self.context,
        )

        self.assertEqual(len(response.skills), 2)
        self.assertEqual(response.skills[0].name, "JavaScript Web 开发")
        self.assertEqual(response.skills[0].proficiency, "EXPERT")
        self.assertEqual(response.skills[1].name, "微软 Word 文档处理")
        self.assertEqual(self.service.jd, "JD 原文")

    def test_analyze_job_description_rejects_empty_jd(self):
        with self.assertRaises(AbortError) as raised:
            self.servicer.AnalyzeJobDescription(
                ai_pb2.AnalyzeJobDescriptionRequest(jd=" "),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)


if __name__ == "__main__":
    unittest.main()
