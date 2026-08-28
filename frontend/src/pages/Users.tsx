import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import T from "../constants/tokens";
import { listUsers, blockUser, unlockUser, getUniversities, getSchools, getDepartments } from "../services/user";
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

  const fetchUsers = () => {
    setLoading(true);
    listUsers({
      page: page - 1, // 新版 page 从 0 开始
      pageSize: 20,
      role: filterRole || undefined,
      schoolId: filterSchool ? Number(filterSchool) : undefined,
      departmentId: filterDept ? Number(filterDept) : undefined,
    })
      .then((res) => { setUsers(res.data.items ?? []); setTotal(res.data.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchMeta = () => {
    Promise.all([
      getUniversities({ page: 0, pageSize: 100 }),
      getSchools({ page: 0, pageSize: 100 }),
      getDepartments({ page: 0, pageSize: 100 }),
    ])
      .then(([u, s, d]) => {
        setUniversities(u.data.items ?? []);
        setSchools(s.data.items ?? []);
        setDepartments(d.data.items ?? []);
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
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {(filterRole || filterSchool || filterDept) && (
            <button className="text-[12px]" style={{ color: T.teal }}
              onClick={() => { setFilterRole(""); setFilterSchool(""); setFilterDept(""); }}>清除筛选</button>
          )}
        </div>

        {loading ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        : users.length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无用户</div>
        : <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}>{["UID","姓名","角色","学院","系部","状态","操作"].map(h => (<th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>))}</tr></thead>
        <tbody>{users.map(u => (<tr key={u.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{u.uid}</td><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{u.name || "—"}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{roleLabel(u.role)}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{u.school_name || "—"}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{u.department_name || "—"}</td><td className="px-4 py-3"><span className="text-[12px]" style={{ color: u.status === "NORMAL" ? T.emerging : T.risk }}>{u.status === "NORMAL" ? "正常" : "已封禁"}</span></td><td className="px-4 py-3"><button className="text-[12px] font-medium" style={{ color: T.pending }} onClick={() => handleToggleStatus(u)}>{u.status === "LOCKED" ? "解封" : "封禁"}</button></td></tr>))}</tbody></table>}

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
