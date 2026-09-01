import { useTranslation } from "react-i18next";
import { useState } from "react";
import { CheckCircle } from "lucide-react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { getComboEvolution } from "../services/analytics";
import type { ComboEvolutionData, ComboEvidenceJob } from "../types/api";
import { PageHeader, Card } from "../components/ui";

const DEFAULT_BASE_PERIOD = "2025H1";
const DEFAULT_COMPARE_PERIOD = "2026H1";

function SkillCombosPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ComboEvolutionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [centerSkillId, setCenterSkillId] = useState("");

  const fetchData = async (skillId: string) => {
    if (!skillId) return;
    setLoading(true);
    try {
      const res = await getComboEvolution({
        center_skill_id: skillId,
        base_period: DEFAULT_BASE_PERIOD,
        compare_period: DEFAULT_COMPARE_PERIOD,
      });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const center = data?.center_skill;
  const networkNodes = data?.network?.nodes || [];
  const networkEdges = data?.network?.edges || [];
  const changes = data?.changes || [];
  const evidenceJobs: ComboEvidenceJob[] = data?.evidence_jobs || [];

  const cx = 175, cy = 165;
  const maxR = 130;

  const getNodePos = (idx: number, total: number) => {
    if (idx === 0) return { x: cx, y: cy };
    const angle = ((idx - 1) / (total - 1 || 1)) * 360;
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + maxR * Math.cos(rad), y: cy + maxR * Math.sin(rad) };
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.evolution"), t("nav.skillCombos")]}
        title={t("page.skillCombos.title")}
        description={t("page.skillCombos.desc")}
      />

      <div className="flex items-center gap-4 text-[13px]">
        <div className="flex items-center gap-2">
          <span style={{ color: T.info }}>主能力 ID：</span>
          <input className="px-3 py-1.5 rounded-lg text-[13px] outline-none w-40" style={{ border: `1px solid ${T.border}`, background: T.white, color: T.ink }}
            placeholder="输入技能 ID"
            value={centerSkillId}
            onChange={e => setCenterSkillId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchData(centerSkillId)} />
          <button className="text-[12px] px-3 py-1.5 rounded-md font-medium" style={{ background: T.ink, color: T.white }}
            onClick={() => fetchData(centerSkillId)}>查询</button>
        </div>
        {center && <span style={{ color: T.ink }}>当前：{center.name}</span>}
        <span style={{ color: T.info }}>
          时间对比：{DEFAULT_BASE_PERIOD} vs {DEFAULT_COMPARE_PERIOD}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title="当前共现网络" className="col-span-3">
          <div className="flex justify-center">
            {networkNodes.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-[330px] text-[13px]" style={{ color: T.info }}>
                暂无组合数据
              </div>
            ) : (
              <svg width="350" height="330" viewBox="0 0 350 330">
                {networkEdges.map((edge, i) => {
                  const srcIdx = networkNodes.findIndex((n) => n.skill_id === edge.source_skill_id);
                  const tgtIdx = networkNodes.findIndex((n) => n.skill_id === edge.target_skill_id);
                  if (srcIdx < 0 || tgtIdx < 0) return null;
                  const from = getNodePos(srcIdx, networkNodes.length);
                  const to = getNodePos(tgtIdx, networkNodes.length);
                  const isNew = edge.status === "new";
                  return (
                    <g key={i}>
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={isNew ? T.emerging : T.teal}
                        strokeWidth={edge.cooccurrence_rate * 4}
                        strokeDasharray={isNew ? "none" : "5 3"}
                        opacity={0.5} />
                      <text x={(from.x + to.x) / 2 + 4} y={(from.y + to.y) / 2 - 4}
                        fontSize="9" fill={T.info} textAnchor="middle">
                        {(edge.cooccurrence_rate * 100).toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
                {networkNodes.map((node, idx) => {
                  const pos = getNodePos(node.center ? 0 : idx, networkNodes.length);
                  const isCenter = node.center;
                  const isNew = changes.some((c) => c.skill_id === node.skill_id && c.change_type === "added");
                  const r = isCenter ? 28 : 26;
                  const fill = isCenter ? T.ink : isNew ? T.emerging : `${T.teal}20`;
                  const stroke = isCenter ? T.ink : isNew ? T.emerging : T.teal;
                  const textColor = isCenter || isNew ? "white" : T.teal;
                  return (
                    <g key={node.skill_id}>
                      <circle cx={pos.x} cy={pos.y} r={r}
                        fill={fill} stroke={stroke} strokeWidth={isNew ? 2 : 1.5} />
                      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
                        fontSize={isCenter ? 9 : 8} fill={textColor} fontWeight={isCenter ? "600" : "400"}>
                        {node.name.length > 5 ? node.name.slice(0, 5) : node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          <div className="px-4 pb-3 flex items-center gap-5 text-[11px]" style={{ color: T.info }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ background: T.emerging }} />新增共现
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ background: T.teal, borderTop: "1px dashed" }} />既有共现
            </div>
            <div>连线粗细代表共现频率</div>
          </div>
        </Card>

        <Card title="变化排行" className="col-span-2">
          <div className="divide-y divide-[#E4EAF2]" >
            {changes.length === 0 && !loading ? (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无变化</div>
            ) : (
              changes.map((c, i) => {
                const isNew = c.change_type === "added" || c.change_pp > 0;
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium px-1.5 py-0.5 rounded"
                        style={{ color: isNew ? T.emerging : T.risk,
                          background: isNew ? `${T.emerging}18` : `${T.risk}18` }}>
                        {isNew ? "+ 新增" : "- 减少"}
                      </span>
                      <span className="text-[13px] font-medium" style={{ color: T.ink }}>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]" style={{ color: T.info }}>
                      <span className="font-mono font-medium"
                        style={{ color: isNew ? T.emerging : T.risk }}>
                        {c.change_pp > 0 ? "+" : ""}{c.change_pp.toFixed(1)}pp
                      </span>
                      <span>{c.base_rate.toFixed(1)}% → {c.compare_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card title="证据岗位列表">
        {evidenceJobs.length === 0 && !loading ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>暂无证据岗位数据</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["岗位名称", ...networkNodes.filter((n) => !n.center).slice(0, 5).map((n) => n.name), "共现数"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidenceJobs.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{row.job_name}</td>
                  {networkNodes.filter((n) => !n.center).slice(0, 5).map((sk) => (
                    <td key={sk.skill_id} className="px-4 py-3 text-center">
                      {row.skill_ids.includes(sk.skill_id)
                        ? <CheckCircle size={14} style={{ color: T.emerging, margin: "0 auto" }} />
                        : <span style={{ color: T.cloud }}>-</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 font-mono font-medium" style={{ color: T.ink }}>{row.cooccurrence_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export default SkillCombosPage;
