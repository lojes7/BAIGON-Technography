# 百工谱 — crawler_service
# 真实爬虫（DrissionPage）依赖系统 chromium

FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖：psycopg2 编译 + DrissionPage 浏览器（chromium）+ 中文字体（防反爬检测）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源码
COPY src/ ./src/

EXPOSE 50051 8000

ENTRYPOINT ["python", "-m", "src.main"]
