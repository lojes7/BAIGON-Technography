import { useAuth } from "./AuthContext";
import { canAccessPage, canOperate } from "./roles";

/** 检查当前用户能否访问指定页面 */
export function usePageAccess(pageId: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return canAccessPage(user.role, pageId);
}

/** 检查当前用户能否执行指定操作 */
export function useCanOperate(operation: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return canOperate(user.role, operation);
}
