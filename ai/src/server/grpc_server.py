# 百工谱 — ai_service gRPC 服务端实现

import json
import logging
from typing import Any

import grpc
from openai import OpenAIError

from src.config import model_config
from src.llm.exceptions import ModelConfigurationError, ModelResponseError
from src.pb import ai_pb2, ai_pb2_grpc, audit_pb2
from src.service.audit.log_query_service import AuditLogQueryService
from src.service.job_analysis import MAX_JD_LENGTH
from src.service.job_match import JobMatchProfile, ResumeMatchProfile
from src.service.log_service import LogService
from src.service.model_service import AIModelService
from src.service.resume_analysis import MAX_RESUME_CONTENT_LENGTH

logger = logging.getLogger(__name__)

# 当前 Qwen 嵌入模型的默认输出维度，建库和检索必须保持一致。
DEFAULT_DIMENSIONS = model_config.embedding_default_dimensions
DEFAULT_CHUNK_SIZE = model_config.embedding_default_chunk_size
MAX_BATCH_SIZE = model_config.embedding_max_batch_size
MAX_CHUNK_SIZE = model_config.embedding_max_chunk_size
LLM_RESPONSE_INVALID = "LLM_RESPONSE_INVALID"


class AIServicer(ai_pb2_grpc.AIServiceServicer):
    """AIService gRPC 实现：提供结构化分析和文本向量能力。"""

    def __init__(
        self,
        model_service: AIModelService | Any | None = None,
        log_service: LogService | Any | None = None,
        audit_log_query_service: AuditLogQueryService | Any | None = None,
    ):
        # 支持注入,在不调用外部模型的情况下测试 Handler。
        self.model_service = model_service or AIModelService()
        # 单元测试使用内存 fake；未注入时保持既有纯模型测试无需数据库。
        self.log_service = log_service
        self.audit_log_query_service = audit_log_query_service

    def PagedSearchAuditLogs(self, request, context):
        """ADMIN 分页查询 AI 独立数据库中的脱敏审计日志。"""
        if self.audit_log_query_service is None:
            self._audit_failure(request, "PagedSearchAuditLogs", "QUERY_SERVICE_UNAVAILABLE")
            context.abort(grpc.StatusCode.UNAVAILABLE, "audit log query unavailable")
        try:
            page = self.audit_log_query_service.paged_search(
                requester_role=request.user_role,
                page=request.page,
                page_size=request.page_size,
                level=request.level,
                created_at_from=request.created_at_from,
                created_at_to=request.created_at_to,
                target_user_id=request.target_user_id,
            )
            response = audit_pb2.PagedSearchAuditLogsResponse(
                items=[self._audit_log_item(item) for item in page.items],
                total=page.total,
                page=page.page,
                page_size=page.page_size,
            )
            self._audit_success(request, "PagedSearchAuditLogs")
            return response
        except PermissionError:
            self._audit_failure(request, "PagedSearchAuditLogs", "PERMISSION_DENIED")
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "ADMIN role required")
        except ValueError as exception:
            self._audit_failure(request, "PagedSearchAuditLogs", "INVALID_ARGUMENT")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exception))
        except Exception:
            logger.exception("分页查询 AI 审计日志失败")
            self._audit_failure(request, "PagedSearchAuditLogs", "INTERNAL_ERROR")
            context.abort(grpc.StatusCode.INTERNAL, "server error")

    @staticmethod
    def _audit_log_item(item: Any):
        return audit_pb2.AuditLogItem(
            id=item.id,
            trace_id=item.trace_id or 0,
            user_id=item.user_id,
            user_name=item.user_name or "",
            user_type="",
            user_ip=item.user_ip or "",
            level=item.level or "",
            request_method=item.request_method or "",
            request_url=item.request_url or "",
            error_msg=item.error_msg or "",
            detail=item.detail or "",
            created_at=item.created_at.isoformat() if item.created_at else "",
        )

    def AnalyzeJobDescription(self, request, context):
        """调用星火分析 JD；请求只接收 jd 一个业务参数。"""
        jd = request.jd.strip()
        if not jd:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "jd 不能为空")
        if len(jd) > MAX_JD_LENGTH:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "jd 长度超过上限")

        try:
            result = self.model_service.analyze_job_description(jd)
            analysis = result.value
            logger.info("AnalyzeJobDescription 完成: jd_length=%d", len(jd))
            return ai_pb2.AnalyzeJobDescriptionResponse(
                skills=[
                    ai_pb2.AnalyzedSkill(
                        name=skill.name,
                        proficiency=skill.proficiency,
                        evidence=skill.evidence,
                    )
                    for skill in analysis.skills
                ],
                source_llm_response=result.source_llm_response,
            )
        except ModelResponseError as exception:
            logger.error("AnalyzeJobDescription 响应校验失败")
            return ai_pb2.AnalyzeJobDescriptionResponse(
                source_llm_response=exception.source_llm_response,
                error_code=LLM_RESPONSE_INVALID,
            )
        except ModelConfigurationError:
            logger.exception("AnalyzeJobDescription 失败：星火模型未配置")
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "星火模型未配置")
        except Exception:
            logger.exception("AnalyzeJobDescription 失败")
            context.abort(grpc.StatusCode.INTERNAL, "JD 分析服务暂不可用")

    def AnalyzeResume(self, request, context):
        """抽取简历字段，并将原始响应仅透传给内部任务表审查。"""
        content = request.content.strip()
        if not content:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "content 不能为空")
        if len(content) > MAX_RESUME_CONTENT_LENGTH:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "content 长度超过上限")

        try:
            result = self.model_service.analyze_resume(content)
            analysis = result.value
            counts = {
                "education": len(analysis.education_experience),
                "work": len(analysis.work_experience),
                "project": len(analysis.project_experience),
                "skills": len(analysis.professional_skills),
                "awards": len(analysis.awards),
            }
            logger.info(
                "AnalyzeResume 完成: content_length=%d, counts=%s",
                len(content),
                counts,
            )
            return ai_pb2.AnalyzeResumeResponse(
                resume_json=analysis.model_dump_json(),
                source_llm_response=result.source_llm_response,
            )
        except ModelResponseError as exception:
            logger.error("AnalyzeResume 响应校验失败")
            return ai_pb2.AnalyzeResumeResponse(
                source_llm_response=exception.source_llm_response,
                error_code=LLM_RESPONSE_INVALID,
            )
        except ModelConfigurationError:
            logger.exception("AnalyzeResume 失败：星火模型未配置")
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "星火模型未配置")
        except OpenAIError as exception:
            logger.error("AnalyzeResume 供应商调用失败: type=%s", type(exception).__name__)
            context.abort(grpc.StatusCode.UNAVAILABLE, "简历分析模型暂不可用")
        except Exception as exception:
            # ValidationError 可能包含模型原值，日志只记录类型，避免泄露简历内容。
            logger.error("AnalyzeResume 校验失败: type=%s", type(exception).__name__)
            context.abort(grpc.StatusCode.INTERNAL, "简历分析服务暂不可用")

    def AnalyzeUserSkills(self, request, context):
        """从简历正文提取技能；证据已在业务层完成原文来源校验。"""
        resume_content = request.resume_content.strip()
        if not resume_content:
            self._audit_failure(request, "AnalyzeUserSkills", "INVALID_ARGUMENT")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "resume_content 不能为空")
        if len(resume_content) > MAX_RESUME_CONTENT_LENGTH:
            self._audit_failure(request, "AnalyzeUserSkills", "INVALID_ARGUMENT")
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "resume_content 长度超过上限",
            )

        try:
            result = self.model_service.analyze_user_skills(resume_content)
            analysis = result.value
            model_name = self.model_service.chat_model_name
            response = ai_pb2.AnalyzeUserSkillsResponse(
                skills=[
                    ai_pb2.AnalyzedSkill(
                        name=skill.name,
                        proficiency=skill.proficiency,
                        evidence=skill.evidence,
                    )
                    for skill in analysis.skills
                ],
                model=model_name,
                source_llm_response=result.source_llm_response,
            )
            self._audit_success(request, "AnalyzeUserSkills")
            logger.info(
                "AnalyzeUserSkills 完成: trace_id=%s, resume_length=%d, skill_count=%d, model=%s",
                request.trace_id,
                len(resume_content),
                len(analysis.skills),
                model_name,
            )
            return response
        except ModelResponseError as exception:
            self._audit_failure(request, "AnalyzeUserSkills", LLM_RESPONSE_INVALID)
            logger.error(
                "AnalyzeUserSkills 响应校验失败: trace_id=%s",
                request.trace_id,
            )
            return ai_pb2.AnalyzeUserSkillsResponse(
                source_llm_response=exception.source_llm_response,
                error_code=LLM_RESPONSE_INVALID,
            )
        except ModelConfigurationError:
            self._audit_failure(request, "AnalyzeUserSkills", "FAILED_PRECONDITION")
            logger.error(
                "AnalyzeUserSkills 失败：星火模型未配置, trace_id=%s",
                request.trace_id,
            )
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "星火模型未配置")
        except OpenAIError as exception:
            self._audit_failure(request, "AnalyzeUserSkills", "UNAVAILABLE")
            logger.error(
                "AnalyzeUserSkills 供应商调用失败: trace_id=%s, type=%s",
                request.trace_id,
                type(exception).__name__,
            )
            context.abort(grpc.StatusCode.UNAVAILABLE, "用户技能分析模型暂不可用")
        except Exception as exception:
            self._audit_failure(request, "AnalyzeUserSkills", "INTERNAL")
            # ValidationError 可能携带模型原值，只记录异常类型，避免泄露简历正文或证据。
            logger.error(
                "AnalyzeUserSkills 校验失败: trace_id=%s, type=%s",
                request.trace_id,
                type(exception).__name__,
            )
            context.abort(grpc.StatusCode.INTERNAL, "用户技能分析服务暂不可用")

    def AnalyzeJobMatch(self, request, context):
        """只使用简历五组结构化字段及 jobs 表公开字段进行匹配。"""
        try:
            # JSONB 经 protobuf 以规范 JSON 文本传输，进入模型前恢复并严格校验结构。
            resume = ResumeMatchProfile.model_validate(
                {
                    "education_experiences": json.loads(
                        request.resume.education_experiences
                    ),
                    "work_experiences": json.loads(request.resume.work_experiences),
                    "project_experiences": json.loads(
                        request.resume.project_experiences
                    ),
                    "professional_skills": json.loads(
                        request.resume.professional_skills
                    ),
                    "awards": json.loads(request.resume.awards),
                }
            )
        except Exception:
            self._audit_failure(request, "AnalyzeJobMatch", "INVALID_ARGUMENT")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "resume 字段不合法")

        try:
            # 显式枚举字段，防止后续 protobuf 扩展被无意传给模型。
            job = JobMatchProfile.model_validate(
                {
                    "name": request.job.name,
                    "publish_date": request.job.publish_date,
                    "source_platform": request.job.source_platform,
                    "source_url": request.job.source_url,
                    "tags": request.job.tags,
                    "major": request.job.major,
                    "nature": request.job.nature,
                    "salary": request.job.salary,
                    "company_name": request.job.company_name,
                    "company_size": request.job.company_size,
                    "city": request.job.city,
                    "province": request.job.province,
                    "education": request.job.education,
                    "experience": request.job.experience,
                    "job_description": request.job.job_description,
                    "occupation_id": request.job.occupation_id,
                }
            )
        except Exception:
            self._audit_failure(request, "AnalyzeJobMatch", "INVALID_ARGUMENT")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "job 字段不合法")

        try:
            result = self.model_service.analyze_job_match(resume, job)
            analysis = result.value
            model_name = self.model_service.chat_model_name
            response = ai_pb2.AnalyzeJobMatchResponse(
                score=analysis.score,
                summary=analysis.summary,
                skills_to_learn=[
                    ai_pb2.SkillLearningSuggestion(
                        skill_name=item.skill_name,
                        reason=item.reason,
                        suggestion=item.suggestion,
                    )
                    for item in analysis.skills_to_learn
                ],
                action_suggestions=analysis.action_suggestions,
                model=model_name,
                source_llm_response=result.source_llm_response,
            )
            self._audit_success(request, "AnalyzeJobMatch")
            resume_items = sum(
                len(items)
                for items in (
                    resume.education_experiences,
                    resume.work_experiences,
                    resume.project_experiences,
                    resume.professional_skills,
                    resume.awards,
                )
            )
            logger.info(
                "AnalyzeJobMatch 完成: trace_id=%s, resume_items=%d, "
                "job_description_length=%d, learning_count=%d, action_count=%d, model=%s",
                request.trace_id,
                resume_items,
                len(job.job_description),
                len(analysis.skills_to_learn),
                len(analysis.action_suggestions),
                model_name,
            )
            return response
        except ModelResponseError as exception:
            self._audit_failure(request, "AnalyzeJobMatch", LLM_RESPONSE_INVALID)
            logger.error(
                "AnalyzeJobMatch 响应校验失败: trace_id=%s",
                request.trace_id,
            )
            return ai_pb2.AnalyzeJobMatchResponse(
                source_llm_response=exception.source_llm_response,
                error_code=LLM_RESPONSE_INVALID,
            )
        except ModelConfigurationError:
            self._audit_failure(request, "AnalyzeJobMatch", "FAILED_PRECONDITION")
            logger.error(
                "AnalyzeJobMatch 失败：星火模型未配置, trace_id=%s",
                request.trace_id,
            )
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "星火模型未配置")
        except OpenAIError as exception:
            self._audit_failure(request, "AnalyzeJobMatch", "UNAVAILABLE")
            logger.error(
                "AnalyzeJobMatch 供应商调用失败: trace_id=%s, type=%s",
                request.trace_id,
                type(exception).__name__,
            )
            context.abort(grpc.StatusCode.UNAVAILABLE, "人岗匹配模型暂不可用")
        except Exception as exception:
            self._audit_failure(request, "AnalyzeJobMatch", "INTERNAL")
            # 不记录异常正文，避免 Pydantic 错误把简历或岗位原文写入日志。
            logger.error(
                "AnalyzeJobMatch 校验失败: trace_id=%s, type=%s",
                request.trace_id,
                type(exception).__name__,
            )
            context.abort(grpc.StatusCode.INTERNAL, "人岗匹配服务暂不可用")

    def EmbedText(self, request, context):
        """调用 Qwen 生成单条文本的嵌入向量。"""
        text = request.text.strip()
        if not text:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "text 不能为空")

        dimensions = request.dimensions or DEFAULT_DIMENSIONS
        self._validate_dimensions(dimensions, context)

        try:
            matrix = self.model_service.embed_texts(
                [text],
                dimensions=dimensions,
                chunk_size=1,
            )
            if len(matrix) != 1:
                raise RuntimeError("单条嵌入接口返回数量异常")
            values = self._vector_values(matrix[0])
            self._validate_vector_dimensions(values, dimensions)
            logger.info("EmbedText 完成: trace_id=%s, dimensions=%d", request.trace_id, dimensions)
            return ai_pb2.EmbedTextResponse(
                embedding=values,
                dimensions=len(values),
                model=self.model_service.embedding_model.model_name,
            )
        except ModelConfigurationError:
            logger.exception("EmbedText 失败：Qwen 嵌入模型未配置, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "嵌入模型未配置")
        except Exception:
            logger.exception("EmbedText 失败, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.INTERNAL, "嵌入服务暂不可用")

    def BatchEmbedText(self, request, context):
        """调用 Qwen 分批生成文本嵌入向量，结果与输入顺序一一对应。"""
        texts = list(request.texts)
        if not texts:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 不能为空")
        if len(texts) > MAX_BATCH_SIZE:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 数量超过上限")
        if any(not text.strip() for text in texts):
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "texts 不能包含空文本")

        dimensions = request.dimensions or DEFAULT_DIMENSIONS
        chunk_size = request.chunk_size or DEFAULT_CHUNK_SIZE
        self._validate_dimensions(dimensions, context)
        if not 1 <= chunk_size <= MAX_CHUNK_SIZE:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "chunk_size 不在允许范围内")

        try:
            matrix = self.model_service.embed_texts(
                texts,
                dimensions=dimensions,
                chunk_size=chunk_size,
            )
            if len(matrix) != len(texts):
                raise RuntimeError("嵌入向量数量与输入文本数量不一致")

            embeddings = []
            for vector in matrix:
                values = self._vector_values(vector)
                self._validate_vector_dimensions(values, dimensions)
                embeddings.append(ai_pb2.EmbeddingVector(values=values))

            logger.info(
                "BatchEmbedText 完成: trace_id=%s, count=%d, dimensions=%d",
                request.trace_id,
                len(texts),
                dimensions,
            )
            return ai_pb2.BatchEmbedTextResponse(
                embeddings=embeddings,
                dimensions=dimensions,
                model=self.model_service.embedding_model.model_name,
            )
        except ModelConfigurationError:
            logger.exception("BatchEmbedText 失败：Qwen 嵌入模型未配置, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "嵌入模型未配置")
        except Exception:
            logger.exception("BatchEmbedText 失败, trace_id=%s", request.trace_id)
            context.abort(grpc.StatusCode.INTERNAL, "嵌入服务暂不可用")

    def _audit_success(self, request: Any, operation: str) -> None:
        """只记录操作名和六项审计上下文，绝不传入模型业务正文。"""
        if self.log_service is None:
            return
        try:
            self.log_service.info(
                **self._audit_fields(request),
                detail=f"{operation} 成功",
            )
        except Exception as exception:
            # 注入实现即使不遵守 LogService 的吞错约定，也不能阻断 RPC。
            logger.error(
                "调用 AI 审计日志服务失败（已忽略）: type=%s",
                type(exception).__name__,
            )

    def _audit_failure(self, request: Any, operation: str, code: str) -> None:
        """记录脱敏失败码；不记录异常消息、简历、岗位或建议内容。"""
        if self.log_service is None:
            return
        try:
            self.log_service.error(
                **self._audit_fields(request),
                error_msg=code,
                detail=f"{operation} 失败",
            )
        except Exception as exception:
            logger.error(
                "调用 AI 审计日志服务失败（已忽略）: type=%s",
                type(exception).__name__,
            )

    @staticmethod
    def _audit_fields(request: Any) -> dict[str, Any]:
        """显式白名单六项网关审计字段，防止 protobuf 新字段自动落库。"""
        return {
            "trace_id": request.trace_id,
            "user_id": request.user_id,
            "user_name": request.user_name,
            "user_ip": request.user_ip,
            "request_method": request.request_method,
            "request_url": request.request_url,
        }

    @staticmethod
    def _validate_dimensions(dimensions: int, context) -> None:
        """限制客户端传入的向量维度，避免异常的大响应占用 gRPC 资源。"""
        if not 1 <= dimensions <= model_config.embedding_max_dimensions:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "dimensions 不在允许范围内")

    @staticmethod
    def _vector_values(vector: Any) -> list[float]:
        """将 NumPy 向量转换为 protobuf 的 float 字段。"""
        return [float(value) for value in vector]

    @staticmethod
    def _validate_vector_dimensions(values: list[float], dimensions: int) -> None:
        """供应商返回维度不符合请求时中止响应，避免脏向量入库。"""
        if len(values) != dimensions:
            raise RuntimeError(
                f"嵌入接口返回维度异常：期望 {dimensions}，实际 {len(values)}"
            )
