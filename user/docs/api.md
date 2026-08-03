# 百工谱 — user_service

## 职责

用户认证与用户管理服务。 **user 服务不暴露 HTTP 业务接口**，所有业务通过 gRPC 协议对外提供，由 gateway 负责 REST → gRPC 转换。

## gRPC 接口

### Login — 用户登录

校验账号密码（bcrypt），验证通过后签发 JWT Token。

| 项目 | 内容 |
|------|------|
| **Service** | `baigon.user.UserService` |
| **Method** | `Login` |
| **Full Method** | `/baigon.user.UserService/Login` |
| **Proto** | `proto/user/user.proto` |

**请求 — LoginRequest**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uid` | string | 是 | 登录账号 |
| `password` | string | 是 | 密码（明文，内网 gRPC 传输） |

**响应 — LoginResponse**

| 字段 | 类型 | 说明 |
|------|------|------|
| `token` | string | JWT Token，后续请求放入 `Authorization: Bearer <token>` 请求头 |
| `user_id` | int64 | 用户 ID（雪花 ID） |
| `uid` | string | 登录账号 |
| `name` | string | 显示名称 |
| `role` | string | 角色，见下方角色体系 |

**gRPC 错误码**

| gRPC Status Code | 含义 | Gateway 映射 HTTP 状态码 |
|-----------------|------|--------------------------|
| `UNAUTHENTICATED` | 账号或密码错误（统一提示，不区分二者） | 401 |
| `PERMISSION_DENIED` | 账号已被锁定 | 403 |
| `INTERNAL` | 服务内部错误 | 500 |

> **安全策略**：无论账号不存在还是密码错误，均返回 `UNAUTHENTICATED`（同一提示），防止账号枚举攻击。

## JWT 说明

- 算法：HS256
- 密钥：环境变量 `JWT_SECRET`（与 gateway 共用同一密钥）
- 有效期：环境变量 `JWT_EXPIRATION_HOURS`（默认 1 小时）
- Claims：
  - `sub` — 登录账号 uid
  - `userId` — 用户雪花 ID
  - `role` — 角色
  - `iat` — 签发时间
  - `exp` — 过期时间

## 角色体系

| 角色 | 枚举值 | 说明 |
|------|--------|------|
| 学生 | STUDENT | 学习者 |
| 教师 | TEACHER | 教学者 |
| 学工 | STUDENT_AFFAIR | 学生事务管理 |
| 数据分析师 | DATA_ANALYST | 岗位数据分析 |
| 数据审核员 | DATA_REVIEWER | 数据质量审核 |
| 数据工程师 | DATA_ENGINEER | 数据采集与治理 |
| 管理员 | ADMIN | 系统管理员 |

## 种子账号

`data.sql` 预置了 4 个测试账号（密码相同），用于开发调试：

| 账号 uid | 角色 |
|----------|------|
| `admin` | ADMIN |
| `engineer` | DATA_ENGINEER |
| `reviewer` | DATA_REVIEWER |
| `analyst` | DATA_ANALYST |

## 调用链路

```
Client (浏览器/App)
  │
  ├─ POST /auth/login (REST, gateway:8000)
  │   ├─ middleware.RequestID()       → 注入 trace_id
  │   ├─ middleware.Logger()          → 请求日志
  │   ├─ middleware.CORS()            → 跨域
  │   ├─ middleware.Auth()            → /auth/* 白名单放行
  │   └─ handler.LoginHandler()
  │       ├─ 解析 JSON body → {uid, password}
  │       ├─ GrpcClientPool.GetConn("user-service") → Consul 服务发现
  │       └─ gRPC UserService.Login()  → user-service:50055
  │           ├─ UserRepository.findByUid()    → PostgreSQL
  │           ├─ BCryptPasswordEncoder.matches() → bcrypt 校验
  │           └─ JwtUtil.generateToken()       → HS256 JWT 签发
  │               ↑ 返回 LoginResponse { token, userId, uid, name, role }
  │
  └─ HTTP 200 JSON { token, user: { id, uid, name, role } }
```

## 错误码汇总

| 错误码 | 含义 |
|--------|------|
| UNAUTHENTICATED | 账号或密码错误 |
| PERMISSION_DENIED | 账号已被锁定 |
| INTERNAL | 服务内部错误 |
