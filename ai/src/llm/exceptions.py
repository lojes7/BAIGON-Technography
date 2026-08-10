"""模型适配层的领域异常。"""


class ModelConfigurationError(RuntimeError):
    """模型调用所需的环境变量未配置时抛出。"""
