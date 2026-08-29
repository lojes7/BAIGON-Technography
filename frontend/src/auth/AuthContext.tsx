import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type RoleKey } from "./roles";
import { login as apiLogin, type LoginResult } from "../services/auth";
import { getMe } from "../services/user";
import { isTokenExpired } from "./token";

// 新版角色映射（不再有 DATA_ENGINEER）
const ROLE_MAP: Record<string, RoleKey> = {
  ADMIN: "admin", DATA_REVIEWER: "reviewer",
  DATA_ANALYST: "analyst", TEACHER: "teacher", STUDENT: "student", STUDENT_AFFAIR: "student_affair",
};
function normalizeRole(r: string): RoleKey { return ROLE_MAP[r] ?? (r.toLowerCase() as RoleKey); }

interface User {
  id: string;
  name: string;
  role: RoleKey;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (uid: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // 从 localStorage 恢复已由 /me 校验过的用户会话。
    try {
      const stored = localStorage.getItem("baigon_user");
      if (!stored) return null;
      // token 已过期或缺失时同步清理会话，避免带过期 token 进入受保护页面
      if (isTokenExpired(localStorage.getItem("baigon_token"))) {
        localStorage.removeItem("baigon_token");
        localStorage.removeItem("baigon_user");
        return null;
      }
      return JSON.parse(stored);
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem("baigon_token");
    return isTokenExpired(stored) ? null : stored;
  });

  const login = useCallback(async (uid: string, password: string) => {
    const data: LoginResult = await apiLogin(uid, password);
    // 登录响应只签发身份引用；先保存 token，再通过 /me 读取展示资料。
    localStorage.setItem("baigon_token", data.token);
    try {
      const profile = await getMe();
      const u: User = {
        id: String(profile.data.id || data.userId),
        name: profile.data.name,
        role: normalizeRole(profile.data.role),
      };
      localStorage.setItem("baigon_user", JSON.stringify(u));
      setToken(data.token);
      setUser(u);
    } catch (error) {
      localStorage.removeItem("baigon_token");
      localStorage.removeItem("baigon_user");
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
  }, []);

  // 由于从 localStorage 同步初始化，没有异步恢复过程，直接渲染
  return (
    <AuthCtx.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
