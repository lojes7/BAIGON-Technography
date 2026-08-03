# Baigon Technography

## 快速开始

### 前置条件

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Docker | 24.0+ | 需包含 Docker Compose v2 |
| protoc | 3.25+ | Protocol Buffers 编译器 |
| protoc-gen-go | 1.36+ | Go gRPC 插件 |
| protoc-gen-go-grpc | 1.3+ | Go gRPC 服务端/客户端插件 |

> **说明**：Java 服务的 proto 在 Docker 构建时由 Maven 插件自动编译，Python 服务在镜像内自行处理，因此本地只需要安装 protoc 的 Go 插件。

安装 protoc 及 Go 插件：

```bash
# macOS
brew install protobuf
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# 确保 $GOPATH/bin 在 PATH 中
export PATH="$PATH:$(go env GOPATH)/bin"
```

### 1. 克隆项目

```bash
git clone git@github.com:your-org/baigon-technography.git
cd baigon-technography
```

### 2. 配置环境变量

项目根目录已提供 `.env.example` 文件作为参考：

将`.env.example`重命名为`.env`，并修改 `.env` 中的重要配置项：

| 变量 | 说明      | 默认值 |
|------|---------|--|
| `JWT_SECRET` | JWT 签名密钥|  |
| `POSTGRES_PASSWORD` | 数据库主密码  | `123456` |
| `MINIO_ROOT_PASSWORD` | MinIO 对象存储密码 | `12345678` |
| `APPID` / `API_KEY` / `API_SECRET` | 大模型 API 凭证 |  |
| `DASHSCOPE_API_KEY` | 阿里云DashScope API 密钥 |  |

### 3. 生成 Proto 代码

> **重要**：`gateway/pb/` 目录被 `.gitignore` 忽略，**必须在构建镜像前**生成，否则网关服务无法编译。

```bash
# 在 proto 目录下生成 Go gRPC stub
cd proto
make go
cd ..
```

执行成功后，`gateway/pb/` 下会生成：
```
gateway/pb/
├── commonpb/   # 公共消息定义（evidence.proto）
└── userpb/     # 用户服务 gRPC 接口
```

如需同时生成 Python / Java stub（本地调试）：

```bash
cd proto
make all    # 生成 python + java + go 全部 stub
cd ..
```

### 4. 启动全部服务

```bash
docker compose up -d
```

查看启动日志：

```bash
docker compose logs -f
```

### 5. 按需启动

如果只需部分服务，可指定启动：

```bash
# 仅启动基础设施（Consul + Kafka + PostgreSQL + MinIO）
docker compose up -d consul zookeeper kafka postgres minio

# 启动基础设施 + 网关
docker compose up -d consul postgres gateway

# 启动基础设施 + 单个业务服务
docker compose up -d consul postgres kafka crawler
```

## 验证服务

启动完成后，按以下步骤验证各服务是否正常运行：

### 1) 检查容器状态

```bash
docker compose ps
```

所有服务 `STATUS` 列应显示 `healthy` 或 `Up`。

### 2) 访问控制台

| 服务 | 地址 | 账号 |
|------|------|------|
| Consul 控制台 | http://localhost:8500 | 无需登录 |
| MinIO 控制台 | http://localhost:9001 | `admin` / `12345678` |

在 Consul 控制台的 **Services** 页面可看到所有注册的微服务。

### 3) 测试网关

```bash
# 网关健康检查
curl http://localhost:8000/health

# 用户登录（获取 JWT Token，种子账号见 user/data.sql）
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "admin", "password": "123456"}'
```

## Swagger API 文档

Gateway 使用 [swaggo](https://github.com/swaggo/swag) 从代码注解自动生成 OpenAPI 2.0 文档。

### 生成文档

```bash
# 安装 swag CLI（仅首次需要）
go install github.com/swaggo/swag/cmd/swag@latest

# 从代码注解生成 Swagger 文档
cd gateway
swag init -g cmd/main.go -o docs/
```

生成后 `gateway/docs/` 下得到 `swagger.json` / `swagger.yaml`。

> **注意**：每次修改了 handler 上的 Swagger 注解（`@Summary`、`@Param`、`@Success` 等）后，需要重新运行 `swag init` 才能使文档更新。

### 访问 Swagger UI

启动 gateway 后访问：

```
http://localhost:<GATEWAY_PORT>/swagger/index.html
```

默认端口为 `8000`：http://localhost:8000/swagger/index.html

> Swagger UI 页面上的请求 Host 默认跟随浏览器地址栏。如果通过 Docker 或其他端口访问，UI 会自动适配目标地址。`@host` 注解仅作为 fallback。

### 网关 API 文档

详细的 REST API 文档（请求体、响应体、错误码、调用链路）见 [gateway/docs/api.md](gateway/docs/api.md)。
