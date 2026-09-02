import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Eye,
} from "lucide-react";
import { Btn, Card, PageHeader, Pagination } from "../components/ui";
import T from "../constants/tokens";
import P from "../constants/palette";
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
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-CN", { hour12: false });
}

function roleLabel(role: string): string {
  return (ROLE_OPTIONS.find(([value]) => value === role)?.[1] ?? role) || "-";
}

function levelColor(level: string): string {
  if (level === "ERROR") return T.risk;
  if (level === "WARNING") return T.pending;
  return T.stable;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] w-16 shrink-0" style={{ color: P.muted }}>{label}</span>
      <span className="flex-1 min-w-0 break-all" style={{ color: P.ink }}>{value}</span>
    </div>
  );
}

export default function AuditLogPage() {
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
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

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
        targetUserId: source === "occupation" ? appliedFilters.targetUserId : "",
        userType: source === "occupation" ? appliedFilters.userType : "",
      });
      setResult(response.data);
    } catch (requestError) {
      setResult(EMPTY_PAGE);
      setError(requestError instanceof Error ? requestError.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, source]);

  const loadUsers = useCallback(async (keyword: string, role: string) => {
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
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 分页、来源和筛选状态变化后重新读取服务端数据。
    if (queryVersion >= 0) void loadLogs();
  }, [loadLogs, queryVersion]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- ADMIN 首次进入时加载可发现的用户筛选项。
    void loadUsers("", "");
  }, [loadUsers]);

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
    void loadUsers("", "");
  };

  const switchSource = (nextSource: AuditLogSource) => {
    setSource(nextSource);
    setPage(0);
    setError("");
  };

  const totalPages = Math.max(1, Math.ceil(result.total / Math.max(1, result.pageSize)));
  const showUserFilters = source === "occupation";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={["系统管理", "审计日志"]}
        title="审计日志"
        description="按服务分别查看用户业务、数据采集和 AI 操作日志"
        actions={<Btn variant="secondary" size="sm" icon={RefreshCw} onClick={() => setQueryVersion((value) => value + 1)}>刷新</Btn>}
      />

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
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: P.sky }}>
                <th className="text-left font-medium px-4 py-2.5" style={{ color: P.primaryDeep }}>时间</th>
                <th className="text-left font-medium px-4 py-2.5" style={{ color: P.primaryDeep }}>操作人</th>
                <th className="text-left font-medium px-4 py-2.5" style={{ color: P.primaryDeep }}>级别</th>
                <th className="text-left font-medium px-4 py-2.5" style={{ color: P.primaryDeep }}>请求</th>
                <th className="text-left font-medium px-4 py-2.5 w-[88px]" style={{ color: P.primaryDeep }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {!loading && result.items.map((item) => {
                const color = levelColor(item.level);
                const isActive = selected?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors"
                    style={{ borderTop: `1px solid ${T.cloud}`, background: isActive ? `${T.teal}0a` : undefined }}
                    onClick={() => setSelected(item)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: T.info }}>{formatTime(item.createdAt)}</td>
                    <td className="px-4 py-2 truncate" title={item.userName ? `${item.userName} · ${roleLabel(item.userType)} · ${item.userId}` : undefined}>
                      <span className="font-medium" style={{ color: T.ink }}>{item.userName || "system"}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px]" style={{ color, background: `${color}16` }}>{item.level}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: T.cloud, color: T.ink }}>
                          {item.requestMethod || "-"}
                        </span>
                        <span className="font-mono truncate" title={item.requestUrl} style={{ color: T.info }}>{item.requestUrl || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md transition-colors"
                        style={{ color: P.primary, background: `${P.primary}0a` }}
                        onClick={() => setSelected(item)}
                      >
                        <Eye size={13} />
                        详情
                      </button>
                    </td>
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
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <Pagination
            page={page + 1}
            totalPages={totalPages}
            disabled={loading}
            total={result.total}
            onChange={(value) => setPage(value - 1)}
          />
        </div>
      </Card>

      {/* ==================== 详情抽屉 ==================== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }}
          onClick={() => setSelected(null)}>
          <div className="ml-auto w-[600px] shrink-0 max-w-[calc(100vw-24px)] h-full bg-white shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* 头部 */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded font-mono text-[11px]"
                  style={{ color: levelColor(selected.level), background: `${levelColor(selected.level)}16` }}>
                  {selected.level}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: P.ink }}>审计日志详情</div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: P.muted }}>{selected.id}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: P.faint }}><X size={18} /></button>
            </div>

            {/* 滚动内容 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* 请求信息 */}
              <section>
                <div className="text-[12px] font-semibold mb-3" style={{ color: P.muted }}>请求信息</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  <DetailRow label="请求方法" value={
                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: T.cloud, color: T.ink }}>
                      {selected.requestMethod || "-"}
                    </span>
                  } />
                  <DetailRow label="来源服务" value={selected.sourceService || "-"} />
                  <div className="col-span-2">
                    <div className="text-[11px]" style={{ color: P.muted, marginBottom: 2 }}>请求路径</div>
                    <div className="font-mono text-[12px] break-all rounded px-2 py-1.5"
                      style={{ background: "#F5F8FB", color: P.ink, border: `1px solid ${P.border}` }}>
                      {selected.requestUrl || "-"}
                    </div>
                  </div>
                </div>
              </section>

              {/* 操作详情 */}
              <section>
                <div className="text-[12px] font-semibold mb-3" style={{ color: P.muted }}>操作详情</div>
                <div className="rounded px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                  style={{ background: "#F5F8FB", color: P.ink, border: `1px solid ${P.border}` }}>
                  {selected.detail || "-"}
                </div>
                {selected.errorMsg && (
                  <div className="mt-2 rounded px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{ background: "#FBEAE7", color: T.risk, border: `1px solid ${T.risk}40` }}>
                    {selected.errorMsg}
                  </div>
                )}
              </section>

              {/* 操作者信息 */}
              <section>
                <div className="text-[12px] font-semibold mb-3" style={{ color: P.muted }}>操作者信息</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  <DetailRow label="操作人" value={selected.userName || "system"} />
                  <DetailRow label="用户类型" value={roleLabel(selected.userType)} />
                  <DetailRow label="用户 ID" value={<span className="font-mono">{selected.userId || "-"}</span>} />
                  <DetailRow label="IP 地址" value={<span className="font-mono">{selected.userIp || "-"}</span>} />
                </div>
              </section>

              {/* 追溯信息 */}
              <section>
                <div className="text-[12px] font-semibold mb-3" style={{ color: P.muted }}>追溯信息</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  <DetailRow label="发生时间" value={formatTime(selected.createdAt)} />
                  <div className="col-span-2">
                    <div className="text-[11px]" style={{ color: P.muted, marginBottom: 2 }}>Trace ID</div>
                    <div className="font-mono text-[12px] break-all rounded px-2 py-1.5"
                      style={{ background: "#F5F8FB", color: P.ink, border: `1px solid ${P.border}` }}>
                      {selected.traceId || "-"}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
