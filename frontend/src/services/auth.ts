// 新版登录接口：POST /api/login
// 响应格式：{ code: 200, data: { token, user: { id, uid, name, role } } }

const BASE = "/api";

export interface LoginResult {
  token: string;
  user: {
    id: number;
    uid: string;
    name: string;
    role: string;
  };
}

export async function login(uid: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, password }),
  });
  const body = await res.json().catch(() => ({}));
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
  // 新版格式：{ code: 200, data: { token, user } }
  return body.data as LoginResult;
}
