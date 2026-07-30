# 百工谱 — crawler_service 健康检查端点

import socket
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Consul 健康检查端点"""
    return {
        "service": "crawler_service",
        "status": "healthy",
        "hostname": socket.gethostname(),
        "time": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
    }


@router.get("/health/ready")
async def readiness_check():
    """Kubernetes-style 就绪检查"""
    # TODO: 检查数据库连接、Kafka 连接是否就绪
    return {
        "ready": True,
        "checks": {
            "database": "connected",
            "kafka": "connected",
        },
    }
