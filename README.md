# Baigon Technography

## 快速开始

### 前置条件

| 工具   | 最低版本 | 说明                     |
| ------ | -------- | ------------------------ |
| Docker | 24.0+    | 需包含 Docker Compose v2 |

### 1. 克隆项目

```bash
git clone https://github.com/lojes7/BAIGON-Technography.git
cd baigon-technography
```

### 2. 配置环境变量

项目根目录已提供 `.env.example` 文件作为参考：

将`.env.example`重命名为`.env`，并修改 `.env` 中的重要配置项：

| 变量                               | 说明               | 默认值     |
| ---------------------------------- | ------------------ | ---------- |
| `JWT_SECRET`                       | JWT 签名密钥       |            |
| `POSTGRES_PASSWORD`                | 数据库主密码       | `123456`   |
| `MINIO_ROOT_PASSWORD`              | MinIO 对象存储密码 | `12345678` |
| `APPID` / `API_KEY` / `API_SECRET` | 大模型 API 凭证    |            |
| `DASHSCOPE_API_KEY`                | DashScope API 密钥 |            |

### 3. 生成 Proto 代码（本地开发）

```bash
cd proto
make all   
```

### 4. 启动全部服务

```bash
docker compose up -d
```

查看启动日志：

```bash
docker compose logs -f
```

## 验证服务

启动完成后，按以下步骤验证各服务是否正常运行：

### 1) 检查容器状态

```bash
docker compose ps
```

所有服务 `STATUS` 列应显示 `healthy` 或 `Up`。

### 2) 访问控制台

| 服务          | 地址                  | 账号                          |
| ------------- | --------------------- | ----------------------------- |
| Consul 控制台 | http://localhost:8500 | 无需登录                      |
| MinIO 控制台  | http://localhost:9001 | `admin` / `12345678`(DEFAULT) |

在 Consul 控制台的 **Services** 页面可看到所有注册的微服务。

### 3) 测试网关

```bash
# 网关健康检查
curl http://localhost:8000/health

# 用户登录（获取 JWT Token，种子账号见 user/data.sql）
# 响应遵循统一格式: {"code":200,"data":{...}}，失败时仅 {"code":<状态码>}
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "admin", "password": "123456"}'
```

## Swagger API 文档

您可以在仓库的 Deployments 中找到部署在 GitHub Pages 的 Swagger API 文档。

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
