"""讯飞星火 OpenAI 兼容接口适配器。"""

from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from src.config import config
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
        self.model_name = model_name or config.spark_model
        self.api_password = api_password if api_password is not None else config.spark_api_password
        self.base_url = base_url or config.spark_base_url
        # 延迟创建客户端：服务启动无需依赖模型凭据，首次实际调用时才校验。
        self._client = client

    def _get_client(self) -> OpenAI | Any:
        """获取客户端，并在真实请求前校验必要配置。"""
        if self._client is not None:
            return self._client
        if not self.api_password:
            raise ModelConfigurationError("未配置 SPARK_API_PASSWORD")

        self._client = OpenAI(api_key=self.api_password, base_url=self.base_url)
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
    ) -> str:
        """向星火发送一轮对话，并只返回模型正文。"""
        if not h_msg or not h_msg.strip():
            raise ValueError("用户消息不能为空")
        if not 0 <= temperature <= 1:
            raise ValueError("temperature 必须介于 0 和 1 之间")
        if max_tokens <= 0:
            raise ValueError("max_tokens 必须大于 0")
        if search_mode not in {"deep", "simple"}:
            raise ValueError("search_mode 仅支持 deep 或 simple")

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
        }
        if enable_web_search:
            request_params["tools"] = [
                {
                    "type": "web_search",
                    "web_search": {"enable": True, "search_mode": search_mode},
                }
            ]

        completion = self._get_client().chat.completions.create(**request_params)
        if stream:
            return self._collect_stream(completion)

        if not completion.choices:
            raise RuntimeError("星火模型未返回可用结果")
        return completion.choices[0].message.content or ""

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
