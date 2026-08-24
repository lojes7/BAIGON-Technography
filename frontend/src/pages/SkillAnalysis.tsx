import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Eye, ChevronRight, Search, Crosshair, AlertCircle } from "lucide-react";
import T from "../constants/tokens";
import { runAnalysis } from "../services/student";
import { getJobList, getJobAbilities } from "../services/jobs";
import { getMajorList } from "../services/dict";
import type { MajorItem, JobItem, JobAbilities, AnalysisResult } from "../types/api";
import { PageHeader, Btn, Card } from "../components/ui";

const CITIES = ["常州","南京","苏州","无锡","杭州","上海","北京","广州","深圳"];
const CITY_MAP: Record<string, string> = { "常州":"1","南京":"2","苏州":"3","无锡":"4","杭州":"5","上海":"6","北京":"7","广州":"8","深圳":"9" };

const proficiencyColor: Record<string, string> = {
  "必备": T.risk,
  "熟练": T.pending,
  "掌握": T.teal,
  "了解": T.info,
  "加分": T.emerging,
};

const labelClass = "text-[13px] font-medium flex-shrink-0";
const selectClass = "px-3 py-2 rounded-lg text-[13px] outline-none transition-colors focus:border-[#315D6D] min-w-[160px]";

export default function SkillAnalysisPage() {
  const { t } = useTranslation();

  const [majors, setMajors] = useState<MajorItem[]>([]);
  const [anaMajor, setAnaMajor] = useState("");
  const [anaCity, setAnaCity] = useState("常州");

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobAbilities, setJobAbilities] = useState<JobAbilities | null>(null);
  const [abilitiesLoading, setAbilitiesLoading] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => { getMajorList(1, 100).then(r => setMajors(r.data.items)).catch(() => {}); }, []);

  const handleBrowseJobs = async () => {
    if (!anaMajor) { toast.error("请先选择专业"); return; }
    setJobsLoading(true);
    setShowJobs(true);
    setSelectedJobId(null);
    setJobAbilities(null);
    try {
      const r = await getJobList(anaMajor, CITY_MAP[anaCity] ?? "1", 1, 50);
      setJobs(r.data.items);
      if (r.data.items.length === 0) toast("该条件下暂无招聘岗位数据");
    } catch { toast.error("加载岗位列表失败"); }
    finally { setJobsLoading(false); }
  };

  const handleViewAbilities = async (jobId: string) => {
    setSelectedJobId(jobId);
    setAbilitiesLoading(true);
    try {
      const r = await getJobAbilities(jobId);
      setJobAbilities(r.data);
    } catch { toast.error("加载能力要求失败"); }
    finally { setAbilitiesLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!anaMajor) { toast.error("请选择专业"); return; }
    setAnalyzing(true); setAnalysis(null);
    try {
      const r = await runAnalysis({ major_id: anaMajor, city_id: CITY_MAP[anaCity] ?? "1" });
      setAnalysis(r.data);
    } catch { toast.error("分析失败"); }
    finally { setAnalyzing(false); }
  };

  const selectedJob = jobs.find(j => j.job_id === selectedJobId);
  const hasResults = !!analysis;
  const hasNoData = !hasResults && !showJobs;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), "能力分析"]}
        title="能力分析"
        description="对比你的技能画像与市场岗位的真实能力要求，发现差距并获取提升建议"
      />

      {/* 筛选卡片 */}
      <Card>
        <div className="px-5 py-4 space-y-3">
          {/* 第一行：专业 + 城市 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={labelClass} style={{ color: T.ink }}>专业</span>
              <select className={selectClass} style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                value={anaMajor} onChange={e => { setAnaMajor(e.target.value); setShowJobs(false); setAnalysis(null); }}>
                <option value="">选择专业...</option>
                {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className={labelClass} style={{ color: T.ink }}>城市</span>
              <select className={selectClass} style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                value={anaCity} onChange={e => { setAnaCity(e.target.value); setShowJobs(false); setAnalysis(null); }}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {/* 第二行：操作按钮 + 提示 */}
          <div className="flex items-center gap-3">
            <Btn variant="secondary" onClick={handleBrowseJobs} disabled={!anaMajor || jobsLoading}
              title={!anaMajor ? "请先选择专业" : "浏览该专业下的市场招聘岗位"}>
              {jobsLoading ? "加载中..." : "浏览市场岗位"}
            </Btn>
            <Btn onClick={handleAnalyze} disabled={analyzing || !anaMajor}
              title={!anaMajor ? "请先选择专业" : "跳过浏览，直接分析你的技能匹配度"}>
              {analyzing ? "分析中..." : "直接分析"}
            </Btn>
            {!anaMajor && (
              <span className="text-[12px]" style={{ color: T.info }}>请先选择专业和城市，然后开始分析</span>
            )}
          </div>
        </div>
      </Card>

      {/* 岗位列表 */}
      {showJobs && (
        <Card title={`市场招聘岗位（${jobs.length} 个）`}>
          {jobs.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>
              {jobsLoading ? "加载中..." : "该条件下暂无招聘岗位数据"}
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>岗位名称</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>企业</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>城市</th>
                  <th className="px-4 py-2.5 text-center font-medium text-[12px]" style={{ color: T.info }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.job_id} style={{ borderTop: `1px solid ${T.cloud}`, background: selectedJobId === j.job_id ? `${T.teal}08` : undefined }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{j.occupation_name}</td>
                    <td className="px-4 py-2.5" style={{ color: T.info }}>{j.company_name}</td>
                    <td className="px-4 py-2.5" style={{ color: T.info }}>{j.city_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button className="text-[12px] font-medium inline-flex items-center gap-1 hover:underline" style={{ color: T.teal }}
                        onClick={() => handleViewAbilities(j.job_id)}>
                        <Eye size={12} />查看能力要求
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* 岗位能力要求详情 */}
      {selectedJobId && (
        <Card title={selectedJob ? `${selectedJob.occupation_name} · ${selectedJob.company_name}` : "岗位能力要求"}>
          {abilitiesLoading ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>加载中...</div>
          ) : jobAbilities ? (
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>专业</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{jobAbilities.major_name}</div>
                </div>
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>城市</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{jobAbilities.city_name}</div>
                </div>
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>能力项</div>
                  <div className="text-[14px] font-medium" style={{ color: T.teal }}>{jobAbilities.abilities.length} 项</div>
                </div>
              </div>
              <div>
                <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>能力清单</div>
                {jobAbilities.abilities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {jobAbilities.abilities.map(a => (
                      <span key={a.ability_id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px]"
                        style={{ background: T.cloud }}>
                        <span style={{ color: T.ink }}>{a.ability_name}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            color: proficiencyColor[a.proficiency] || T.info,
                            background: `${proficiencyColor[a.proficiency] || T.info}15`,
                          }}>
                          {a.proficiency}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px]" style={{ color: T.info }}>暂无能力数据</div>
                )}
              </div>
              <div className="pt-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <Btn onClick={handleAnalyze} disabled={analyzing} icon={ChevronRight}>
                  {analyzing ? "分析中..." : "基于此岗位开始完整分析"}
                </Btn>
              </div>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>点击岗位行的"查看能力要求"加载数据</div>
          )}
        </Card>
      )}

      {/* 空状态占位 */}
      {hasNoData && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Search, label: "能力项数", value: "--", sub: "选择专业后开始分析" },
            { icon: Crosshair, label: "预计匹配度", value: "--", sub: "对比市场岗位要求" },
            { icon: AlertCircle, label: "缺失能力", value: "--", sub: "分析后自动识别差距" },
          ].map(item => (
            <Card key={item.label}>
              <div className="px-5 py-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.cloud }}>
                  <item.icon size={16} style={{ color: T.info }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>{item.label}</div>
                  <div className="text-[18px] font-medium font-mono" style={{ color: T.ink }}>{item.value}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: T.info }}>{item.sub}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 分析结果 */}
      {analysis && (
        <div className="flex flex-col gap-4">
          <Card title="能力对比">
            {analysis.comparison?.length > 0 ? (
              <table className="w-full text-[13px]">
                <thead><tr style={{ background: T.cloud }}>
                  {["能力","市场要求","你的水平","状态"].map(h => <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {analysis.comparison.map((c, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${T.cloud}` }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{c.ability_name}</td>
                      <td className="px-4 py-2.5">{c.required_proficiency}</td>
                      <td className="px-4 py-2.5">{c.student_proficiency}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] px-2 py-0.5 rounded" style={{
                          color: c.status === "达标" ? T.emerging : T.risk,
                          background: c.status === "达标" ? `${T.emerging}15` : `${T.risk}15`
                        }}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>暂无对比数据</div>}
          </Card>

          {analysis.missing_abilities?.length > 0 && (
            <Card title="缺失能力">
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {analysis.missing_abilities.map((a, i) => <span key={i} className="px-3 py-1 rounded text-[13px]" style={{ background: `${T.risk}12`, color: T.risk }}>{a}</span>)}
              </div>
            </Card>
          )}

          {analysis.ai_suggestion && (
            <Card title="AI 提升建议">
              <div className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: T.ink }}>{analysis.ai_suggestion}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
