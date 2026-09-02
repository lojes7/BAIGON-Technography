// 新版登录接口：POST /api/login
// 响应格式：{ code: 200, data: { token, userId } }

import { parseJson } from "./lossless";

const BASE = "/api";

export interface LoginResult {
  token: string;
  userId: string; // 雪花 ID int64，lossless 解析为字符串避免精度丢失
}

export async function login(uid: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, password }),
  });
  if (!res.ok) {
    // 保留原始状态码信息，以便 AuthContext 判断是否为网络/代理错误
    const msg =
      res.status === 403
        ? "您的账号已被封禁，请联系管理员"
        : res.status === 401
          ? "账号或密码错误"
          : `登录失败 (${res.status})`;
    throw new Error(msg);
  }
  // 用 lossless 解析，避免 userId（雪花 ID）丢精度
  const text = await res.text();
  const body = parseJson(text) as { data: LoginResult };
  return body.data;
}

// 注册功能后端尚未实现，保留入口但明确提示。
export async function register(_name: string, _email: string, _password: string): Promise<void> {
  throw new Error("注册功能暂未开放，请联系管理员创建账号");
}
