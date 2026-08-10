# 百工谱 — crawler_service

FROM python:3.12-slim

# 国内网络默认走镜像站；其他网络可通过 --build-arg APT_MIRROR/PIP_INDEX_URL 覆盖。
ARG APT_MIRROR=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

# 安装系统依赖：psycopg2 编译 + DrissionPage 浏览器（chromium）+ 中文字体（防反爬检测）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（含 grpcio-tools，构建期生成 stub 用）
COPY crawler/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 生成 python gRPC stub（在镜像内完成，部署免手动 make python-crawler）
COPY proto/ /app/proto/
COPY crawler/src/ /app/src/
RUN mkdir -p /app/pb_gen \
    && python -m grpc_tools.protoc \
    -I /app/proto \
    --python_out=/app/pb_gen \
    --grpc_python_out=/app/pb_gen \
    /app/proto/common/*.proto /app/proto/crawler/*.proto \
    && mkdir -p /app/src/pb \
    && cp /app/pb_gen/crawler/crawler_pb2.py /app/pb_gen/crawler/crawler_pb2_grpc.py \
       /app/pb_gen/common/evidence_pb2.py /app/pb_gen/common/evidence_pb2_grpc.py \
       /app/src/pb/ \
    && sed -i 's/^from common import evidence_pb2 as common_dot_evidence__pb2/from . import evidence_pb2 as common_dot_evidence__pb2/' /app/src/pb/crawler_pb2.py \
    && sed -i 's/^from crawler import crawler_pb2 as crawler_dot_crawler__pb2/from . import crawler_pb2 as crawler_dot_crawler__pb2/' /app/src/pb/crawler_pb2_grpc.py \
    && touch /app/src/pb/__init__.py

EXPOSE 50051 8000

ENTRYPOINT ["python", "-m", "src.main"]
