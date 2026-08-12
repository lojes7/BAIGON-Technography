import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { X, ChevronDown } from "lucide-react";
import T from "../../constants/tokens";
import { createMajor, createOccupationFamily, createOccupation, createAbility } from "../../services/dict";
import Btn from "../ui/Btn";

interface ParentOption { id: string; name: string }
interface CreateTaxNodeModalProps { onClose: () => void; onCreated?: () => void;
  majorParents: ParentOption[]; familyParents: ParentOption[]; occupationParents: ParentOption[]; }

function CreateTaxNodeModal({ onClose, onCreated, majorParents, familyParents, occupationParents }: CreateTaxNodeModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "岗位", parentId: "" });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const parents =
    form.type === "岗位族" ? majorParents :
    form.type === "岗位" ? familyParents :
    form.type === "能力" ? occupationParents : [];
  const parentLabel = (id: string) => parents.find(p => p.id === id)?.name ?? "";

  const handleCreate = async () => {
    if (!form.name.trim() || (!form.parentId && form.type !== "产业")) return;
    setSaving(true);
    try {
      if (form.type === "产业") { await createMajor({ major_name: form.name }); }
      else if (form.type === "岗位族") { await createOccupationFamily({ occupation_family_name: form.name, major_id: form.parentId }); }
      else if (form.type === "岗位") { await createOccupation({ occupation_name: form.name, occupation_family_id: form.parentId }); }
      else if (form.type === "能力") { await createAbility({ name: form.name }); }
      toast.success(t("msg.nodeCreated", { type: form.type, parent: parentLabel(form.parentId) }));
      onClose(); onCreated?.();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  return (<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
    <div className="bg-white rounded-lg w-[500px]" style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
        <div><h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{t("page.taxonomy.createNode")}</h3></div>
        <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button></div>
      <div className="px-5 py-4 space-y-4">
        <div><label className="text-[12px] font-medium block mb-2" style={{ color: T.ink }}>节点类型 <span style={{ color: T.risk }}>*</span></label>
          <div className="grid grid-cols-4 gap-2">{(["产业","岗位族","岗位","能力"] as const).map(t => {
            const col = { 产业: T.ink, 岗位族: T.teal, 岗位: T.stable, 能力: T.emerging }[t]; const active = form.type === t;
            return <label key={t} className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-md cursor-pointer" style={{ background: active ? `${col}15` : T.cloud, border: `1px solid ${active ? col : T.border}` }} onClick={() => { set("type", t); set("parentId", ""); }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: active ? col : `${col}50` }} /><span className="text-[12px] font-medium" style={{ color: active ? col : T.info }}>{t}</span></label>; })}</div></div>
        {form.type !== "产业" && (<div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>父节点 <span style={{ color: T.risk }}>*</span></label>
          <div className="relative"><select className="w-full px-3 py-2 rounded-md text-[13px] outline-none appearance-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={form.parentId || ""} onChange={e => set("parentId", e.target.value)}><option value="">选择父节点…</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={13} style={{ color: T.info, position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} /></div></div>)}
        <div><label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>节点名称 <span style={{ color: T.risk }}>*</span></label><input className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} value={form.name} onChange={e => set("name", e.target.value)} /></div>
        {form.name && (form.type === "产业" || form.parentId !== "") && <div className="px-3 py-2.5 rounded-md text-[12px]" style={{ background: `${T.teal}0A`, border: `1px solid ${T.teal}30` }}><span style={{ color: T.info }}>将新建：</span><span className="font-medium ml-1" style={{ color: T.ink }}>{form.type !== "产业" ? parentLabel(form.parentId) + " → " : ""}{form.name}</span></div>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}><Btn variant="secondary" onClick={onClose}>{t("common.cancel")}</Btn>
        <Btn onClick={handleCreate} disabled={saving || !form.name.trim() || (form.type !== "产业" && !form.parentId)}>{saving ? t("common.loading") : t("page.taxonomy.createNode")}</Btn></div>
    </div></div>);
}
export default CreateTaxNodeModal;
