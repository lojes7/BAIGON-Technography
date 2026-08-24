// JWT Token 本地工具：仅解析 payload 判断是否过期，不做签名校验（签名校验由网关完成）
// 用途：前端在恢复会话前先本地判断 token 是否过期，避免携带过期 token 访问导致 401

/** 将 base64url 字符串解码为 UTF-8 文本 */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * 判断 token 是否已过期（缺失 / 格式非法 / 解析失败均视为过期）
 * 过期即返回 true，由调用方引导用户重新登录
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: unknown };
    if (typeof payload.exp !== "number") return true;
    // exp 为秒级时间戳
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
