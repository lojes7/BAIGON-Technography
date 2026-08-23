"""模型适配层的领域异常。"""


class ModelConfigurationError(RuntimeError):
    """模型调用所需的环境变量未配置时抛出。"""


class ModelResponseError(RuntimeError):
    """模型已经返回内容，但响应形状或业务契约不合法。"""

    def __init__(self, message: str, source_llm_response: str):
        super().__init__(message)
        # 原始响应只通过内部 gRPC 返回并持久化，异常消息中绝不携带其内容。
        self.source_llm_response = source_llm_response
