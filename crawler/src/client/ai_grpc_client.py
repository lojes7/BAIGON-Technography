"""通过 Consul 发现 ai-service，并调用 Qwen 文本嵌入接口。"""

import logging
import math
import threading
from typing import Any

import consul
import grpc

from src.pb import ai_pb2, ai_pb2_grpc

logger = logging.getLogger(__name__)


class AIServiceUnavailableError(RuntimeError):
    """AI 服务发现或 gRPC 调用失败。"""


class AIGrpcClient:
    """线程安全的 AI gRPC 客户端，每个嵌入请求只调用一次。"""

    def __init__(
        self,
        consul_addr: str,
        service_name: str,
        direct_target: str = "",
        timeout_seconds: float = 30,
        dimensions: int = 1024,
        chunk_size: int = 20,
    ) -> None:
        host, _, port_text = consul_addr.partition(":")
        self._consul = consul.Consul(host=host, port=int(port_text or "8500"))
        self._service_name = service_name
        self._direct_target = direct_target.strip()
        self._timeout_seconds = timeout_seconds
        self._dimensions = dimensions
        self._chunk_size = chunk_size
        self._lock = threading.Lock()
        self._target = ""
        self._channel: grpc.Channel | None = None
        self._stub: Any | None = None

    def embed_texts(self, texts: list[str], log_ctx: dict) -> list[list[float]]:
        """批量生成向量；任何错误都直接返回给上层，不在客户端重试。"""
        if not texts:
            return []

        request = ai_pb2.BatchEmbedTextRequest(
            texts=texts,
            dimensions=self._dimensions,
            chunk_size=min(len(texts), self._chunk_size),
            trace_id=str(log_ctx.get("trace_id") or ""),
            user_id=int(log_ctx.get("user_id") or 0),
            user_name=log_ctx.get("user_name") or "system",
            user_ip=log_ctx.get("user_ip") or "",
            request_method=log_ctx.get("request_method") or "",
            request_url=log_ctx.get("request_url") or "",
        )

        try:
            stub = self._get_stub()
            response = stub.BatchEmbedText(request, timeout=self._timeout_seconds)
            vectors = [list(item.values) for item in response.embeddings]
            self._validate_response(vectors, len(texts), response.dimensions)
            return vectors
        except grpc.RpcError as exc:
            # 失效连接只做清理；本次请求不重新发现、不再次调用。
            if exc.code() == grpc.StatusCode.UNAVAILABLE:
                self._invalidate_channel()
            logger.warning("AI 嵌入调用失败: %s", exc)
            raise AIServiceUnavailableError(str(exc)) from exc
        except AIServiceUnavailableError:
            raise
        except Exception as exc:
            logger.warning("AI 嵌入调用失败: %s", exc)
            raise AIServiceUnavailableError(str(exc)) from exc

    def close(self) -> None:
        """关闭缓存的 gRPC channel。"""
        with self._lock:
            if self._channel is not None:
                self._channel.close()
            self._channel = None
            self._stub = None
            self._target = ""

    def _get_stub(self):
        with self._lock:
            target = self._direct_target or self._discover_target()
            if self._stub is not None and target == self._target:
                return self._stub

            self._close_channel_locked()
            self._target = target
            self._channel = grpc.insecure_channel(target)
            self._stub = ai_pb2_grpc.AIServiceStub(self._channel)
            logger.info("已连接 AI 服务: %s", target)
            return self._stub

    def _discover_target(self) -> str:
        """从 Consul 选择一个健康的 AI 服务实例。"""
        _, services = self._consul.health.service(
            self._service_name, passing=True
        )
        if not services:
            raise AIServiceUnavailableError(
                f"Consul 中没有健康的 {self._service_name} 实例"
            )

        service = services[0]
        service_info = service.get("Service", {})
        node_info = service.get("Node", {})
        address = service_info.get("Address") or node_info.get("Address")
        port = service_info.get("Port")
        if not address or not port:
            raise AIServiceUnavailableError("Consul 返回的 AI 服务地址不完整")
        return f"{address}:{port}"

    def _validate_response(
        self,
        vectors: list[list[float]],
        expected_count: int,
        response_dimensions: int,
    ) -> None:
        if len(vectors) != expected_count:
            raise AIServiceUnavailableError(
                f"AI 返回向量数量异常：期望 {expected_count}，实际 {len(vectors)}"
            )
        if response_dimensions != self._dimensions:
            raise AIServiceUnavailableError(
                f"AI 返回维度异常：期望 {self._dimensions}，实际 {response_dimensions}"
            )
        for vector in vectors:
            if len(vector) != self._dimensions:
                raise AIServiceUnavailableError(
                    f"AI 返回向量长度异常：期望 {self._dimensions}，实际 {len(vector)}"
                )
            if any(not math.isfinite(value) for value in vector):
                raise AIServiceUnavailableError("AI 返回向量包含 NaN 或 Infinity")

    def _invalidate_channel(self) -> None:
        with self._lock:
            self._close_channel_locked()

    def _close_channel_locked(self) -> None:
        if self._channel is not None:
            self._channel.close()
        self._channel = None
        self._stub = None
        self._target = ""
