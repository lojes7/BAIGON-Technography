import { useState } from "react";
import { toast } from "sonner";
import { X, Sparkles, CheckCircle, Pencil } from "lucide-react";
import T from "../../constants/tokens";
import Btn from "../ui/Btn";
import ConfidenceBadge from "../ui/ConfidenceBadge";

function GenerateSuggestionPanel({
  skill, onClose,
}: { skill: { name: string; demand: number; supply: number; cat: string }; onClose: () => void }) {
  const [generating, setGenerating] = useState(true);
  const [accepted, setAccepted] = useState<null | boolean>(null);
  const gap = skill.demand - skill.supply;

  useState(() => {
    const t = setTimeout(() => setGenerating(false), 1400);
    return () => clearTimeout(t);
  });

  const suggestion = {
    title: `${skill.name}能力缺口改进建议`,
    priority: gap > 40 ? "高" : gap > 20 ? "中" : "低",
    type: gap > 30 ? "新增课程 + 实践环节" : "课程内容强化",
    rationale: `${skill.name}当前需求分 ${skill.demand}，供给分仅 ${skill.supply}，缺口 +${gap}（${skill.cat}）。连续两个半年窗口保持上升趋势，现有培养方案对此能力的最高证据等级为"声明（L）"，尚无正式教学或考核记录。`,
    content: gap > 30
      ? `建议在专业培养方案中新增"${skill.name}应用实践"专题模块，不少于 16 学时，并设计相应 Rubric 评分标准纳入考核体系。可与"智能应用开发实训"课程合并设计。`
      : `建议在现有相关课程中强化${skill.name}的教学内容占比，从声明（L）级提升至教学（M）级，并在期末考核中增加相关题目或实验项目。`,
    level: "课程级",
    conf: gap > 40 ? 0.91 : 0.78,
  };

  const priorityColor = { 高: T.risk, 中: T.pending, 低: T.info }[suggestion.priority]!;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4"
      style={{ background: "rgba(25,50,77,0.2)" }} onClick={onClose}>
      <div className="bg-white rounded-lg w-[440px] max-h-[80vh] flex flex-col"
        style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: T.teal }} />
            <h3 className="text-[14px] font-medium" style={{ color: T.ink }}>AI生成改进建议</h3>
            <span className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: "#EBF2FA", color: T.stable }}>模型生成说明</span>
          </div>
          <button onClick={onClose} style={{ color: T.info }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: T.teal, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="text-[13px]" style={{ color: T.info }}>正在分析供需数据，生成建议草案…</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header tags */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                  style={{ color: priorityColor, background: `${priorityColor}18` }}>
                  {suggestion.priority}优先级
                </span>
                <span className="text-[12px] px-2 py-0.5 rounded"
                  style={{ background: T.cloud, color: T.info }}>{suggestion.type}</span>
                <span className="text-[12px] px-2 py-0.5 rounded"
                  style={{ background: T.cloud, color: T.info }}>{suggestion.level}</span>
                <ConfidenceBadge value={suggestion.conf} />
              </div>

              {/* Title */}
              <div className="text-[14px] font-medium leading-snug" style={{ color: T.ink }}>
                {suggestion.title}
              </div>

              {/* Rationale */}
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: T.info }}>
                  数据依据
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: T.ink }}>{suggestion.rationale}</p>
              </div>

              {/* Content */}
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: T.info }}>
                  改进建议
                </div>
                <p className="text-[13px] leading-relaxed p-3 rounded"
                  style={{ background: `${T.teal}08`, color: T.ink, border: `1px solid ${T.teal}20` }}>
                  {suggestion.content}
                </p>
              </div>

              {/* Disclaimer */}
              <div className="text-[11px] p-2.5 rounded leading-relaxed"
                style={{ background: T.cloud, color: T.info }}>
                以上内容由AI模型基于当前数据生成，需经专家审核后方可作为正式建议采纳。
              </div>

              {accepted !== null && (
                <div className="flex items-center gap-2 text-[13px] p-2.5 rounded"
                  style={{ background: accepted ? `${T.emerging}0A` : `${T.risk}0A`,
                    color: accepted ? T.emerging : T.risk, border: `1px solid ${accepted ? T.emerging : T.risk}25` }}>
                  {accepted ? <CheckCircle size={14} /> : <X size={14} />}
                  {accepted ? "已采纳并加入改进建议列表" : "已驳回此条建议"}
                </div>
              )}
            </div>
          )}
        </div>

        {!generating && accepted === null && (
          <div className="px-5 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="ghost" size="sm" onClick={() => { setAccepted(false); setTimeout(onClose, 800); }}>驳回</Btn>
            <Btn variant="secondary" size="sm" icon={Pencil}>修改后采纳</Btn>
            <Btn size="sm" icon={CheckCircle} onClick={() => { setAccepted(true); toast.success("建议已采纳", { description: "已加入改进建议列表，等待专家确认" }); setTimeout(onClose, 900); }}>
              采纳建议
            </Btn>
          </div>
        )}
        {!generating && accepted !== null && (
          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="secondary" size="sm" onClick={onClose}>关闭</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerateSuggestionPanel;
