// 百工谱 — 审计日志 API；三个服务独立查询、独立分页。
import type {
  ApiResponse,
  AuditLogItem,
  AuditLogSource,
  PaginatedData,
  PaginatedIds,
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

export async function pagedSearchAuditLogs(
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
  const page = await request<PaginatedIds>(`${BASE}/${source}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
    },
    // 具体用户 ID 是雪花 ID；替换为 JSON 数字时不能经过 Number。
    body: stringifyNumericIdBody(payload, ["targetUserId"]),
  });
  const details = page.data.ids.length > 0
    ? await batchGetAuditLogs(source, page.data.ids)
    : { code: 200, data: { items: [] } } as ApiResponse<{ items: AuditLogItem[] }>;
  return {
    ...page,
    data: {
      items: details.data.items,
      total: page.data.total,
      page: page.data.page,
      pageSize: page.data.pageSize,
    },
  } as ApiResponse<PaginatedData<AuditLogItem>>;
}

export function batchGetAuditLogs(source: AuditLogSource, ids: Array<string | number>) {
  return request<{ items: AuditLogItem[]; missingIds: string[] }>(`${BASE}/${source}/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
    },
    body: stringifyNumericIdBody({ ids }, [], ["ids"]),
  });
}

export function getAuditLogDetail(source: AuditLogSource, id: string | number) {
  return request<AuditLogItem>(`${BASE}/${source}/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("baigon_token")}` },
  });
}
