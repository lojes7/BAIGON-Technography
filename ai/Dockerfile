FROM python:3.12-slim

# 国内网络默认走镜像站；其他网络可通过 --build-arg APT_MIRROR/PIP_INDEX_URL 覆盖。
ARG APT_MIRROR=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
# 网络较慢时，默认 15 秒读取超时会中断大体积 arm64 wheel 下载。
RUN pip install --no-cache-dir --prefer-binary --retries 5 --timeout 180 -r requirements.txt
COPY src/ ./src/
EXPOSE 50053 8000
ENTRYPOINT ["python", "-m", "src.main"]
