import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Btn, Card, PageHeader } from "../components/ui";
import T from "../constants/tokens";
import { pagedSearchAuditLogs } from "../services/audit";
import { listUsers } from "../services/user";
import type {
  AuditLogItem,
  AuditLogLevel,
  AuditLogSource,
  CurrentUser,
  PaginatedData,
} from "../types/api";

const PAGE_SIZE = 20;
const EMPTY_PAGE: PaginatedData<AuditLogItem> = {
  items: [],
  total: 0,
  page: 0,
  pageSize: PAGE_SIZE,
};

const SOURCE_OPTIONS: { value: AuditLogSource; label: string; description: string }[] = [
  { value: "occupation", label: "用户与业务服务", description: "occupation-service" },
  { value: "crawler", label: "数据采集服务", description: "crawler-service" },
  { value: "ai", label: "AI 服务", description: "ai-service" },
];

const ROLE_OPTIONS = [
  ["STUDENT", "学生"],
  ["TEACHER", "教师"],
  ["STUDENT_AFFAIR", "学生事务人员"],
  ["DATA_ANALYST", "数据分析师"],
  ["DATA_REVIEWER", "数据复核员"],
  ["CIVILIAN", "社会用户"],
  ["ADMIN", "管理员"],
] as const;

interface Filters {
  level: AuditLogLevel;
  createdAtFrom: string;
  createdAtTo: string;
  userType: string;
  targetUserId: string;
}

const EMPTY_FILTERS: Filters = {
  level: "",
  createdAtFrom: "",
  createdAtTo: "",
  userType: "",
  targetUserId: "",
};

function toRFC3339(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

function formatTime(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN", { hour12: false });
}

function roleLabel(role: string): string {
  return (ROLE_OPTIONS.find(([value]) => value === role)?.[1] ?? role) || "—";
}

function levelColor(level: string): string {
  if (level === "ERROR") return T.risk;
  if (level === "WARNING") return T.pending;
  return T.stable;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [source, setSource] = useState<AuditLogSource>("occupation");
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [queryVersion, setQueryVersion] = useState(0);
  const [result, setResult] = useState<PaginatedData<AuditLogItem>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState("");

  const loadLogs = useCallback(async () => {
    // 让 Effect 只负责调度异步同步点，避免同步级联渲染。
    await Promise.resolve();
    setLoading(true);
    setError("");
    try {
      const response = await pagedSearchAuditLogs(source, {
        page,
        pageSize: PAGE_SIZE,
        level: appliedFilters.level,
        createdAtFrom: toRFC3339(appliedFilters.createdAtFrom),
        createdAtTo: toRFC3339(appliedFilters.createdAtTo),
        targetUserId: source === "occupation" && isAdmin ? appliedFilters.targetUserId : "",
        userType: source === "occupation" && isAdmin ? appliedFilters.userType : "",
      });
      setResult(response.data);
    } catch (requestError) {
      setResult(EMPTY_PAGE);
      setError(requestError instanceof Error ? requestError.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, isAdmin, page, source]);

  const loadUsers = useCallback(async (keyword: string, role: string) => {
    if (!isAdmin) return;
    await Promise.resolve();
    setUsersLoading(true);
    setUserSearchError("");
    try {
      const response = await listUsers({ page: 0, pageSize: 100, name: keyword, role });
      setUsers(response.data.items);
    } catch (requestError) {
      setUsers([]);
      setUserSearchError(requestError instanceof Error ? requestError.message : "用户列表加载失败");
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 分页、来源和筛选状态变化后重新读取服务端数据。
    if (queryVersion >= 0) void loadLogs();
  }, [loadLogs, queryVersion]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- ADMIN 首次进入时加载可发现的用户筛选项。
    if (isAdmin) void loadUsers("", "");
  }, [isAdmin, loadUsers]);

  const applyFilters = () => {
    if (draftFilters.createdAtFrom && draftFilters.createdAtTo
      && new Date(draftFilters.createdAtFrom) > new Date(draftFilters.createdAtTo)) {
      setError("开始时间不能晚于结束时间");
      return;
    }
    setAppliedFilters({ ...draftFilters });
    setPage(0);
    setQueryVersion((value) => value + 1);
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setUserKeyword("");
    setPage(0);
    setQueryVersion((value) => value + 1);
    if (isAdmin) void loadUsers("", "");
  };

  const switchSource = (nextSource: AuditLogSource) => {
    setSource(nextSource);
    setPage(0);
    setError("");
  };

  const totalPages = Math.max(1, Math.ceil(result.total / Math.max(1, result.pageSize)));
  const showUserFilters = isAdmin && source === "occupation";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[isAdmin ? "系统管理" : "个人中心", "审计日志"]}
        title="审计日志"
        description={isAdmin
          ? "按服务分别查看用户业务、数据采集和 AI 操作日志"
          : "仅显示你本人在用户与业务服务中的操作日志"}
        actions={<Btn variant="secondary" size="sm" icon={RefreshCw} onClick={() => setQueryVersion((value) => value + 1)}>刷新</Btn>}
      />

      {isAdmin ? (
        <div className="grid grid-cols-3 gap-3">
          {SOURCE_OPTIONS.map((option) => {
            const active = source === option.value;
            return (
              <button
                type="button"
                key={option.value}
                className="text-left rounded-lg px-4 py-3 transition-colors"
                style={{
                  border: `1px solid ${active ? T.teal : T.border}`,
                  background: active ? `${T.teal}0c` : T.white,
                }}
                onClick={() => switchSource(option.value)}
              >
                <div className="text-[13px] font-medium" style={{ color: active ? T.teal : T.ink }}>{option.label}</div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: T.info }}>{option.description}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px]" style={{ background: `${T.teal}0c`, color: T.ink }}>
          <ShieldCheck size={15} style={{ color: T.teal }} />
          后端已强制限定为当前账号，无法通过修改筛选参数查询其他用户。
        </div>
      )}

      <Card>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] space-y-1">
              <span className="block" style={{ color: T.info }}>日志级别</span>
              <select
                className="h-9 rounded-md px-3 text-[13px] bg-white outline-none min-w-32"
                style={{ border: `1px solid ${T.border}`, color: T.ink }}
                value={draftFilters.level}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, level: event.target.value as AuditLogLevel }))}
              >
                <option value="">全部级别</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
            </label>

            <label className="text-[12px] space-y-1">
              <span className="block" style={{ color: T.info }}>开始时间</span>
              <input
                type="datetime-local"
                className="h-9 rounded-md px-3 text-[13px] bg-white outline-none"
                style={{ border: `1px solid ${T.border}`, color: T.ink }}
                value={draftFilters.createdAtFrom}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, createdAtFrom: event.target.value }))}
              />
            </label>

            <label className="text-[12px] space-y-1">
              <span className="block" style={{ color: T.info }}>结束时间</span>
              <input
                type="datetime-local"
                className="h-9 rounded-md px-3 text-[13px] bg-white outline-none"
                style={{ border: `1px solid ${T.border}`, color: T.ink }}
                value={draftFilters.createdAtTo}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, createdAtTo: event.target.value }))}
              />
            </label>

            {showUserFilters && (
              <label className="text-[12px] space-y-1">
                <span className="block" style={{ color: T.info }}>用户类型</span>
                <select
                  className="h-9 rounded-md px-3 text-[13px] bg-white outline-none min-w-36"
                  style={{ border: `1px solid ${T.border}`, color: T.ink }}
                  value={draftFilters.userType}
                  onChange={(event) => {
                    const userType = event.target.value;
                    setDraftFilters((filters) => ({ ...filters, userType, targetUserId: "" }));
                    void loadUsers(userKeyword, userType);
                  }}
                >
                  <option value="">全部用户类型</option>
                  {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            )}

            <div className="flex gap-2 ml-auto">
              <Btn variant="ghost" onClick={resetFilters}>重置</Btn>
              <Btn icon={Search} onClick={applyFilters}>查询</Btn>
            </div>
          </div>

          {showUserFilters && (
            <div className="flex flex-wrap items-end gap-3 pt-3" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <label className="text-[12px] space-y-1">
                <span className="block" style={{ color: T.info }}>查找具体用户</span>
                <div className="flex gap-2">
                  <input
                    className="h-9 w-52 rounded-md px-3 text-[13px] bg-white outline-none"
                    style={{ border: `1px solid ${T.border}`, color: T.ink }}
                    placeholder="输入姓名后查找"
                    value={userKeyword}
                    onChange={(event) => setUserKeyword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void loadUsers(userKeyword, draftFilters.userType);
                    }}
                  />
                  <Btn variant="secondary" onClick={() => void loadUsers(userKeyword, draftFilters.userType)} disabled={usersLoading}>
                    {usersLoading ? "查找中…" : "查找"}
                  </Btn>
                </div>
              </label>
              <label className="text-[12px] space-y-1 flex-1 min-w-64">
                <span className="block" style={{ color: T.info }}>具体用户</span>
                <select
                  className="h-9 w-full rounded-md px-3 text-[13px] bg-white outline-none"
                  style={{ border: `1px solid ${T.border}`, color: T.ink }}
                  value={draftFilters.targetUserId}
                  onChange={(event) => setDraftFilters((filters) => ({ ...filters, targetUserId: event.target.value }))}
                >
                  <option value="">全部用户</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}（{item.uid} · {roleLabel(item.role)}）</option>
                  ))}
                </select>
              </label>
              {userSearchError && <span className="text-[12px]" style={{ color: T.risk }}>{userSearchError}</span>}
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px]" style={{ background: `${T.risk}10`, color: T.risk }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-[12px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["时间", "操作人", "级别", "请求", "操作详情", "IP", "Trace ID"].map((header) => (
                  <th key={header} className="px-4 py-2.5 text-left font-medium" style={{ color: T.info }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && result.items.map((item) => {
                const color = levelColor(item.level);
                return (
                  <tr key={item.id} className="align-top" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: T.info }}>{formatTime(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: T.ink }}>{item.userName || "system"}</div>
                      <div className="font-mono text-[10px] mt-0.5" style={{ color: T.info }}>
                        {item.userType ? `${roleLabel(item.userType)} · ` : ""}{item.userId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px]" style={{ color, background: `${color}16` }}>{item.level}</span>
                    </td>
                    <td className="px-4 py-3 max-w-64">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: T.cloud, color: T.ink }}>
                          {item.requestMethod || "—"}
                        </span>
                        <span className="font-mono truncate" title={item.requestUrl} style={{ color: T.info }}>{item.requestUrl || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-80">
                      <div style={{ color: T.ink }}>{item.detail || "—"}</div>
                      {item.errorMsg && <div className="mt-1 break-words" style={{ color: T.risk }}>{item.errorMsg}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: T.info }}>{item.userIp || "—"}</td>
                    <td className="px-4 py-3 font-mono max-w-44 break-all" style={{ color: T.info }}>{item.traceId || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="py-16 text-center text-[13px]" style={{ color: T.info }}>正在加载审计日志…</div>}
          {!loading && result.items.length === 0 && !error && (
            <div className="py-16 text-center text-[13px]" style={{ color: T.info }}>当前筛选条件下暂无日志</div>
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-between text-[12px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
          <span>共 {result.total} 条 · 第 {result.page + 1} / {totalPages} 页</span>
          <div className="flex items-center gap-2">
            <Btn
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={loading || page <= 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >上一页</Btn>
            <Btn
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              disabled={loading || page + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >下一页</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
