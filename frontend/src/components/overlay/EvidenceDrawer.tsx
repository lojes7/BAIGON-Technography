import { useState } from "react";
import { toast } from "sonner";
import { X, Download } from "lucide-react";
import T from "../../constants/tokens";
import { StatusBadge } from "../ui";
import Btn from "../ui/Btn";
import SAMPLE_EVIDENCE from "../../data/evidence";
import type { EvidenceItem as EvidenceItemType } from "../../types";

function EvidenceDrawer({
  title, subtitle, items = SAMPLE_EVIDENCE, onClose,
}: {
  title: string; subtitle?: string; items?: EvidenceItemType[]; onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-[420px] h-full bg-white shadow-xl flex flex-col"
        style={{ borderLeft: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div>
            <div className="text-[15px] font-medium" style={{ color: T.ink }}>{title}</div>
            {subtitle && <div className="text-[12px] mt-0.5" style={{ color: T.info }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 px-5 py-2.5 text-[12px] flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}`, background: T.cloud }}>
          <span style={{ color: T.info }}>共 {items.length} 条来源证据</span>
          <span className="ml-auto font-mono" style={{ color: T.info }}>
            已确认 {items.filter(i => i.status === "confirmed").length} · 待复核 {items.filter(i => i.status !== "confirmed").length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: T.cloud }}>
          {items.map((item, i) => (
            <div key={i} className="px-5 py-4">
              <div
                className="text-[13px] p-3 rounded leading-relaxed mb-3 cursor-pointer"
                style={{ background: T.cloud, color: T.ink,
                  maxHeight: expanded === i ? "none" : 64,
                  overflow: expanded === i ? "visible" : "hidden" }}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                {item.text}
                {expanded !== i && (
                  <span className="ml-1 text-[11px]" style={{ color: T.teal }}>展开</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
                <div><span style={{ color: T.info }}>来源 </span>
                  <span style={{ color: T.ink }}>{item.source}</span></div>
                <div><span style={{ color: T.info }}>日期 </span>
                  <span className="font-mono" style={{ color: T.ink }}>{item.date}</span></div>
                {item.job && (
                  <div className="col-span-2"><span style={{ color: T.info }}>关联岗位 </span>
                    <span style={{ color: T.ink }}>{item.job}</span></div>
                )}
                <div className="col-span-2 flex items-center justify-between">
                  <StatusBadge status={item.status} />
                  <button className="text-[11px] font-medium" style={{ color: T.teal }}>跳转原文</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <Btn variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(items.map(i => i.text).join("\n")); toast.success("已复制"); }}>
            复制全部引用
          </Btn>
          <Btn variant="secondary" size="sm" icon={Download}>导出证据</Btn>
        </div>
      </div>
    </div>
  );
}

export default EvidenceDrawer;
