# syntax=docker/dockerfile:1.7

FROM python:3.12-slim

WORKDIR /app

ARG APT_MIRROR=https://mirrors.tuna.tsinghua.edu.cn
COPY docker/apt/configure_china_mirror.sh /usr/local/bin/configure-apt-mirror
RUN APT_MIRROR="${APT_MIRROR}" sh /usr/local/bin/configure-apt-mirror \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY ai/requirements.txt requirements.txt
# 网络较慢时，默认 15 秒读取超时会中断大体积 arm64 wheel 下载。
RUN pip install -i https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple --timeout 180 -r requirements.txt
COPY proto/ai/ /app/proto/ai/
COPY ai/src/ ./src/
# 在镜像内生成 AI gRPC stub，部署不依赖本地生成物。
RUN mkdir -p /app/pb_gen /app/src/pb \
    && python -m grpc_tools.protoc \
       -I /app/proto \
       --python_out=/app/pb_gen \
       --grpc_python_out=/app/pb_gen \
       /app/proto/ai/ai.proto \
    && cp /app/pb_gen/ai/ai_pb2.py /app/pb_gen/ai/ai_pb2_grpc.py /app/src/pb/ \
    && sed -i 's/^from ai import ai_pb2 as ai_dot_ai__pb2/from . import ai_pb2 as ai_dot_ai__pb2/' /app/src/pb/ai_pb2_grpc.py \
    && touch /app/src/pb/__init__.py
EXPOSE 50053 8000
ENTRYPOINT ["python", "-m", "src.main"]
