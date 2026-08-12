import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import T from "../constants/tokens";
import {
  createStudentAffair,
  getSchoolList, createSchool,
  getDepartmentList, createDepartment,
  createDataStaff, toggleUserStatus,
} from "../services/admin";
import { getUserList } from "../services/admin";
import type { SchoolItem, DepartmentItem, UserItem } from "../types/api";
import { PageHeader, Btn, Card } from "../components/ui";

const ROLE_OPTIONS = [
  { value: "", label: "全部角色" },
  { value: "STUDENT", label: "学生" },
  { value: "TEACHER", label: "教师" },
  { value: "STUDENT_AFFAIR", label: "学工" },
  { value: "DATA_ANALYST", label: "数据分析师" },
  { value: "DATA_REVIEWER", label: "数据复核员" },
  { value: "DATA_ENGINEER", label: "数据工程师" },
];

function UsersPage() {
  const { t } = useTranslation();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 筛选
  const [filterRole, setFilterRole] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // 弹窗
  const [saModal, setSaModal] = useState(false);
  const [schoolModal, setSchoolModal] = useState(false);
  const [deptModal, setDeptModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);

  const [saForm, setSaForm] = useState({ uid: "", name: "", password: "", department_id: "" });
  const [saSaving, setSaSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [deptForm, setDeptForm] = useState({ name: "", school_id: "" });
  const [staffForm, setStaffForm] = useState({ uid: "", name: "", password: "", role: "DATA_ENGINEER" });

  // 弹窗内快速新建学院
  const [inlineSchool, setInlineSchool] = useState({ name: "", target: "" as "" | "dept" });
  const [quickCreating, setQuickCreating] = useState(false);

  const handleQuickCreateSchool = async () => {
    if (!inlineSchool.name.trim()) return;
    setQuickCreating(true);
    try {
      await createSchool({ name: inlineSchool.name });
      toast.success("学院已创建");
      const sch = await getSchoolList();
      setSchools(sch.data);
      const created = sch.data.find(s => s.name === inlineSchool.name);
      if (created) setDeptForm(p => ({ ...p, school_id: String(created.id) }));
      setInlineSchool({ name: "", target: "" });
    } catch (err) { toast.error((err as Error).message); }
    finally { setQuickCreating(false); }
  };

  // SA 弹窗内快速新建系部
  const [inlineDept, setInlineDept] = useState({ open: false, name: "", schoolId: "", showSchoolInput: false, schoolName: "", creating: false });

  const handleQuickCreateDept = async () => {
    if (!inlineDept.name.trim() || !inlineDept.schoolId) return;
    setInlineDept(p => ({ ...p, creating: true }));
    try {
      await createDepartment({ name: inlineDept.name, school_id: inlineDept.schoolId });
      toast.success("系部已创建");
      const deptRes = await getDepartmentList();
      setDepartments(deptRes.data);
      const created = deptRes.data.find(d => d.name === inlineDept.name);
      if (created) setSaForm(p => ({ ...p, department_id: String(created.id) }));
      setInlineDept({ open: false, name: "", schoolId: "", showSchoolInput: false, schoolName: "", creating: false });
    } catch (err) { toast.error((err as Error).message); }
    finally { setInlineDept(p => ({ ...p, creating: false })); }
  };

  const handleQuickCreateSchoolFromSA = async () => {
    if (!inlineDept.schoolName.trim()) return;
    setInlineDept(p => ({ ...p, creating: true }));
    try {
      const res = await createSchool({ name: inlineDept.schoolName });
      toast.success("学院已创建");
      const sch = await getSchoolList();
      setSchools(sch.data);
      const created = sch.data.find(s => s.name === inlineDept.schoolName);
      setInlineDept(p => ({ ...p, schoolId: created ? String(created.id) : p.schoolId, showSchoolInput: false, schoolName: "" }));
    } catch (err) { toast.error((err as Error).message); }
    finally { setInlineDept(p => ({ ...p, creating: false })); }
  };

  const fetchUsers = () => {
    setLoading(true);
    getUserList({
      role: filterRole || undefined,
      school_id: filterSchool || undefined,
      department_id: filterDept || undefined,
    }).then((res) => setAllUsers(res.data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchMeta = () => {
    Promise.all([getSchoolList(), getDepartmentList()])
      .then(([sch, dept]) => { setSchools(sch.data); setDepartments(dept.data); })
      .catch(() => {});
  };

  const refreshAll = () => { fetchUsers(); fetchMeta(); };

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { fetchUsers(); }, [filterRole, filterSchool, filterDept]);

  // ── 学工 CRUD ──
  const handleCreateSA = async () => {
    if (!saForm.uid.trim() || !saForm.name.trim()) return;
    setSaSaving(true);
    try {
      const body: any = { uid: saForm.uid, name: saForm.name };
      if (saForm.password) body.password = saForm.password;
      if (saForm.department_id) body.department_id = saForm.department_id;
      await createStudentAffair(body);
      toast.success(t("msg.userCreated"));
      setSaModal(false); setSaForm({ uid: "", name: "", password: "", department_id: "" });
      refreshAll();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaSaving(false); }
  };

  // ── 数据人员 CRUD ──
  const handleCreateStaff = async () => {
    if (!staffForm.uid.trim() || !staffForm.name.trim()) return;
    try {
      const body: any = { uid: staffForm.uid, name: staffForm.name, role: staffForm.role };
      if (staffForm.password) body.password = staffForm.password;
      await createDataStaff(body);
      toast.success("数据人员已创建");
      setStaffModal(false); setStaffForm({ uid: "", name: "", password: "", role: "DATA_ENGINEER" });
      refreshAll();
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus: "NORMAL" | "LOCKED" = currentStatus === "NORMAL" ? "LOCKED" : "NORMAL";
    try { await toggleUserStatus(userId, newStatus); toast.success(`已${newStatus === "NORMAL" ? "解封" : "封禁"}`); fetchUsers(); }
    catch (err) { toast.error((err as Error).message); }
  };

  const handleCreateSchool = async () => {
    if (!schoolName.trim()) return;
    try { await createSchool({ name: schoolName }); toast.success("学院已创建"); setSchoolModal(false); setSchoolName(""); refreshAll(); }
    catch (err) { toast.error((err as Error).message); }
  };

  const handleCreateDept = async () => {
    if (!deptForm.name.trim() || !deptForm.school_id) return;
    try { await createDepartment({ name: deptForm.name, school_id: deptForm.school_id }); toast.success("系部已创建"); setDeptModal(false); setDeptForm({ name: "", school_id: "" }); refreshAll(); }
    catch (err) { toast.error((err as Error).message); }
  };

  // 角色显示名
  const roleLabel = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.admin"), t("nav.users")]} title={t("page.users.title")} />

      {/* ═══ 全部用户（统合列表 + 筛选 + 操作） ═══ */}
      <Card
        title="全部用户"
        action={
          <div className="flex items-center gap-2">
            <Btn icon={Plus} size="sm" onClick={() => setSaModal(true)}>{t("page.users.addUser")}</Btn>
            <Btn icon={Plus} size="sm" variant="secondary" onClick={() => setStaffModal(true)}>新增数据人员</Btn>
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
            {departments.filter(d => !filterSchool || String(d.school_id) === filterSchool).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {(filterRole || filterSchool || filterDept) && (
            <button className="text-[12px]" style={{ color: T.teal }} onClick={() => { setFilterRole(""); setFilterSchool(""); setFilterDept(""); }}>清除筛选</button>
          )}
        </div>

        {loading ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        : allUsers.length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无用户</div>
        : <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}>{["UID","姓名","角色","学院","院系","状态","操作"].map(h => (<th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>))}</tr></thead>
        <tbody>{allUsers.map(u => (<tr key={u.user_id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{u.uid}</td><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{u.name}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{roleLabel(u.role)}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{u.school?.name ?? "—"}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{u.department?.name ?? "—"}</td><td className="px-4 py-3"><span className="text-[12px]" style={{ color: u.status === "NORMAL" ? T.emerging : T.risk }}>{u.status}</span></td><td className="px-4 py-3"><button className="text-[12px] font-medium" style={{ color: T.pending }} onClick={() => handleToggleStatus(u.user_id, u.status || "NORMAL")}>{u.status === "LOCKED" ? "解封" : "封禁"}</button></td></tr>))}</tbody></table>}
      </Card>

      {/* ═══ 二级学院管理 ═══ */}
      <Card title="二级学院" action={<Btn icon={Plus} size="sm" onClick={() => setSchoolModal(true)}>新增学院</Btn>}>
        {schools.length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无学院，请先新增</div>
        : <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}><th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>名称</th></tr></thead>
        <tbody>{schools.map(s => (<tr key={s.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{s.name}</td></tr>))}</tbody></table>}
      </Card>

      {/* ═══ 系部管理 ═══ */}
      <Card title="系部（院系）" action={<Btn icon={Plus} size="sm" onClick={() => setDeptModal(true)}>新增系部</Btn>}>
        {departments.length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无系部</div>
        : <table className="w-full text-[13px]"><thead><tr style={{ background: T.cloud }}><th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>名称</th><th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>所属学院</th></tr></thead>
        <tbody>{departments.map(d => (<tr key={d.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{d.name}</td><td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{schools.find(s => String(s.id) === String(d.school_id))?.name ?? d.school_id}</td></tr>))}</tbody></table>}
      </Card>

      {/* ═══ Modals ═══ */}
      {saModal && (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setSaModal(false)}><div className="bg-white rounded-lg w-[440px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}><h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{t("page.users.addUserTitle")}</h3><button onClick={() => setSaModal(false)} style={{ color: T.info }}><X size={18} /></button></div><div className="px-5 py-4 space-y-3">
        {schools.length === 0 ? (
          <div className="text-center py-6"><div className="text-[13px] mb-3" style={{ color: T.info }}>请先创建二级学院，再为学工分配院系</div><Btn size="sm" onClick={() => { setSaModal(false); setSchoolModal(true); }}>去创建二级学院 →</Btn></div>
        ) : departments.length === 0 ? (
          <div className="text-center py-6"><div className="text-[13px] mb-3" style={{ color: T.info }}>暂无系部，请先为学院创建系部</div><Btn size="sm" onClick={() => { setSaModal(false); setDeptModal(true); }}>去创建系部 →</Btn></div>
        ) : (
          <>
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>UID <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={saForm.uid} onChange={e => setSaForm(p => ({ ...p, uid: e.target.value }))} placeholder="登录账号" /></div>
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.name")} <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={saForm.name} onChange={e => setSaForm(p => ({ ...p, name: e.target.value }))} placeholder="请输姓名" /></div>
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.password")}</label><input type="password" className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={saForm.password} onChange={e => setSaForm(p => ({ ...p, password: e.target.value }))} placeholder="默认 123456" /></div>
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>院系</label><select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={saForm.department_id} onChange={e => { const v = e.target.value; if (v === "__new__") { setInlineDept({ open: true, name: "", schoolId: schools[0]?.id ?? "", showSchoolInput: schools.length === 0, schoolName: "", creating: false }); } else setSaForm(p => ({ ...p, department_id: v })); }}><option value="">请选择</option><option value="__new__" style={{ color: T.teal }}>+ 新建系部</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        {inlineDept.open && (
          <div className="rounded-md p-3 space-y-3" style={{ background: `${T.teal}06`, border: `1px dashed ${T.teal}40` }}>
            <div className="text-[12px] font-medium" style={{ color: T.ink }}>新建系部</div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: T.info }}>所属学院 <span style={{ color: T.risk }}>*</span></label>
              {inlineDept.showSchoolInput ? (
                <div className="flex gap-2">
                  <input className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                    value={inlineDept.schoolName} onChange={e => setInlineDept(p => ({ ...p, schoolName: e.target.value }))} placeholder="学院名称" />
                  <Btn size="sm" onClick={handleQuickCreateSchoolFromSA} disabled={inlineDept.creating || !inlineDept.schoolName.trim()}>{inlineDept.creating ? "..." : "创建"}</Btn>
                </div>
              ) : (
                <select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                  value={inlineDept.schoolId} onChange={e => { const v = e.target.value; if (v === "__new__") setInlineDept(p => ({ ...p, showSchoolInput: true })); else setInlineDept(p => ({ ...p, schoolId: v })); }}>
                  <option value="">选择学院…</option>
                  <option value="__new__" style={{ color: T.teal }}>+ 新建学院</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                value={inlineDept.name} onChange={e => setInlineDept(p => ({ ...p, name: e.target.value }))} placeholder="系部名称" autoFocus />
              <Btn size="sm" onClick={handleQuickCreateDept} disabled={inlineDept.creating || !inlineDept.name.trim() || !inlineDept.schoolId}>{inlineDept.creating ? "..." : "创建"}</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setInlineDept({ open: false, name: "", schoolId: "", showSchoolInput: false, schoolName: "", creating: false })}>取消</Btn>
            </div>
          </div>
        )}
          </>
        )}
        </div>
        {schools.length > 0 && departments.length > 0 && (
          <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}><Btn variant="secondary" onClick={() => setSaModal(false)}>{t("common.cancel")}</Btn><Btn onClick={handleCreateSA} disabled={saSaving || !saForm.uid.trim() || !saForm.name.trim()}>{saSaving ? t("common.loading") : t("page.users.createUser")}</Btn></div>
        )}
        </div></div>)}

      {schoolModal && (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setSchoolModal(false)}><div className="bg-white rounded-lg w-[400px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}><h3 className="text-[15px] font-medium" style={{ color: T.ink }}>新增二级学院</h3><button onClick={() => setSchoolModal(false)} style={{ color: T.info }}><X size={18} /></button></div><div className="px-5 py-4 space-y-3"><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>学院名称 <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="例：计算机信息工程学院" /></div></div><div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}><Btn variant="secondary" onClick={() => setSchoolModal(false)}>{t("common.cancel")}</Btn><Btn onClick={handleCreateSchool} disabled={!schoolName.trim()}>{t("common.save")}</Btn></div></div></div>)}

      {staffModal && (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setStaffModal(false)}><div className="bg-white rounded-lg w-[440px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}><h3 className="text-[15px] font-medium" style={{ color: T.ink }}>新增数据人员</h3><button onClick={() => setStaffModal(false)} style={{ color: T.info }}><X size={18} /></button></div><div className="px-5 py-4 space-y-3"><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>UID <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={staffForm.uid} onChange={e => setStaffForm(p => ({ ...p, uid: e.target.value }))} /></div><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.name")} <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={staffForm.name} onChange={e => setStaffForm(p => ({ ...p, name: e.target.value }))} /></div><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.password")}</label><input type="password" className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={staffForm.password} onChange={e => setStaffForm(p => ({ ...p, password: e.target.value }))} /></div><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>角色 <span style={{ color: T.risk }}>*</span></label><select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={staffForm.role} onChange={e => setStaffForm(p => ({ ...p, role: e.target.value }))}><option value="DATA_ENGINEER">数据工程师</option><option value="DATA_ANALYST">数据分析师</option><option value="DATA_REVIEWER">数据复核员</option></select></div></div><div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}><Btn variant="secondary" onClick={() => setStaffModal(false)}>{t("common.cancel")}</Btn><Btn onClick={handleCreateStaff} disabled={!staffForm.uid.trim() || !staffForm.name.trim()}>{t("common.save")}</Btn></div></div></div>)}

      {deptModal && (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setDeptModal(false)}><div className="bg-white rounded-lg w-[400px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}><h3 className="text-[15px] font-medium" style={{ color: T.ink }}>新增系部</h3><button onClick={() => setDeptModal(false)} style={{ color: T.info }}><X size={18} /></button></div><div className="px-5 py-4 space-y-3">
        {schools.length === 0 ? (
          <div className="text-center py-6"><div className="text-[13px] mb-3" style={{ color: T.info }}>请先创建二级学院，才能创建系部</div><Btn size="sm" onClick={() => { setDeptModal(false); setSchoolModal(true); }}>去创建二级学院 →</Btn></div>
        ) : (
          <>
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>系部名称 <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} /></div><div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>所属学院 <span style={{ color: T.risk }}>*</span></label><select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={deptForm.school_id} onChange={e => { const v = e.target.value; if (v === "__new__") { setInlineSchool({ name: "", target: "dept" }); } else setDeptForm(p => ({ ...p, school_id: v })); }}><option value="">选择学院…</option><option value="__new__" style={{ color: T.teal }}>+ 新建二级学院</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {inlineSchool.target === "dept" && (
          <div className="rounded-md p-3 space-y-2" style={{ background: `${T.teal}06`, border: `1px dashed ${T.teal}40` }}>
            <div className="text-[12px] font-medium" style={{ color: T.ink }}>快速新建学院</div>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                value={inlineSchool.name} onChange={e => setInlineSchool(p => ({ ...p, name: e.target.value }))} placeholder="学院名称" autoFocus />
              <Btn size="sm" onClick={handleQuickCreateSchool} disabled={quickCreating || !inlineSchool.name.trim()}>{quickCreating ? "..." : "创建"}</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setInlineSchool({ name: "", target: "" })}>取消</Btn>
            </div>
          </div>
        )}
          </>
        )}
        </div>
        {schools.length > 0 && (
          <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}><Btn variant="secondary" onClick={() => setDeptModal(false)}>{t("common.cancel")}</Btn><Btn onClick={handleCreateDept} disabled={!deptForm.name.trim() || !deptForm.school_id}>{t("common.save")}</Btn></div>
        )}
        </div></div>)}
    </div>
  );
}

export default UsersPage;
