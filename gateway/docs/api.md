# 百工谱 — gateway_service

## 统一响应格式

所有 API 响应必须遵循以下结构：

```json
// 成功
{ "code": 200, "data": { ... } }

// 失败（不携带消息）
{ "code": 401 }
```

- `code` 始终与 HTTP 状态码一致
- 成功时 `code` 恒为 200，业务数据放在 `data` 中
- 失败时仅有 `code` 字段，无 `error` 消息

## 职责

Go + Gin 网关，负责：

- **请求路由**：将 REST 请求转换为 gRPC 调用，转发到后端微服务
- **JWT 鉴权**：按路由组挂载，验证请求中的 Bearer Token（无全局白名单机制）
- **限流**：基于 IP 的令牌桶限流（按需启用）
- **服务发现**：通过 Consul 动态发现后端 gRPC 服务地址
- **链路追踪**：每个请求注入雪花 ID 作为 `trace_id`

## API 端点

### POST /api/login — 用户登录

网关接收 REST JSON 请求，通过 gRPC 调用 user-service 的 `Login` RPC，返回 JWT Token 和用户信息。

> **本接口不需要认证**。登录等公开端点直接挂在 api group 下（未挂载 Auth 中间件）。

| 项目 | 内容 |
|------|------|
| **Method** | POST |
| **Path** | `/api/login` |
| **Content-Type** | `application/json` |
| **Auth** | 不需要（公开端点） |

**请求体**

```json
{
  "uid": "admin",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 示例 | 说明 |
|------|------|------|------|------|
| `uid` | string | 是 | `"admin"` | 登录账号 |
| `password` | string | 是 | `"123456"` | 密码 |

**成功响应 (200)**

所有成功响应遵循统一格式 `{"code": 200, "data": {...}}`：

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJJZCI6MSwicm9sZSI6IkFETUlOIn0...",
    "user": {
      "id": 1234567890,
      "uid": "admin",
      "name": "管理员",
      "role": "ADMIN"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 状态码，恒为 200 |
| `data.token` | string | JWT，后续 API 请求放入 `Authorization: Bearer <token>` 请求头 |
| `data.user.id` | number | 用户 ID（雪花 ID） |
| `data.user.uid` | string | 登录账号 |
| `data.user.name` | string | 显示名称 |
| `data.user.role` | string | 角色（ADMIN / STUDENT / TEACHER / …） |

**错误响应**

所有错误响应遵循统一格式 `{"code": <HTTP状态码>}`，**不携带消息**：

```json
{
  "code": 401
}
```

| HTTP 状态码 | `code` | 含义 |
|------------|--------|------|
| 400 | 400 | 请求体格式错误 |
| 401 | 401 | 账号或密码错误 |
| 403 | 403 | 账号已被锁定 |
| 503 | 503 | 用户服务不可用（user-service 连接失败或超时） |
| 500 | 500 | 内部服务错误 |

**cURL 示例**

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "admin", "password": "123456"}'
```

---

### GET /api/ping — 网关心跳

心跳探测端点，返回网关运行状态和 trace_id。**不需要认证**。

| 项目 | 内容 |
|------|------|
| **Method** | GET |
| **Path** | `/api/ping` |
| **Auth** | 不需要（公开端点） |

**成功响应 (200)**

```json
{
  "code": 200,
  "data": {
    "message": "baigon gateway is running",
    "trace_id": "1234567890123456789"
  }
}
```

---

### GET /health — 健康检查

Consul 健康探测端点，**不需要认证**。

| 项目 | 内容 |
|------|------|
| **Method** | GET |
| **Path** | `/health` |

**响应 (200)**

```json
{
  "code": 200,
  "data": {
    "service": "gateway-service",
    "status": "healthy",
    "time": "2025-01-01T12:00:00+08:00"
  }
}
```

---

## 认证说明

鉴权中间件按**路由组**挂载，无全局白名单机制：

- **公开端点**（免鉴权）：`POST /api/login`、`GET /api/ping`、`GET /health`、`GET /swagger/*`
- **受保护端点**（需 Bearer Token）：挂在 `/api/auth` 路由组下的端点（当前为占位，后续用户相关接口将挂载于此）

受保护端点需在请求头中携带 JWT：

```
Authorization: Bearer <token>
```

> **注意**：Auth 中间件已移除路径白名单逻辑，新增端点时必须显式声明——公开端点挂 api group，受保护端点挂 auth group，避免遗忘鉴权。

Token 由 user-service 使用 HS256 算法签发，gateway 使用同一 `JWT_SECRET` 环境变量验签。

Claims 包含：`sub`(uid)、`userId`、`role`、`iat`、`exp`。

## 中间件链

请求按以下顺序经过中间件：

```
RequestID (trace_id 雪花 ID)
  → Logger (请求日志)
    → CORS (跨域)
      → [Auth] (JWT 鉴权，仅挂载于受保护路由组)
        → [RateLimit] (限流，当前注释未启用)
          → Handler (业务处理)
```

## 错误码总览

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 — Token 缺失、无效或过期；或账号密码错误 |
| 403 | 无权限 — 账号被锁定 |
| 429 | 请求过于频繁（限流器启用时） |
| 500 | 服务内部错误 |
| 503 | 后端服务不可用 |

## 调用方约束

- 请求头 `Content-Type` 必须为 `application/json`
- 受保护接口需携带 `Authorization: Bearer <token>`
- 跨服务追踪可通过注入 `X-Trace-ID` 请求头实现（gateway 会透传或生成新的雪花 ID）
