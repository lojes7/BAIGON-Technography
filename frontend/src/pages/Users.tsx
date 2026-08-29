import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import T from "../constants/tokens";
import {
  batchGetOrganizations,
  listUsers,
  blockUser,
  unlockUser,
  getUniversities,
  getSchools,
  getDepartments,
} from "../services/user";
import type { CurrentUser, OrganizationItem } from "../types/api";
import { PageHeader, Btn, Card, Pagination } from "../components/ui";

const ROLE_OPTIONS = [
  { value: "", label: "全部角色" },
  { value: "STUDENT", label: "学生" },
  { value: "TEACHER", label: "教师" },
  { value: "STUDENT_AFFAIR", label: "学工" },
  { value: "DATA_ANALYST", label: "数据分析师" },
  { value: "DATA_REVIEWER", label: "数据复核员" },
  { value: "ADMIN", label: "系统管理员" },
];

function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // 筛选
  const [filterRole, setFilterRole] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // 组织目录（高校 / 学院 / 系部）
  const [universities, setUniversities] = useState<OrganizationItem[]>([]);
  const [schools, setSchools] = useState<OrganizationItem[]>([]);
  const [departments, setDepartments] = useState<OrganizationItem[]>([]);
  const usersRequestRef = useRef(0);

  const fetchUsers = () => {
    const requestId = ++usersRequestRef.current;
    setLoading(true);
    listUsers({
      page: page - 1, // 新版 page 从 0 开始
      pageSize: 20,
      role: filterRole || undefined,
      schoolId: filterSchool || undefined,
      departmentId: filterDept || undefined,
    })
      .then(async (res) => {
        const nextUsers = res.data.items ?? [];
        const schoolIds = referencedOrganizationIds(nextUsers.map((user) => user.schoolId));
        const departmentIds = referencedOrganizationIds(nextUsers.map((user) => user.departmentId));
        // 筛选器可只预载前 100 条；当前页引用名称必须按 ID 批量补齐。
        const [referencedSchools, referencedDepartments] = await Promise.all([
          schoolIds.length > 0
            ? batchGetOrganizations("schools", schoolIds)
                .then((response) => response.data.items)
                .catch(() => [])
            : Promise.resolve([]),
          departmentIds.length > 0
            ? batchGetOrganizations("departments", departmentIds)
                .then((response) => response.data.items)
                .catch(() => [])
            : Promise.resolve([]),
        ]);
        if (usersRequestRef.current !== requestId) return;
        setUsers(nextUsers);
        setTotal(res.data.total ?? 0);
        setSchools((current) => mergeOrganizationItems(current, referencedSchools));
        setDepartments((current) => mergeOrganizationItems(current, referencedDepartments));
      })
      .catch(() => {})
      .finally(() => {
        if (usersRequestRef.current === requestId) setLoading(false);
      });
  };

  const fetchMeta = () => {
    Promise.all([
      getUniversities({ page: 0, pageSize: 100 }),
      getSchools({ page: 0, pageSize: 100 }),
      getDepartments({ page: 0, pageSize: 100 }),
    ])
      .then(([u, s, d]) => {
        setUniversities((current) => mergeOrganizationItems(current, u.data.items ?? []));
        setSchools((current) => mergeOrganizationItems(current, s.data.items ?? []));
        setDepartments((current) => mergeOrganizationItems(current, d.data.items ?? []));
      })
      .catch(() => {});
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchUsers(); }, [page, filterRole, filterSchool, filterDept]);

  // 封禁 / 解封（新端点，幂等）
  const handleToggleStatus = async (user: CurrentUser) => {
    const isLocked = user.status === "LOCKED";
    try {
      if (isLocked) {
        await unlockUser(user.id);
        toast.success(`已解封 ${user.name || user.uid}`);
      } else {
        await blockUser(user.id);
        toast.success(`已封禁 ${user.name || user.uid}`);
      }
      fetchUsers();
    } catch (err) { toast.error((err as Error).message); }
  };

  // 创建类功能：后端尚未提供对应端点，标记为待后端提供
  const pendingCreate = (label: string) => {
    toast(`${label}：待后端提供对应端点`, { description: "新网关暂未开放该创建接口" });
  };

  const roleLabel = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;
  // 系部详情只携带直接父级 ID；据此在前端完成学院 -> 系部级联。
  const visibleDepartments = filterSchool
    ? departments.filter((item) => String(item.parentId) === String(filterSchool))
    : departments;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.admin"), t("nav.users")]} title={t("page.users.title")} />

      {/* ═══ 全部用户（新端点列表 + 筛选 + 封禁/解封） ═══ */}
      <Card
        title="全部用户"
        action={
          <div className="flex items-center gap-2">
            <Btn icon={Plus} size="sm" onClick={() => pendingCreate("添加学工")}>{t("page.users.addUser")}</Btn>
            <Btn icon={Plus} size="sm" variant="secondary" onClick={() => pendingCreate("新增数据人员")}>新增数据人员</Btn>
          </div>
        }
      >
        {/* 筛选器 */}
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <select className="px-3 py-1.5 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
            value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="px-3 py-1.5 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
            value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setFilterDept(""); }}>
            <option value="">全部学院</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="px-3 py-1.5 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
            value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">全部系部</option>
            {visibleDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {(filterRole || filterSchool || filterDept) && (
            <button className="text-[12px]" style={{ color: T.teal }}
              onClick={() => { setFilterRole(""); setFilterSchool(""); setFilterDept(""); }}>清除筛选</button>
          )}
        </div>

        {loading ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        : users.length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无用户</div>
        : <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}>{["UID","姓名","角色","学院","系部","状态","操作"].map(h => (<th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>))}</tr></thead>
        <tbody>{users.map(u => (<tr key={u.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{u.uid}</td><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{u.name || "—"}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{roleLabel(u.role)}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{organizationName(schools, u.schoolId)}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{organizationName(departments, u.departmentId)}</td><td className="px-4 py-3"><span className="text-[12px]" style={{ color: u.status === "NORMAL" ? T.emerging : T.risk }}>{u.status === "NORMAL" ? "正常" : "已封禁"}</span></td><td className="px-4 py-3"><button className="text-[12px] font-medium" style={{ color: T.pending }} onClick={() => handleToggleStatus(u)}>{u.status === "LOCKED" ? "解封" : "封禁"}</button></td></tr>))}</tbody></table>}

        {total > 20 && (
          <div className="px-4 py-3">
            <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} total={total} />
          </div>
        )}
      </Card>

      {/* ═══ 组织目录（新端点：高校 / 学院 / 系部 纯查询） ═══ */}
      <Card title="组织目录" action={<Btn icon={Plus} size="sm" variant="secondary" onClick={() => pendingCreate("新增组织")}>新增组织</Btn>}>
        <div className="grid grid-cols-3 gap-4 px-4 py-4">
          <OrgList title="高校" items={universities} />
          <OrgList title="二级学院" items={schools} />
          <OrgList title="系部" items={departments} />
        </div>
      </Card>
    </div>
  );
}

function organizationName(items: OrganizationItem[], id: string | number): string {
  if (!id || String(id) === "0") return "—";
  return items.find((item) => String(item.id) === String(id))?.name ?? `#${id}`;
}

function referencedOrganizationIds(ids: Array<string | number>): string[] {
  return Array.from(new Set(ids.map(String).filter((id) => id !== "" && id !== "0")));
}

function mergeOrganizationItems(
  current: OrganizationItem[],
  incoming: OrganizationItem[],
): OrganizationItem[] {
  const byId = new Map(current.map((item) => [String(item.id), item]));
  incoming.forEach((item) => byId.set(String(item.id), item));
  return Array.from(byId.values());
}

function OrgList({ title, items }: { title: string; items: OrganizationItem[] }) {
  return (
    <div>
      <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>{title}（{items.length}）</div>
      {items.length === 0 ? (
        <div className="text-[12px] py-4 text-center" style={{ color: T.info }}>暂无数据</div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y" style={{ border: `1px solid ${T.cloud}`, borderRadius: 8, borderColor: T.cloud }}>
          {items.map(i => (
            <div key={i.id} className="px-3 py-2 text-[13px]" style={{ color: T.ink }}>{i.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UsersPage;
