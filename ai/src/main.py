# 百工谱 — ai_service 主入口
# Python + FastAPI + gRPC Server — LLM 结构化抽取与嵌入服务

import asyncio
import logging
import socket
from concurrent import futures

import grpc
import uvicorn
from fastapi import FastAPI

from src.config import config
from src.pb import ai_pb2_grpc
from src.server.grpc_server import AIServicer
from src.server.health import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="百工谱 AI Service",
    description="LLM 结构化抽取、文本嵌入、语义归一",
    version="0.1.0",
)
app.include_router(health_router)


def register_to_consul():
    """注册到 Consul"""
    try:
        import consul
        c = consul.Consul(host=config.consul_addr.split(":")[0])
        service_id = f"ai-{socket.gethostname()}"
        c.agent.service.register(
            name=config.service_name,
            service_id=service_id,
            address=socket.gethostbyname(socket.gethostname()),
            port=config.grpc_port,
        )
        logger.info("已在 Consul 注册: %s (id=%s)", config.service_name, service_id)
        return c, service_id
    except Exception as e:
        logger.warning("Consul 注册失败: %s", e)
        return None, None


def deregister_from_consul(consul_client, service_id):
    if consul_client and service_id:
        try:
            consul_client.agent.service.deregister(service_id)
        except Exception:
            pass


def create_grpc_server() -> grpc.Server:
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
        ],
    )
    ai_pb2_grpc.add_AIServiceServicer_to_server(AIServicer(), server)
    return server


async def run_grpc_server(server: grpc.Server):
    server.add_insecure_port(f"[::]:{config.grpc_port}")
    logger.info("gRPC server 启动在端口 %d", config.grpc_port)
    # grpc.server 是同步服务端，不能直接 await；放在线程中避免阻塞 FastAPI。
    server.start()
    await asyncio.to_thread(server.wait_for_termination)


async def main():
    logger.info("正在启动 ai_service...")
    consul_client, service_id = register_to_consul()
    grpc_server = create_grpc_server()

    try:
        grpc_task = asyncio.create_task(run_grpc_server(grpc_server))
        config_uvicorn = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
        await uvicorn.Server(config_uvicorn).serve()
    except asyncio.CancelledError:
        logger.info("正在关闭 ai_service...")
    finally:
        deregister_from_consul(consul_client, service_id)
        grpc_server.stop(grace=5)
        logger.info("ai_service 已安全关闭")


if __name__ == "__main__":
    asyncio.run(main())
