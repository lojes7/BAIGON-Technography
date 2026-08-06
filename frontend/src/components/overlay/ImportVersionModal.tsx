import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { X, Upload, CheckCircle, ChevronRight } from "lucide-react";
import T from "../../constants/tokens";
import Btn from "../ui/Btn";

function ImportVersionModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [form, setForm] = useState({ version: "2027版", effective: "2027-09", note: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
      <div className="bg-white rounded-lg w-[520px]"
        style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div>
            <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>导入新版培养方案</h3>
            <div className="flex items-center gap-3 mt-1">
              {[t("page.importWizard.uploadFile"), t("page.importWizard.versionInfo"), t("page.importWizard.confirmImport")].map((s, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[12px]">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px]"
                    style={{ background: i <= step ? T.teal : T.cloud, color: i <= step ? "white" : T.info }}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span style={{ color: i === step ? T.ink : T.info }}>{s}</span>
                  {i < 2 && <ChevronRight size={11} style={{ color: T.cloud }} />}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>

        <div className="px-5 py-5">
          {step === 0 && (
            <div>
              <div
                className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer transition-colors"
                style={{ borderColor: dropped ? T.teal : T.border, background: dropped ? `${T.teal}05` : T.cloud }}
                onDragOver={e => { e.preventDefault(); setDropped(true); }}
                onDragLeave={() => setDropped(false)}
                onDrop={e => { e.preventDefault(); setDropped(true); }}
                onClick={() => setDropped(true)}>
                {dropped ? (
                  <div className="text-center">
                    <CheckCircle size={28} style={{ color: T.teal, margin: "0 auto 8px" }} />
                    <div className="text-[14px] font-medium" style={{ color: T.teal }}>培养方案_人工智能技术_2027.docx</div>
                    <div className="text-[12px] mt-1" style={{ color: T.info }}>2.4 MB · 文件已就绪</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={28} style={{ color: T.info, margin: "0 auto 10px" }} />
                    <div className="text-[14px] font-medium" style={{ color: T.ink }}>拖放培养方案文件至此</div>
                    <div className="text-[12px] mt-1" style={{ color: T.info }}>或点击选择 · 支持 PDF、Word、Excel</div>
                  </div>
                )}
              </div>
              {dropped && (
                <div className="mt-3 px-3 py-2 rounded text-[12px]"
                  style={{ background: `${T.emerging}0A`, color: T.emerging, border: `1px solid ${T.emerging}30` }}>
                  <CheckCircle size={12} className="inline mr-1" />
                  文件哈希已计算 · 未检测到与已有版本重复
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>
                    版本名称 <span style={{ color: T.risk }}>*</span>
                  </label>
                  <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
                    style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                    value={form.version} onChange={e => set("version", e.target.value)} />
                </div>
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>
                    生效时间 <span style={{ color: T.risk }}>*</span>
                  </label>
                  <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none font-mono"
                    style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                    placeholder="YYYY-MM" value={form.effective} onChange={e => set("effective", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>版本说明</label>
                <textarea className="w-full px-3 py-2 rounded-md text-[13px] outline-none resize-none"
                  style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink, height: 72 }}
                  placeholder="简要描述本次版本更新的主要变化"
                  value={form.note} onChange={e => set("note", e.target.value)} />
              </div>
              <div className="px-3 py-2.5 rounded text-[12px] leading-relaxed"
                style={{ background: T.cloud, color: T.info }}>
                当前版本（2026版）将保留，新版本导入后需经AI解析后方可查看能力映射情况，预计 2—5 分钟。
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-lg p-4" style={{ background: `${T.emerging}08`, border: `1px solid ${T.emerging}30` }}>
                <div className="text-[13px] font-medium mb-3 flex items-center gap-2" style={{ color: T.emerging }}>
                  <CheckCircle size={14} />确认导入信息
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-[13px]">
                  {[
                    ["专业", "人工智能技术"],
                    ["版本名称", form.version],
                    ["生效时间", form.effective],
                    ["源文件", "培养方案_人工智能技术_2027.docx"],
                    ["文件大小", "2.4 MB"],
                    ["将触发", "AI能力映射解析（2—5分钟）"],
                  ].map(([k, v], i) => (
                    <div key={i} className="flex gap-2">
                      <span style={{ color: T.info }}>{k}</span>
                      <span className="font-medium" style={{ color: T.ink }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <Btn variant="secondary" onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}>
            {step === 0 ? t("common.cancel") : t("common.back")}
          </Btn>
          <Btn
            disabled={step === 0 && !dropped}
            onClick={() => {
              if (step < 2) setStep(s => s + 1);
              else {
                toast.success(`${form.version}已开始导入`, { description: "AI能力解析进行中，完成后将通知您" });
                onClose();
              }
            }}>
            {step === 2 ? t("page.importWizard.confirmImportBtn") : t("page.importWizard.nextStep")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default ImportVersionModal;
