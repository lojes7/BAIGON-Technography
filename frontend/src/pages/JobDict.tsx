import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, X } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getOccupationList, createOccupation, updateOccupation, deleteOccupation, reviewOccupation, getOccupationFamilyList, createOccupationFamily, getMajorList, createMajor } from "../services/dict";
import type { OccupationItem, CreateOccupationBody, OccupationFamilyItem, MajorItem } from "../types/api";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

function JobDictPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "reviewer";
  const [jobs, setJobs] = useState<OccupationItem[]>([]);
  const [families, setFamilies] = useState<OccupationFamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; job?: OccupationItem } | null>(null);
  const [form, setForm] = useState<CreateOccupationBody>({ occupation_name: "", occupation_family_id: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [majorList, setMajorList] = useState<MajorItem[]>([]);
  // 弹窗内快速新建（岗位族 + 产业）
  const [quickPanel, setQuickPanel] = useState<{ open: boolean; majorId: string; famName: string; creating: boolean; showMajorInput: boolean; majorName: string }>({ open: false, majorId: "", famName: "", creating: false, showMajorInput: false, majorName: "" });

  const fetchAll = () => {
    setLoading(true);
    Promise.allSettled([getOccupationList(1, 100), getOccupationFamilyList(1, 100), getMajorList(1, 100)])
      .then(([jS, fS, mS]) => {
        if (jS.status === "fulfilled") setJobs(jS.value.data.items);
        if (fS.status === "fulfilled") setFamilies(fS.value.data.items);
        if (mS.status === "fulfilled") setMajorList(mS.value.data.items);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setForm({ occupation_name: "", occupation_family_id: String(families[0]?.id ?? "") }); setModal({ mode: "create" }); };
  const openEdit = (job: OccupationItem) => { setForm({ occupation_name: job.name, occupation_family_id: job.occupation_family ? String(job.occupation_family.id) : "" }); setModal({ mode: "edit", job }); };

  const handleQuickCreateFamily = async () => {
    if (!quickPanel.famName.trim() || !quickPanel.majorId) return;
    setQuickPanel(p => ({ ...p, creating: true }));
    try {
      await createOccupationFamily({ occupation_family_name: quickPanel.famName, major_id: quickPanel.majorId });
      toast.success("岗位族已创建");
      const res = await getOccupationFamilyList(1, 100);
      if (res.code === 0) {
        setFamilies(res.data.items);
        const created = res.data.items.find(f => f.name === quickPanel.famName);
        if (created) setForm(p => ({ ...p, occupation_family_id: String(created.id) }));
      }
      setQuickPanel({ open: false, majorId: "", famName: "", creating: false, showMajorInput: false, majorName: "" });
    } catch (err) { toast.error((err as Error).message); }
    finally { setQuickPanel(p => ({ ...p, creating: false })); }
  };

  const handleQuickCreateMajor = async () => {
    if (!quickPanel.majorName.trim()) return;
    setQuickPanel(p => ({ ...p, creating: true }));
    try {
      const res = await createMajor({ major_name: quickPanel.majorName });
      toast.success("产业已创建");
      const mRes = await getMajorList(1, 100);
      if (mRes.code === 0) {
        setMajorList(mRes.data.items);
        const created = mRes.data.items.find(m => m.name === quickPanel.majorName);
        setQuickPanel(p => ({ ...p, majorId: created ? String(created.id) : p.majorId, showMajorInput: false, majorName: "" }));
      }
    } catch (err) { toast.error((err as Error).message); }
    finally { setQuickPanel(p => ({ ...p, creating: false })); }
  };

  const handleSave = async () => {
    if (!form.occupation_name.trim() || !form.occupation_family_id) return;
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        await createOccupation(form);
        toast.success(t("msg.skillCreated"));
      } else if (modal?.job) {
        await updateOccupation(modal.job.id, form);
        toast.success(t("msg.skillUpdated"));
      }
      setModal(null);
      fetchAll();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteOccupation(deleteId);
      toast.success(t("msg.rejected"));
      setDeleteId(null);
      fetchAll();
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleReview = async (job_id: string, status: string) => {
    try {
      await reviewOccupation(job_id, { review_status: status });
      toast.success(t(status === "REVIEW_PASSED" ? "msg.auditPassed" : "msg.auditRejected"));
      fetchAll();
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.jobDict")]}
        title={t("page.jobDict.title")}
        description={t("page.jobDict.desc")}
        actions={canEdit ? <Btn icon={Plus} onClick={openCreate}>{t("page.jobDict.create")}</Btn> : undefined}
      />
      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["colName","colFamily","colSkills","colStatus","colActions"].map(k => (
                  <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(`page.jobDict.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{j.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.occupation_family?.name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-center">{j.abilities_count}</td>
                  <td className="px-4 py-3"><StatusBadge status={j.review_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <>
                          <button className="text-[12px] font-medium" style={{ color: T.teal }} onClick={() => openEdit(j)} title={t("common.edit")}><Pencil size={13} /></button>
                          <button className="text-[12px] font-medium" style={{ color: T.risk }} onClick={() => setDeleteId(j.id)} title={t("common.delete")}><Trash2 size={13} /></button>
                          {j.review_status !== "REVIEW_PASSED" && (
                            <button className="text-[12px] font-medium" style={{ color: T.emerging }} onClick={() => handleReview(j.id, "REVIEW_PASSED")} title={t("msg.auditPassed")}><CheckCircle size={13} /></button>
                          )}
                          {j.review_status === "REVIEW_PASSED" && (
                            <button className="text-[12px] font-medium" style={{ color: T.risk }} onClick={() => handleReview(j.id, "REVIEW_REJECT")} title={t("msg.auditRejected")}><X size={13} /></button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 新建/编辑弹窗 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg w-[420px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{modal.mode === "create" ? t("page.jobDict.create") : t("common.edit")}</h3>
              <button onClick={() => setModal(null)} style={{ color: T.info }}><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("page.jobDict.colName")} <span style={{ color: T.risk }}>*</span></label>
                <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={form.occupation_name} onChange={e => setForm(p => ({ ...p, occupation_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("page.jobDict.colFamily")} <span style={{ color: T.risk }}>*</span></label>
                <div className="text-[11px] mb-1.5" style={{ color: T.info }}>产业 → 岗位族 → 标准岗位</div>
                {families.length === 0 && !quickPanel.open ? (
                  <div>
                    <div className="text-[12px] mb-2" style={{ color: T.risk }}>暂无岗位族，请先创建</div>
                    <Btn variant="secondary" size="sm" onClick={() => setQuickPanel({ open: true, majorId: "", famName: "", creating: false, showMajorInput: majorList.length === 0, majorName: "" })}>+ 新建岗位族</Btn>
                  </div>
                ) : (
                  <select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={form.occupation_family_id || ""} onChange={e => { const v = e.target.value; if (v === "__new__") { setQuickPanel({ open: true, majorId: "", famName: "", creating: false, showMajorInput: majorList.length === 0, majorName: "" }); } else setForm(p => ({ ...p, occupation_family_id: v })); }}>
                    <option value="">选择岗位族…</option>
                    <option value="__new__" style={{ color: T.teal }}>+ 新建岗位族</option>
                    {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
              </div>

              {/* 快速新建岗位族面板 */}
              {quickPanel.open && (
                <div className="rounded-md p-3 space-y-3" style={{ background: `${T.teal}06`, border: `1px dashed ${T.teal}40` }}>
                  <div className="text-[12px] font-medium" style={{ color: T.ink }}>新建岗位族</div>
                  {/* 产业选择 */}
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: T.info }}>所属产业 <span style={{ color: T.risk }}>*</span></label>
                    {quickPanel.showMajorInput ? (
                      <div className="space-y-2">
                        <div className="text-[11px]" style={{ color: T.risk }}>暂无产业，请先创建</div>
                        <div className="flex gap-2">
                          <input className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                            value={quickPanel.majorName} onChange={e => setQuickPanel(p => ({ ...p, majorName: e.target.value }))} placeholder="产业名称" />
                          <Btn size="sm" onClick={handleQuickCreateMajor} disabled={quickPanel.creating || !quickPanel.majorName.trim()}>{quickPanel.creating ? "..." : "创建"}</Btn>
                        </div>
                      </div>
                    ) : (
                      <select className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                        value={quickPanel.majorId} onChange={e => { const v = e.target.value; if (v === "__new_major__") { setQuickPanel(p => ({ ...p, showMajorInput: true })); } else setQuickPanel(p => ({ ...p, majorId: v })); }}>
                        <option value="">选择产业…</option>
                        <option value="__new_major__" style={{ color: T.teal }}>+ 新建产业</option>
                        {majorList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                  </div>
                  {/* 岗位族名称 */}
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: T.info }}>岗位族名称 <span style={{ color: T.risk }}>*</span></label>
                    <div className="flex gap-2">
                      <input className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
                        value={quickPanel.famName} onChange={e => setQuickPanel(p => ({ ...p, famName: e.target.value }))} placeholder="岗位族名称" />
                      <Btn size="sm" onClick={handleQuickCreateFamily} disabled={quickPanel.creating || !quickPanel.famName.trim() || !quickPanel.majorId}>{quickPanel.creating ? "..." : "创建"}</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setQuickPanel({ open: false, majorId: "", famName: "", creating: false, showMajorInput: false, majorName: "" })}>取消</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>{t("common.cancel")}</Btn>
              <Btn onClick={handleSave} disabled={saving || !form.occupation_name.trim() || !form.occupation_family_id}>{saving ? t("common.loading") : t("common.save")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteId !== null && (
        <ConfirmDialog
          title={t("common.confirmDelete")}
          body={`${t("common.confirmDelete")}？`}
          confirmLabel={t("common.delete")}
          danger
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

export default JobDictPage;
