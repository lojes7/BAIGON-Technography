// 百工谱 — 审计日志 API；三个服务独立查询、独立分页。
import type {
  ApiResponse,
  AuditLogItem,
  AuditLogSource,
  PaginatedData,
  PagedSearchAuditLogsParams,
} from "../types/api";
import { parseJson, stringifyNumericIdBody } from "./lossless";

const BASE = "/api/auth/audit-logs";

async function request<T>(url: string, init: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, init);
  if (response.status === 401) {
    localStorage.removeItem("baigon_token");
    localStorage.removeItem("baigon_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }
  return parseJson(await response.text()) as ApiResponse<T>;
}

export function pagedSearchAuditLogs(
  source: AuditLogSource,
  params: PagedSearchAuditLogsParams,
) {
  // 未选择具体用户时必须发送数字 0；空字符串无法绑定到 Gateway 的 int64 字段。
  const targetUserId = params.targetUserId?.trim() || 0;
  const payload = {
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 20,
    level: params.level ?? "",
    createdAtFrom: params.createdAtFrom ?? "",
    createdAtTo: params.createdAtTo ?? "",
    targetUserId,
    userType: params.userType ?? "",
  };
  return request<PaginatedData<AuditLogItem>>(`${BASE}/${source}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
    },
    // 具体用户 ID 是雪花 ID；替换为 JSON 数字时不能经过 Number。
    body: stringifyNumericIdBody(payload, ["targetUserId"]),
  });
}
