import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import T from "../../constants/tokens";
import Btn from "../ui/Btn";

function SkillFormModal({
  initial, onClose, onSave,
}: {
  initial?: { name: string; en: string; type: string; description: string };
  onClose: () => void;
  onSave: (d: { name: string; en: string; type: string; description: string }) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial ?? { name: "", en: "", type: "技术技能", description: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
      <div className="bg-white rounded-lg w-[480px]"
        style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>
            {isEdit ? t("page.skillDict.editSkill") : t("page.skillDict.createSkill")}
          </h3>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>
              标准名称 <span style={{ color: T.risk }}>*</span>
            </label>
            <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
              style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
              placeholder="例：Agent编排" value={form.name}
              onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>英文名称</label>
            <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none font-mono"
              style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
              placeholder="e.g. Agent Orchestration" value={form.en}
              onChange={e => set("en", e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-2" style={{ color: T.ink }}>能力分类</label>
            <div className="grid grid-cols-2 gap-2">
              {["技术技能", "工具与平台", "知识领域", "软技能"].map(t => (
                <label key={t}
                  className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors"
                  style={{ background: form.type === t ? `${T.teal}15` : T.cloud,
                    border: `1px solid ${form.type === t ? T.teal : T.border}` }}
                  onClick={() => set("type", t)}>
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: form.type === t ? T.teal : T.border,
                      background: form.type === t ? T.teal : "transparent" }}>
                    {form.type === t && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-[13px]" style={{ color: T.ink }}>{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>能力描述</label>
            <textarea
              className="w-full px-3 py-2 rounded-md text-[13px] outline-none resize-none"
              style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink, height: 72 }}
              placeholder={t("page.skillDict.descPlaceholder")}
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <Btn variant="secondary" onClick={onClose}>取消</Btn>
          <Btn onClick={() => { onSave(form); onClose(); toast.success(isEdit ? "能力已更新" : "能力已创建"); }}
            disabled={!form.name.trim()}>
            {isEdit ? t("common.save") : t("common.create")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default SkillFormModal;
