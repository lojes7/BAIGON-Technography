# 百工谱 — crawler_service 主入口
# Python + FastAPI + gRPC Server

import asyncio
import logging
import socket
from concurrent import futures

import grpc
import uvicorn
from fastapi import FastAPI

from src.config import config
from src.kafka.producer import KafkaProducerClient
from src.pb import crawler_pb2_grpc
from src.server.grpc_server import CrawlerServicer
from src.server.health import router as health_router
from src.dao.db import Database

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("crawler-service")

# 创建 FastAPI 应用（用于健康检查和 REST 辅助接口）
app = FastAPI(
    title="百工谱 Crawler Service",
    description="多源数据采集服务",
    version="0.1.0",
)
app.include_router(health_router)


# Consul 服务注册
def register_to_consul():
    """将服务注册到 Consul"""
    try:
        import consul

        c = consul.Consul(host=config.consul_addr.split(":")[0])
        service_id = f"crawler-{socket.gethostname()}"
        c.agent.service.register(
            name=config.service_name,
            service_id=service_id,
            address=socket.gethostbyname(socket.gethostname()),
            port=config.grpc_port,
        )
        logger.info(
            "已在 Consul 注册: %s (id=%s, port=%d)",
            config.service_name,
            service_id,
            config.grpc_port,
        )
        return c, service_id
    except Exception as e:
        logger.warning("Consul 注册失败（将影响服务发现）: %s", e)
        return None, None


def deregister_from_consul(consul_client, service_id):
    """从 Consul 注销服务"""
    if consul_client and service_id:
        try:
            consul_client.agent.service.deregister(service_id)
            logger.info("已从 Consul 注销: %s", service_id)
        except Exception:
            pass


# gRPC Server
def create_grpc_server(db: Database, producer: KafkaProducerClient) -> grpc.Server:
    """创建 gRPC 服务器并注册 CrawlerService（stub 实现）"""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),  # 50MB
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
        ],
    )

    # 注册 crawler_service（桩实现）
    # TODO: 导入生成的 proto stub
    # from proto.gen.python.crawler import crawler_pb2_grpc
    # crawler_pb2_grpc.add_CrawlerServiceServicer_to_server(CrawlerServicer(), server)

    return server


async def run_grpc_server(server: grpc.Server):
    """在后台运行 gRPC 服务器"""
    port = server.add_insecure_port(f"[::]:{config.grpc_port}")
    logger.info("gRPC server 启动在端口 %d", config.grpc_port)
    await server.start()
    await server.wait_for_termination()


async def main():
    """主函数"""
    logger.info("正在启动 crawler_service...")

    # 注册到 Consul
    consul_client, service_id = register_to_consul()

    # 初始化依赖：数据库连接池 + Kafka 生产者
    db = Database(config.db_dsn)
    producer = KafkaProducerClient(
        config.kafka_bootstrap_servers, config.kafka_topic_ingested
    )

    # 创建并启动 gRPC 服务器
    grpc_server = create_grpc_server(db, producer)

    try:
        # 同时运行 FastAPI (健康检查) 和 gRPC
        grpc_task = asyncio.create_task(run_grpc_server(grpc_server))

        config_uvicorn = uvicorn.Config(
            app, host="0.0.0.0", port=8000, log_level="info"
        )
        server_uvicorn = uvicorn.Server(config_uvicorn)
        await server_uvicorn.serve()

    except asyncio.CancelledError:
        logger.info("正在关闭 crawler_service...")
    finally:
        deregister_from_consul(consul_client, service_id)
        grpc_server.stop(grace=5)
        producer.close()
        db.close()
        logger.info("crawler_service 已安全关闭")


if __name__ == "__main__":
    asyncio.run(main())
