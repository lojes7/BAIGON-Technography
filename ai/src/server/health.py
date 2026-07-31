# 百工谱 — ai_service 健康检查

import socket
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "service": "ai-service",
        "status": "healthy",
        "hostname": socket.gethostname(),
        "time": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
    }
