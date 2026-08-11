"""crawler → ai-service gRPC 客户端契约测试。"""

import unittest
from unittest.mock import patch

import grpc

from src.client.ai_grpc_client import AIGrpcClient, AIServiceUnavailableError
from src.pb import ai_pb2


class FakeAIStub:
    def BatchEmbedText(self, request, timeout):
        self.request = request
        self.timeout = timeout
        return ai_pb2.BatchEmbedTextResponse(
            embeddings=[
                ai_pb2.EmbeddingVector(values=[0.25] * request.dimensions)
                for _ in request.texts
            ],
            dimensions=request.dimensions,
            model="qwen-test",
        )


class UnavailableRpcError(grpc.RpcError):
    """模拟 AI 服务连接不可用。"""

    def code(self):
        return grpc.StatusCode.UNAVAILABLE


class FailingAIStub:
    def __init__(self) -> None:
        self.calls = 0

    def BatchEmbedText(self, request, timeout):
        self.calls += 1
        raise UnavailableRpcError()


class AIGrpcClientTest(unittest.TestCase):
    def test_batch_embedding_contract_and_audit_context(self):
        stub = FakeAIStub()
        client = AIGrpcClient(
            consul_addr="127.0.0.1:8500",
            service_name="ai-service",
            direct_target="ai:50053",
            timeout_seconds=2,
            dimensions=1024,
            chunk_size=20,
        )
        try:
            with patch.object(client, "_get_stub", return_value=stub):
                vectors = client.embed_texts(
                    ["JD-1", "JD-2"],
                    {
                        "trace_id": 1001,
                        "user_id": 9,
                        "user_name": "admin",
                        "request_method": "POST",
                        "request_url": "/api/auth/crawl",
                    },
                )
        finally:
            client.close()

        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), 1024)
        self.assertEqual(stub.request.dimensions, 1024)
        self.assertEqual(stub.request.chunk_size, 2)
        self.assertEqual(stub.request.trace_id, "1001")
        self.assertEqual(stub.request.user_id, 9)
        self.assertEqual(stub.timeout, 2)

    def test_unavailable_request_is_not_retried(self):
        stub = FailingAIStub()
        client = AIGrpcClient(
            consul_addr="127.0.0.1:8500",
            service_name="ai-service",
            direct_target="ai:50053",
        )
        try:
            with patch.object(client, "_get_stub", return_value=stub):
                with self.assertRaises(AIServiceUnavailableError):
                    client.embed_texts(["JD"], {})
        finally:
            client.close()

        self.assertEqual(stub.calls, 1)


if __name__ == "__main__":
    unittest.main()
