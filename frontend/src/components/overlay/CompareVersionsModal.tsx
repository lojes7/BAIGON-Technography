import { useState } from "react";
import { X, ArrowRight, Download } from "lucide-react";
import T from "../../constants/tokens";
import versionDiff from "../../data/version-diff";
import Btn from "../ui/Btn";

function CompareVersionsModal({ onClose }: { onClose: () => void }) {
  const [base, setBase] = useState("2025版");
  const [compare, setCompare] = useState("2026版");
  const [tab, setTab] = useState<"all" | "added" | "removed" | "changed">("all");

  const allItems = [
    ...versionDiff.added.map(i => ({ ...i, op: "add" as const })),
    ...versionDiff.removed.map(i => ({ ...i, op: "remove" as const })),
    ...versionDiff.changed.map(i => ({ ...i, op: "change" as const })),
  ];
  const filtered = tab === "all" ? allItems
    : tab === "added" ? allItems.filter(i => i.op === "add")
    : tab === "removed" ? allItems.filter(i => i.op === "remove")
    : allItems.filter(i => i.op === "change");

  const opColor = { add: T.emerging, remove: T.risk, change: T.pending };
  const opLabel = { add: "+ 新增", remove: "× 移除", change: "~ 变更" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
      <div className="bg-white rounded-lg w-[640px]"
        style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>版本比较</h3>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>

        {/* Version selectors */}
        <div className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: T.info }}>基准版本</span>
            <select className="px-2.5 py-1.5 rounded text-[13px] outline-none"
              style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
              value={base} onChange={e => setBase(e.target.value)}>
              {["2024版", "2025版", "2026版"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <ArrowRight size={14} style={{ color: T.info }} />
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: T.info }}>对比版本</span>
            <select className="px-2.5 py-1.5 rounded text-[13px] outline-none"
              style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
              value={compare} onChange={e => setCompare(e.target.value)}>
              {["2025版", "2026版"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-4 text-[12px]">
            <span style={{ color: T.emerging }}>+{versionDiff.added.length} 新增</span>
            <span style={{ color: T.risk }}>-{versionDiff.removed.length} 移除</span>
            <span style={{ color: T.pending }}>~{versionDiff.changed.length} 变更</span>
          </div>
        </div>

        {/* Tab filter */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-1">
          {([["all", "全部变更"], ["added", "新增"], ["removed", "移除"], ["changed", "变更"]] as const).map(([k, label]) => (
            <button key={k}
              className="px-3 py-1.5 rounded text-[12px] transition-colors"
              style={{ background: tab === k ? T.ink : "transparent", color: tab === k ? "#F5EFEA" : T.info }}
              onClick={() => setTab(k)}>
              {label} {k === "all" ? allItems.length : k === "added" ? versionDiff.added.length : k === "removed" ? versionDiff.removed.length : versionDiff.changed.length}
            </button>
          ))}
        </div>

        {/* Diff list */}
        <div className="overflow-y-auto divide-y mx-5 mb-4 rounded-lg"
          style={{ maxHeight: 320, borderColor: T.cloud, border: `1px solid ${T.border}` }}>
          {filtered.map((item, i) => {
            const col = opColor[item.op];
            return (
              <div key={i} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                  style={{ color: col, background: `${col}18` }}>
                  {opLabel[item.op]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: T.ink }}>{item.item}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: T.cloud, color: T.info }}>{item.type}</span>
                    <span className="text-[12px]" style={{ color: T.info }}>{item.detail}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <span className="text-[12px]" style={{ color: T.info }}>
            共 {allItems.length} 项变更 · {base} → {compare}
          </span>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" icon={Download}>导出差异报告</Btn>
            <Btn variant="secondary" onClick={onClose}>关闭</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompareVersionsModal;
