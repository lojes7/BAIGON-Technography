import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type RoleKey } from "./roles";
import { login as apiLogin, type LoginResult } from "../services/auth";

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
    // 从 localStorage 恢复用户会话（新版无 GET /api/auth/me）
    try {
      const stored = localStorage.getItem("baigon_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("baigon_token"));

  const login = useCallback(async (uid: string, password: string) => {
    const data: LoginResult = await apiLogin(uid, password);
    const u: User = {
      id: String(data.user.id),
      name: data.user.name,
      role: normalizeRole(data.user.role),
    };
    localStorage.setItem("baigon_token", data.token);
    localStorage.setItem("baigon_user", JSON.stringify(u));
    setToken(data.token);
    setUser(u);
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
