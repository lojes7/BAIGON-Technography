FROM python:3.12-slim

# 国内网络默认走镜像站；其他网络可通过 --build-arg APT_MIRROR/PIP_INDEX_URL 覆盖。
ARG APT_MIRROR=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY ai/requirements.txt requirements.txt
# 网络较慢时，默认 15 秒读取超时会中断大体积 arm64 wheel 下载。
RUN pip install --no-cache-dir --prefer-binary --retries 5 --timeout 180 -r requirements.txt
COPY proto/ /app/proto/
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
