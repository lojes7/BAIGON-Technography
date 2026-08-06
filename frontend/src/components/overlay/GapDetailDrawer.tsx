import { useState } from "react";
import { X, FileSearch, Sparkles, AlertTriangle } from "lucide-react";
import T from "../../constants/tokens";
import gapData from "../../data/gap";
import Btn from "../ui/Btn";
import GenerateSuggestionPanel from "./GenerateSuggestionPanel";

function GapDetailDrawer({
  skill, onClose,
}: { skill: typeof gapData[0]; onClose: () => void }) {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const gap = skill.demand - skill.supply;
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-96 h-full bg-white shadow-xl overflow-y-auto flex flex-col"
        style={{ borderLeft: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div>
            <div className="text-[15px] font-medium" style={{ color: T.ink }}>{skill.name}</div>
            <div className="text-[12px] mt-0.5" style={{ color: T.info }}>{skill.cat}</div>
          </div>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: T.cloud }}>
          {/* Summary */}
          <div className="px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "需求分", value: skill.demand, color: T.risk },
                { label: "供给分", value: skill.supply, color: T.stable },
                { label: "缺口", value: gap > 0 ? `+${gap}` : gap, color: gap > 20 ? T.risk : T.pending },
              ].map((s, i) => (
                <div key={i} className="rounded p-3" style={{ background: T.cloud }}>
                  <div className="font-mono text-[20px] font-medium" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: T.info }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Demand breakdown */}
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
              需求强度构成
            </div>
            <div className="space-y-2 text-[12px]">
              {[
                { label: "岗位覆盖率", value: `${skill.demand}%`, bar: skill.demand },
                { label: "企业数量权重", value: `${skill.z} 家企业`, bar: Math.min(skill.z * 2, 100) },
                { label: "连续增长期数", value: "3 个半年窗口", bar: 75 },
              ].map((row, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1" style={{ color: T.ink }}>
                    <span>{row.label}</span>
                    <span className="font-mono">{row.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.cloud }}>
                    <div className="h-full rounded-full" style={{ width: `${row.bar}%`, background: T.risk }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supply breakdown */}
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
              供给强度构成
            </div>
            <div className="space-y-2 text-[12px]">
              {[
                { label: "课程覆盖声明", value: `${Math.round(skill.supply * 0.6)}分`, bar: skill.supply * 0.6 },
                { label: "教学内容证据", value: `${Math.round(skill.supply * 0.3)}分`, bar: skill.supply * 0.3 },
                { label: "考核/实践证据", value: `${Math.round(skill.supply * 0.1)}分`, bar: skill.supply * 0.1 },
              ].map((row, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1" style={{ color: T.ink }}>
                    <span>{row.label}</span>
                    <span className="font-mono">{row.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.cloud }}>
                    <div className="h-full rounded-full" style={{ width: `${row.bar}%`, background: T.stable }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current courses */}
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
              当前课程支撑
            </div>
            {skill.supply < 30 ? (
              <div className="text-[12px] p-3 rounded" style={{ background: `${T.risk}08`, color: T.risk, border: `1px solid ${T.risk}25` }}>
                <AlertTriangle size={13} className="inline mr-1" />
                此能力当前无有效课程覆盖，建议优先改进
              </div>
            ) : (
              <div className="space-y-2 text-[12px]">
                {["Python机器学习实践", "大模型应用开发"].map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded"
                    style={{ background: T.cloud }}>
                    <span style={{ color: T.ink }}>{c}</span>
                    <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ color: T.stable, background: `${T.stable}18` }}>教学M</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lag */}
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
              响应时滞
            </div>
            <div className="text-[13px]" style={{ color: T.ink }}>
              {skill.demand > 60 && skill.supply < 30
                ? <span style={{ color: T.risk }}>需求信号出现已超 12 个月，尚未见方案响应</span>
                : "方案响应时滞约 9 个月，考核证据尚未跟进"}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <Btn variant="secondary" size="sm" icon={FileSearch}>查看证据</Btn>
          <Btn size="sm" icon={Sparkles} onClick={() => setSuggestionOpen(true)}>生成建议</Btn>
        </div>
      </div>
      {suggestionOpen && (
        <GenerateSuggestionPanel
          skill={skill}
          onClose={() => setSuggestionOpen(false)}
        />
      )}
    </div>
  );
}

export default GapDetailDrawer;
