import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Hash, MapPin } from "lucide-react";
import T from "../constants/tokens";
import { getJobList, getJobAbilities } from "../services/jobs";
import { getMajorList } from "../services/dict";
import type { MajorItem, JobItem, JobAbilities } from "../types/api";
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

export default function SkillCompare() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [majors, setMajors] = useState<MajorItem[]>([]);
  const [majorId, setMajorId] = useState("");
  const [city, setCity] = useState("常州");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [compared, setCompared] = useState(false);
  const [abilities, setAbilities] = useState<JobAbilities | null>(null);
  const [loadingAbilities, setLoadingAbilities] = useState(false);

  useEffect(() => {
    getMajorList(1, 100).then(r => setMajors(r.data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!majorId) { setJobs([]); return; }
    setJobsLoading(true);
    const cityId = CITY_MAP[city];
    getJobList(majorId, cityId, 1, 50)
      .then(r => setJobs(r.data.items))
      .catch(() => toast.error("加载岗位列表失败"))
      .finally(() => setJobsLoading(false));
  }, [majorId, city]);

  const handleCompare = async () => {
    if (!selectedJobId) { toast.error("请选择目标岗位"); return; }
    setLoadingAbilities(true);
    try {
      const r = await getJobAbilities(selectedJobId);
      setAbilities(r.data);
      setCompared(true);
    } catch {
      toast.error("加载岗位能力要求失败");
    } finally {
      setLoadingAbilities(false);
    }
  };

  const selectedJob = jobs.find(j => j.job_id === selectedJobId);

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <PageHeader
        breadcrumbs={[t("nav.abilityDiagnosis"), t("nav.skillCompare")]}
        title={t("page.skillCompare.title")}
        description="浏览市场真实招聘岗位的能力要求清单，了解企业用人标准"
      />

      {/* 筛选卡片 */}
      <Card>
        <div className="px-5 py-4 space-y-3">
          {/* 第一行：专业 + 城市 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={labelClass} style={{ color: T.ink }}>专业</span>
              <select className={selectClass} style={{ border: `1px solid ${T.border}`, background: T.white, color: T.ink }}
                value={majorId} onChange={e => { setMajorId(e.target.value); setSelectedJobId(""); setCompared(false); }}>
                <option value="">选择专业...</option>
                {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className={labelClass} style={{ color: T.ink }}>城市</span>
              <select className={selectClass} style={{ border: `1px solid ${T.border}`, background: T.white, color: T.ink }}
                value={city} onChange={e => { setCity(e.target.value); setSelectedJobId(""); setCompared(false); }}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {/* 第二行：岗位 + 操作 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={labelClass} style={{ color: T.ink }}>岗位</span>
              <select className={selectClass} style={{ border: `1px solid ${T.border}`, background: T.white, color: T.ink, minWidth: 240 }}
                value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setCompared(false); }}
                disabled={!majorId || jobsLoading}>
                <option value="">
                  {jobsLoading ? "加载中..." : jobs.length === 0 ? (majorId ? "暂无岗位" : "请先选择专业") : "选择岗位..."}
                </option>
                {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.occupation_name} - {j.company_name}</option>)}
              </select>
            </div>
            <Btn onClick={handleCompare} disabled={!selectedJobId || loadingAbilities}
              title={!majorId ? "请先选择专业" : !selectedJobId ? "请先选择岗位" : "查看该岗位所需能力要求"}>
              {loadingAbilities ? "加载中..." : "查看能力要求"}
            </Btn>
            {!majorId && (
              <span className="text-[12px]" style={{ color: T.info }}>选择专业后自动加载该专业的市场岗位</span>
            )}
          </div>
        </div>
      </Card>

      {/* 结果区域 */}
      {compared && abilities ? (
        <>
          {/* 岗位信息概览 */}
          <Card>
            <div className="px-5 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>岗位名称</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{selectedJob?.occupation_name}</div>
                </div>
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>所属专业</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{abilities.major_name}</div>
                </div>
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>所在城市</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{abilities.city_name}</div>
                </div>
                <div>
                  <div className="text-[12px] mb-0.5" style={{ color: T.info }}>招聘企业</div>
                  <div className="text-[14px] font-medium" style={{ color: T.ink }}>{selectedJob?.company_name}</div>
                </div>
              </div>
              {selectedJob?.source_url && (
                <a href={selectedJob.source_url} target="_blank" rel="noreferrer"
                  className="inline-block mt-3 text-[12px] hover:underline" style={{ color: T.teal }}>
                  查看原始招聘信息 →
                </a>
              )}
            </div>
          </Card>

          {/* 能力要求列表 */}
          <Card title={`岗位能力要求（共 ${abilities.abilities.length} 项）`}>
            {abilities.abilities.length > 0 ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: T.cloud }}>
                    <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>序号</th>
                    <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>能力名称</th>
                    <th className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>要求熟练度</th>
                  </tr>
                </thead>
                <tbody>
                  {abilities.abilities.map((a, i) => (
                    <tr key={a.ability_id} style={{ borderTop: `1px solid ${T.cloud}` }}>
                      <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: T.info }}>{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{a.ability_name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                          style={{
                            color: proficiencyColor[a.proficiency] || T.info,
                            background: `${proficiencyColor[a.proficiency] || T.info}15`,
                          }}>
                          {a.proficiency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.info }}>该岗位暂无能力要求数据</div>
            )}
          </Card>

          <div className="flex justify-end gap-3">
            <Btn variant="secondary" icon={ArrowRight} onClick={() => navigate("/skill-analysis")}>
              进行完整能力分析 →
            </Btn>
          </div>
        </>
      ) : (
        /* 空状态占位 */
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Briefcase, label: "岗位名称", value: "--", sub: "选择目标岗位后显示" },
            { icon: Hash, label: "能力项数", value: "--", sub: "展示岗位要求的能力数量" },
            { icon: MapPin, label: "所在城市", value: "--", sub: "选择城市后筛选对应岗位" },
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
    </div>
  );
}
