"""讯飞星火 OpenAI 兼容接口适配器。"""

from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from src.config import config, model_config
from src.llm.exceptions import ModelConfigurationError


class SparkModel:
    """封装星火对话模型，屏蔽 OpenAI 兼容接口的连接细节。"""

    def __init__(
        self,
        model_name: str | None = None,
        api_password: str | None = None,
        base_url: str | None = None,
        client: OpenAI | Any | None = None,
    ):
        self.model_name = model_name or model_config.spark_model
        self.api_password = (
            api_password if api_password is not None else config.spark_api_password
        )
        self.base_url = base_url or model_config.spark_base_url
        # 延迟创建客户端：服务启动无需依赖模型凭据，首次实际调用时才校验。
        self._client = client

    def _get_client(self) -> OpenAI | Any:
        """获取客户端，并在真实请求前校验必要配置。"""
        if self._client is not None:
            return self._client
        if not self.api_password:
            raise ModelConfigurationError("未配置 SPARK_API_PASSWORD")

        self._client = OpenAI(
            api_key=self.api_password,
            base_url=self.base_url,
            max_retries=model_config.provider_max_retries,
        )
        return self._client

    def question(
        self,
        s_msg: str,
        h_msg: str,
        stream: bool = False,
        enable_web_search: bool = False,
        search_mode: str = "deep",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        uid: str = "baigon-ai-service",
        response_function: dict[str, Any] | None = None,
        timeout_seconds: float | None = None,
    ) -> str:
        """向星火发送一轮对话；指定响应函数时返回其 JSON 参数。"""
        if not h_msg or not h_msg.strip():
            raise ValueError("用户消息不能为空")
        if not 0 <= temperature <= 1:
            raise ValueError("temperature 必须介于 0 和 1 之间")
        if max_tokens <= 0:
            raise ValueError("max_tokens 必须大于 0")
        if search_mode not in {"deep", "simple"}:
            raise ValueError("search_mode 仅支持 deep 或 simple")
        if response_function is not None:
            if stream:
                raise ValueError("结构化函数调用不支持流式响应")
            if enable_web_search:
                raise ValueError("结构化函数调用不能同时启用联网搜索")
            self._validate_response_function(response_function)

        messages: list[dict[str, str]] = []
        if s_msg and s_msg.strip():
            messages.append({"role": "system", "content": s_msg})
        messages.append({"role": "user", "content": h_msg})

        request_params: dict[str, Any] = {
            "model": self.model_name,
            "user": uid,
            "messages": messages,
            "stream": stream,
            "temperature": temperature,
            "max_tokens": max_tokens,
            # 每类业务在其上游 gRPC deadline 前主动释放同步 worker。
            "timeout": timeout_seconds or model_config.provider_default_timeout_seconds,
        }
        if enable_web_search:
            request_params["tools"] = [
                {
                    "type": "web_search",
                    "web_search": {"enable": True, "search_mode": search_mode},
                }
            ]
        elif response_function is not None:
            function_name = response_function["name"]
            request_params["tools"] = [
                {
                    "type": "function",
                    "function": response_function,
                }
            ]
            # X2-Flash 的 force 模式使用 name 直接指定必须调用的函数。
            request_params["tool_choice"] = {
                "type": "function",
                "name": function_name,
            }

        completion = self._get_client().chat.completions.create(**request_params)
        if stream:
            return self._collect_stream(completion)

        if not completion.choices:
            raise RuntimeError("星火模型未返回可用结果")
        message = completion.choices[0].message
        if response_function is not None:
            return self._function_arguments(message, response_function["name"])
        return message.content or ""

    @staticmethod
    def _validate_response_function(response_function: dict[str, Any]) -> None:
        """在发送请求前检查函数定义，避免把不完整 Schema 交给供应商。"""
        name = response_function.get("name")
        parameters = response_function.get("parameters")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("响应函数 name 不能为空")
        if not isinstance(parameters, dict) or parameters.get("type") != "object":
            raise ValueError("响应函数 parameters 必须是 object JSON Schema")

    @staticmethod
    def _function_arguments(message: Any, expected_name: str) -> str:
        """只接受一次指定函数调用，拒绝正文或其他工具结果。"""
        tool_calls = getattr(message, "tool_calls", None)
        if not tool_calls or len(tool_calls) != 1:
            raise RuntimeError("星火模型未返回唯一的结构化函数调用")

        tool_call = tool_calls[0]
        function = getattr(tool_call, "function", None)
        if getattr(tool_call, "type", None) != "function" or function is None:
            raise RuntimeError("星火模型返回了非函数类型的工具调用")
        if getattr(function, "name", None) != expected_name:
            raise RuntimeError("星火模型调用了非预期函数")

        arguments = getattr(function, "arguments", None)
        if not isinstance(arguments, str) or not arguments.strip():
            raise RuntimeError("星火模型返回的函数参数为空")
        return arguments

    def _collect_stream(self, stream_response: Iterator[Any]) -> str:
        """汇总流式响应；推理内容不记录也不输出，避免污染服务日志。"""
        contents: list[str] = []
        for chunk in stream_response:
            if not chunk.choices:
                continue
            content = getattr(chunk.choices[0].delta, "content", None)
            if content:
                contents.append(content)
        return "".join(contents)
