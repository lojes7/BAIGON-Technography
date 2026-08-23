"""用户技能分析与人岗匹配 gRPC Handler 测试。"""

import json
import unittest

import grpc
from openai import OpenAIError

from src.llm.exceptions import ModelConfigurationError, ModelResponseError
from src.pb import ai_pb2
from src.server.grpc_server import AIServicer
from src.service.analysis_result import LLMAnalysisResult
from src.service.job_match import JobMatchResult
from src.service.resume_analysis import MAX_RESUME_CONTENT_LENGTH
from src.service.user_skill_analysis import UserSkillAnalysisResult


class AbortError(RuntimeError):
    """模拟 context.abort 的不返回语义。"""

    def __init__(self, code, details):
        super().__init__(details)
        self.code = code


class FakeContext:
    def abort(self, code, details):
        raise AbortError(code, details)


class FakeLogService:
    """内存审计日志，测试不创建数据库连接。"""

    def __init__(self):
        self.entries = []

    def info(self, **kwargs):
        self.entries.append(("INFO", kwargs))

    def error(self, **kwargs):
        self.entries.append(("ERROR", kwargs))


class FakeAIModelService:
    chat_model_name = "spark-test"

    def analyze_user_skills(self, resume_content):
        self.user_skill_content = resume_content
        return LLMAnalysisResult(
            UserSkillAnalysisResult.model_validate(
                {
                    "skills": [
                        {
                            "name": "Java",
                            "proficiency": "ADVANCED",
                            "evidence": "熟练使用 Java",
                        }
                    ]
                }
            ),
            "raw-user-skill-analysis",
        )

    def analyze_job_match(self, resume, job):
        self.match_resume = resume
        self.match_job = job
        return LLMAnalysisResult(
            JobMatchResult.model_validate(
                {
                    "score": 76,
                    "summary": "主要能力匹配，仍需补充容器编排经验。",
                    "skills_to_learn": [
                        {
                            "skill_name": "Kubernetes",
                            "reason": "岗位要求容器编排经验。",
                            "suggestion": "完成一个 Kubernetes 部署项目。",
                        }
                    ],
                    "action_suggestions": ["在简历中补充可核验的部署成果。"],
                }
            ),
            "raw-job-match-analysis",
        )


class FailingAIModelService:
    """异常消息故意携带正文，用于验证服务日志不会泄露输入。"""

    chat_model_name = "spark-test"

    def analyze_user_skills(self, resume_content):
        raise ValueError(f"非法简历：{resume_content}")

    def analyze_job_match(self, resume, job):
        raise ValueError(f"非法匹配输入：{resume.model_dump_json()} / {job.job_description}")


class RaisingAIModelService:
    """让两类新 RPC 抛出指定领域异常。"""

    chat_model_name = "spark-test"

    def __init__(self, exception):
        self.exception = exception

    def analyze_user_skills(self, resume_content):
        raise self.exception

    def analyze_job_match(self, resume, job):
        raise self.exception


def job_message(**overrides):
    values = {
        "name": "Java 后端工程师",
        "publish_date": "2026-08-20T08:00:00+08:00",
        "source_platform": "测试平台",
        "source_url": "https://example.com/jobs/1",
        "tags": "Java,Spring",
        "major": "计算机相关专业",
        "nature": "全职",
        "salary": "20k-30k",
        "company_name": "示例公司",
        "company_size": "100-499人",
        "city": "上海",
        "province": "上海",
        "education": "本科",
        "experience": "3年以上",
        "job_description": "熟练使用 Java，了解 Kubernetes。",
        "occupation_id": 0,
    }
    values.update(overrides)
    return ai_pb2.JobMatchProfile(**values)


def resume_message(**overrides):
    values = {
        "education_experiences": [],
        "work_experiences": [],
        "project_experiences": [],
        "professional_skills": [
            {"skill_name": "Java", "proficiency": "Advanced"}
        ],
        "awards": [],
    }
    values.update(overrides)
    encoded = {
        key: value
        if isinstance(value, str)
        else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        for key, value in values.items()
    }
    return ai_pb2.ResumeMatchProfile(**encoded)


class GrpcUserAnalysisTest(unittest.TestCase):
    def setUp(self):
        self.model_service = FakeAIModelService()
        self.log_service = FakeLogService()
        self.servicer = AIServicer(self.model_service, self.log_service)
        self.context = FakeContext()

    def test_user_skill_contract_has_business_and_audit_fields(self):
        request_fields = [
            field.name for field in ai_pb2.AnalyzeUserSkillsRequest.DESCRIPTOR.fields
        ]
        response_fields = [
            field.name for field in ai_pb2.AnalyzeUserSkillsResponse.DESCRIPTOR.fields
        ]

        self.assertEqual(
            request_fields,
            [
                "resume_content",
                "trace_id",
                "user_id",
                "user_name",
                "user_ip",
                "request_method",
                "request_url",
            ],
        )
        self.assertEqual(
            response_fields,
            ["skills", "model", "source_llm_response", "error_code"],
        )

    def test_analyze_user_skills_returns_validated_skills_and_model(self):
        response = self.servicer.AnalyzeUserSkills(
            ai_pb2.AnalyzeUserSkillsRequest(
                resume_content="  熟练使用 Java  ",
                trace_id="10001",
                user_id=123,
                user_name="测试用户",
                user_ip="127.0.0.1",
                request_method="POST",
                request_url="/api/auth/resumes/analyze-skills",
            ),
            self.context,
        )

        self.assertEqual(response.skills[0].name, "Java")
        self.assertEqual(response.skills[0].proficiency, "ADVANCED")
        self.assertEqual(response.model, "spark-test")
        self.assertEqual(response.source_llm_response, "raw-user-skill-analysis")
        self.assertEqual(response.error_code, "")
        self.assertEqual(self.model_service.user_skill_content, "熟练使用 Java")
        self.assertEqual(
            self.log_service.entries,
            [
                (
                    "INFO",
                    {
                        "trace_id": "10001",
                        "user_id": 123,
                        "user_name": "测试用户",
                        "user_ip": "127.0.0.1",
                        "request_method": "POST",
                        "request_url": "/api/auth/resumes/analyze-skills",
                        "detail": "AnalyzeUserSkills 成功",
                    },
                )
            ],
        )

    def test_analyze_user_skills_rejects_empty_resume(self):
        with self.assertRaises(AbortError) as raised:
            self.servicer.AnalyzeUserSkills(
                ai_pb2.AnalyzeUserSkillsRequest(resume_content=" "),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)
        self.assertEqual(self.log_service.entries[0][0], "ERROR")
        self.assertEqual(
            self.log_service.entries[0][1]["error_msg"],
            "INVALID_ARGUMENT",
        )

    def test_job_profile_contract_contains_only_jobs_business_fields(self):
        field_names = [field.name for field in ai_pb2.JobMatchProfile.DESCRIPTOR.fields]

        self.assertEqual(
            field_names,
            [
                "name",
                "publish_date",
                "source_platform",
                "source_url",
                "tags",
                "major",
                "nature",
                "salary",
                "company_name",
                "company_size",
                "city",
                "province",
                "education",
                "experience",
                "job_description",
                "occupation_id",
            ],
        )

    def test_job_match_contract_has_business_and_audit_fields(self):
        request_fields = [
            field.name for field in ai_pb2.AnalyzeJobMatchRequest.DESCRIPTOR.fields
        ]
        response_fields = [
            field.name for field in ai_pb2.AnalyzeJobMatchResponse.DESCRIPTOR.fields
        ]

        self.assertEqual(
            request_fields,
            [
                "job",
                "resume",
                "trace_id",
                "user_id",
                "user_name",
                "user_ip",
                "request_method",
                "request_url",
            ],
        )
        self.assertEqual(
            response_fields,
            [
                "score",
                "summary",
                "skills_to_learn",
                "action_suggestions",
                "model",
                "source_llm_response",
                "error_code",
            ],
        )

        self.assertEqual(
            [field.name for field in ai_pb2.ResumeMatchProfile.DESCRIPTOR.fields],
            [
                "education_experiences",
                "work_experiences",
                "project_experiences",
                "professional_skills",
                "awards",
            ],
        )

    def test_analyze_job_match_maps_profile_and_result(self):
        response = self.servicer.AnalyzeJobMatch(
            ai_pb2.AnalyzeJobMatchRequest(
                resume=resume_message(),
                job=job_message(occupation_id=456),
                trace_id="10002",
                user_id=123,
                user_name="测试用户",
                user_ip="127.0.0.1",
                request_method="POST",
                request_url="/api/jobs/456/match",
            ),
            self.context,
        )

        self.assertEqual(response.score, 76)
        self.assertEqual(response.skills_to_learn[0].skill_name, "Kubernetes")
        self.assertEqual(
            list(response.action_suggestions),
            ["在简历中补充可核验的部署成果。"],
        )
        self.assertEqual(response.model, "spark-test")
        self.assertEqual(response.source_llm_response, "raw-job-match-analysis")
        self.assertEqual(response.error_code, "")
        self.assertEqual(
            self.model_service.match_resume.professional_skills[0].skill_name,
            "Java",
        )
        self.assertEqual(self.model_service.match_job.occupation_id, 456)
        self.assertEqual(self.model_service.match_job.job_description, "熟练使用 Java，了解 Kubernetes。")
        audit_entry = self.log_service.entries[0]
        self.assertEqual(audit_entry[0], "INFO")
        self.assertEqual(
            {
                key: audit_entry[1][key]
                for key in (
                    "trace_id",
                    "user_id",
                    "user_name",
                    "user_ip",
                    "request_method",
                    "request_url",
                )
            },
            {
                "trace_id": "10002",
                "user_id": 123,
                "user_name": "测试用户",
                "user_ip": "127.0.0.1",
                "request_method": "POST",
                "request_url": "/api/jobs/456/match",
            },
        )

    def test_analyze_job_match_rejects_empty_job_profile(self):
        with self.assertRaises(AbortError) as raised:
            self.servicer.AnalyzeJobMatch(
                ai_pb2.AnalyzeJobMatchRequest(
                    resume=resume_message(),
                    job=ai_pb2.JobMatchProfile(),
                ),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)
        self.assertEqual(self.log_service.entries[0][0], "ERROR")
        self.assertEqual(
            self.log_service.entries[0][1]["detail"],
            "AnalyzeJobMatch 失败",
        )

    def test_analyze_job_match_rejects_invalid_structured_resume(self):
        with self.assertRaises(AbortError) as raised:
            self.servicer.AnalyzeJobMatch(
                ai_pb2.AnalyzeJobMatchRequest(
                    resume=resume_message(professional_skills="not-json"),
                    job=job_message(),
                ),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)
        self.assertEqual(self.log_service.entries[0][1]["error_msg"], "INVALID_ARGUMENT")

    def test_failure_logs_do_not_include_resume_or_job_content(self):
        log_service = FakeLogService()
        servicer = AIServicer(FailingAIModelService(), log_service)
        resume_content = "私密简历正文-不可写入日志"
        resume_secret = "私密结构化项目-不可写入日志"
        job_description = "私密岗位正文-不可写入日志"

        with self.assertLogs("src.server.grpc_server", level="ERROR") as skill_logs:
            with self.assertRaises(AbortError) as skill_error:
                servicer.AnalyzeUserSkills(
                    ai_pb2.AnalyzeUserSkillsRequest(
                        resume_content=resume_content,
                        trace_id="trace-safe-1",
                    ),
                    self.context,
                )
        with self.assertLogs("src.server.grpc_server", level="ERROR") as match_logs:
            with self.assertRaises(AbortError) as match_error:
                servicer.AnalyzeJobMatch(
                    ai_pb2.AnalyzeJobMatchRequest(
                        resume=resume_message(
                            project_experiences=[
                                {
                                    "project_name": "内部项目",
                                    "start_date": "",
                                    "end_date": "",
                                    "description": resume_secret,
                                }
                            ]
                        ),
                        job=job_message(job_description=job_description),
                        trace_id="trace-safe-2",
                    ),
                    self.context,
                )

        logs = "\n".join(skill_logs.output + match_logs.output)
        self.assertEqual(skill_error.exception.code, grpc.StatusCode.INTERNAL)
        self.assertEqual(match_error.exception.code, grpc.StatusCode.INTERNAL)
        self.assertNotIn(resume_content, logs)
        self.assertNotIn(resume_secret, logs)
        self.assertNotIn(job_description, logs)
        self.assertIn("trace-safe-1", logs)
        self.assertIn("trace-safe-2", logs)
        persisted_log_text = repr(log_service.entries)
        self.assertNotIn(resume_content, persisted_log_text)
        self.assertNotIn(resume_secret, persisted_log_text)
        self.assertNotIn(job_description, persisted_log_text)
        self.assertEqual(
            [entry[1]["error_msg"] for entry in log_service.entries],
            ["INTERNAL", "INTERNAL"],
        )

    def test_invalid_model_responses_return_raw_content_for_task_audit(self):
        """模型已返回但契约校验失败时，不丢失可供任务表审查的原文。"""
        for operation in ("skills", "match"):
            with self.subTest(operation=operation):
                log_service = FakeLogService()
                servicer = AIServicer(
                    RaisingAIModelService(
                        ModelResponseError("响应不合法", f"raw-invalid-{operation}")
                    ),
                    log_service,
                )
                if operation == "skills":
                    response = servicer.AnalyzeUserSkills(
                        ai_pb2.AnalyzeUserSkillsRequest(
                            resume_content="熟练使用 Java",
                            trace_id="invalid-skills",
                        ),
                        self.context,
                    )
                else:
                    response = servicer.AnalyzeJobMatch(
                        ai_pb2.AnalyzeJobMatchRequest(
                            resume=resume_message(),
                            job=job_message(),
                            trace_id="invalid-match",
                        ),
                        self.context,
                    )

                self.assertEqual(
                    response.source_llm_response,
                    f"raw-invalid-{operation}",
                )
                self.assertEqual(response.error_code, "LLM_RESPONSE_INVALID")
                self.assertEqual(
                    log_service.entries[0][1]["error_msg"],
                    "LLM_RESPONSE_INVALID",
                )

    def test_model_configuration_error_maps_both_rpcs_to_failed_precondition(self):
        """技能分析和人岗匹配必须使用相同的模型配置错误语义。"""
        for operation in ("skills", "match"):
            with self.subTest(operation=operation):
                log_service = FakeLogService()
                servicer = AIServicer(
                    RaisingAIModelService(ModelConfigurationError("未配置")),
                    log_service,
                )
                with self.assertRaises(AbortError) as raised:
                    if operation == "skills":
                        servicer.AnalyzeUserSkills(
                            ai_pb2.AnalyzeUserSkillsRequest(
                                resume_content="熟练使用 Java",
                                trace_id="20001",
                            ),
                            self.context,
                        )
                    else:
                        servicer.AnalyzeJobMatch(
                            ai_pb2.AnalyzeJobMatchRequest(
                                resume=resume_message(),
                                job=job_message(),
                                trace_id="20002",
                            ),
                            self.context,
                        )

                self.assertEqual(
                    raised.exception.code,
                    grpc.StatusCode.FAILED_PRECONDITION,
                )
                self.assertEqual(
                    log_service.entries[0][1]["error_msg"],
                    "FAILED_PRECONDITION",
                )

    def test_openai_error_maps_both_rpcs_to_unavailable(self):
        """供应商调用失败统一映射为 UNAVAILABLE。"""
        for operation in ("skills", "match"):
            with self.subTest(operation=operation):
                log_service = FakeLogService()
                servicer = AIServicer(
                    RaisingAIModelService(OpenAIError("供应商失败")),
                    log_service,
                )
                with self.assertRaises(AbortError) as raised:
                    if operation == "skills":
                        servicer.AnalyzeUserSkills(
                            ai_pb2.AnalyzeUserSkillsRequest(
                                resume_content="熟练使用 Java",
                                trace_id="30001",
                            ),
                            self.context,
                        )
                    else:
                        servicer.AnalyzeJobMatch(
                            ai_pb2.AnalyzeJobMatchRequest(
                                resume=resume_message(),
                                job=job_message(),
                                trace_id="30002",
                            ),
                            self.context,
                        )

                self.assertEqual(raised.exception.code, grpc.StatusCode.UNAVAILABLE)
                self.assertEqual(
                    log_service.entries[0][1]["error_msg"],
                    "UNAVAILABLE",
                )

    def test_overlong_user_skill_resume_maps_to_invalid_argument(self):
        """技能分析仍在调用模型前拒绝超长简历正文。"""
        overlong_resume = "技" * (MAX_RESUME_CONTENT_LENGTH + 1)
        log_service = FakeLogService()
        servicer = AIServicer(FakeAIModelService(), log_service)
        with self.assertRaises(AbortError) as raised:
            servicer.AnalyzeUserSkills(
                ai_pb2.AnalyzeUserSkillsRequest(
                    resume_content=overlong_resume,
                    trace_id="40001",
                ),
                self.context,
            )

        self.assertEqual(raised.exception.code, grpc.StatusCode.INVALID_ARGUMENT)
        self.assertEqual(
            log_service.entries[0][1]["error_msg"],
            "INVALID_ARGUMENT",
        )


if __name__ == "__main__":
    unittest.main()
