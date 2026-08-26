// 分页检索已审核岗位，支持多字段包含匹配，进入详情查看职业与技能。
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Eye, Search, RotateCcw, Sparkles } from "lucide-react";
import T from "../constants/tokens";
import { getJobDetail, getLatestMyJobMatch, listJobs, matchMyResumeToJob } from "../services/jobs";
import { isHttpErrorStatus } from "../services/http-error";
import type { JobData, JobDetail, JobMatchResult } from "../types/api";
import { PageHeader, Card, Btn, Pagination } from "../components/ui";
import AbilityRadialGraph from "../components/AbilityRadialGraph";
import DirectoryPicker from "../components/job-analysis/DirectoryPicker";

interface FilterForm {
  name: string;
  majorId: string;
  occupationId: string;
  major: string;
  city: string;
  province: string;
  salary: string;
  company: string;
  education: string;
  nature: string;
  companySize: string;
}

const EMPTY_FILTER: FilterForm = {
  name: "", majorId: "", occupationId: "", major: "", city: "", province: "",
  salary: "", company: "", education: "", nature: "", companySize: "",
};

export default function JobsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JobData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FilterForm>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterForm>(EMPTY_FILTER);
  const [majorFilterName, setMajorFilterName] = useState("");
  const [occupationFilterName, setOccupationFilterName] = useState("");

  // 详情抽屉
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const detailRequestRef = useRef(0);
  // 人岗匹配
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  const fetchList = () => {
    setLoading(true);
    listJobs({
      page: page - 1,
      pageSize: 20,
      name: applied.name || undefined,
      majorId: applied.majorId || undefined,
      occupationId: applied.occupationId || undefined,
      major: applied.major || undefined,
      city: applied.city || undefined,
      province: applied.province || undefined,
      salary: applied.salary || undefined,
      company: applied.company || undefined,
      education: applied.education || undefined,
      nature: applied.nature || undefined,
      companySize: applied.companySize || undefined,
    })
      .then((res) => { setItems(res.data.items ?? []); setTotal(res.data.total ?? 0); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "岗位列表加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [page, applied]);

  const applyFilter = () => { setApplied({ ...form }); setPage(1); };
  const resetFilter = () => {
    setForm(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
    setMajorFilterName("");
    setOccupationFilterName("");
    setPage(1);
  };

  const openDetail = async (id: string | number) => {
    const requestId = ++detailRequestRef.current;
    setDetail(null);
    setMatch(null);
    setMatchLoading(true);
    setMatching(false);
    const [detailResult, matchResult] = await Promise.allSettled([
      getJobDetail(id),
      getLatestMyJobMatch(id),
    ]);
    if (detailRequestRef.current !== requestId) return;

    if (detailResult.status === "fulfilled") {
      setDetail(detailResult.value.data);
    } else {
      toast.error(detailResult.reason instanceof Error ? detailResult.reason.message : "岗位详情加载失败");
    }
    if (matchResult.status === "fulfilled") {
      setMatch(matchResult.value.data);
    } else if (!isHttpErrorStatus(matchResult.reason, 404)) {
      toast.error(matchResult.reason instanceof Error ? matchResult.reason.message : "最近匹配结果加载失败");
    }
    setMatchLoading(false);
  };

  const handleMatch = async () => {
    if (!detail?.job) return;
    const requestId = detailRequestRef.current;
    const jobId = detail.job.id;
    setMatching(true);
    try {
      const res = await matchMyResumeToJob(jobId);
      if (detailRequestRef.current === requestId) setMatch(res.data);
    } catch (err) {
      if (detailRequestRef.current === requestId) toast.error((err as Error).message);
    } finally {
      if (detailRequestRef.current === requestId) setMatching(false);
    }
  };

  const closeDetail = () => {
    // 使尚未返回的详情或匹配请求失效，避免关闭后抽屉被旧请求重新打开。
    detailRequestRef.current += 1;
    setDetail(null);
    setMatch(null);
    setMatchLoading(false);
    setMatching(false);
  };

  const setField = (k: keyof FilterForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const FIELDS: { key: keyof FilterForm; label: string; placeholder: string; numeric?: boolean }[] = [
    { key: "name", label: "岗位名称", placeholder: "如 Java" },
    { key: "company", label: "公司", placeholder: "如 百工" },
    { key: "major", label: "专业", placeholder: "如 计算机" },
    { key: "city", label: "城市", placeholder: "如 杭州" },
    { key: "province", label: "省份", placeholder: "如 浙江" },
    { key: "salary", label: "薪资", placeholder: "如 20K" },
    { key: "education", label: "学历", placeholder: "如 本科" },
    { key: "nature", label: "工作性质", placeholder: "如 全职" },
    { key: "companySize", label: "公司规模", placeholder: "如 100-499人" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.jobExplore"), "岗位查询"]}
        title="岗位查询"
        description="检索已审核岗位，支持专业/职业 ID 精确筛选，并查看已保存的人岗匹配结果"
      />

      {/* 筛选区 */}
      <Card>
        <div className="px-4 py-4">
          <div className="grid grid-cols-5 gap-3">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-[11px] block mb-1" style={{ color: T.info }}>{f.label}</label>
                <input
                  className="w-full px-2.5 py-1.5 rounded-md text-[13px] outline-none"
                  style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                  value={form[f.key]}
                  onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  inputMode={f.numeric ? "numeric" : undefined}
                />
              </div>
            ))}
          </div>
          <details className="mt-3 rounded-lg bg-white px-3 py-2" style={{ border: `1px solid ${T.border}` }}>
            <summary className="cursor-pointer text-[12px] font-medium" style={{ color: T.info }}>
              规范目录精确筛选
              {(form.majorId || form.occupationId) && (
                <span className="ml-2 font-mono text-[11px]" style={{ color: T.teal }}>
                  {form.majorId ? `专业 ${form.majorId}` : ""}{form.majorId && form.occupationId ? " · " : ""}
                  {form.occupationId ? `职业 ${form.occupationId}` : ""}
                </span>
              )}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[11px]" style={{ color: T.info }}>专业目录</div>
                <DirectoryPicker
                  kind="major"
                  selectedId={form.majorId || null}
                  selectedName={majorFilterName}
                  onSelect={(id, name) => {
                    setField("majorId", id);
                    setMajorFilterName(name);
                  }}
                />
              </div>
              <div>
                <div className="mb-1 text-[11px]" style={{ color: T.info }}>职业目录</div>
                <DirectoryPicker
                  kind="occupation"
                  selectedId={form.occupationId || null}
                  selectedName={occupationFilterName}
                  onSelect={(id, name) => {
                    setField("occupationId", id);
                    setOccupationFilterName(name);
                  }}
                />
              </div>
            </div>
          </details>
          <div className="flex items-center gap-2 mt-3">
            <Btn icon={Search} size="sm" onClick={applyFilter}>查询</Btn>
            <Btn variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilter}>重置</Btn>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无岗位数据</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["ID", "岗位名称", "公司", "城市", "省份", "薪资", "学历", "经验", "专业", "来源", "发布时间", "操作"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{j.id}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{j.name || "—"}</td>
                  <td className="px-4 py-3" style={{ color: T.ink }}>{j.companyName || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.city || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.province || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.salary || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.education || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.experience || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>
                    <div>{j.major || "—"}</div>
                    {j.majorId && <div className="mt-0.5 font-mono text-[10px]">ID：{j.majorId}</div>}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{j.sourcePlatform || "—"}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{j.publishDate?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3">
                    <button className="text-[12px] font-medium flex items-center gap-1" style={{ color: T.teal }}
                      onClick={() => openDetail(j.id)}>
                      <Eye size={12} />详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > 20 && (
        <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
      )}

      {/* 详情抽屉 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={closeDetail}>
          <div className="ml-auto w-[600px] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{detail.job?.name || "岗位详情"}</h3>
                <div className="text-[12px] mt-0.5" style={{ color: T.info }}>
                  {[detail.job?.companyName, detail.job?.city, detail.job?.province].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={closeDetail} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-5">
                {/* 基本信息 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>基本信息</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                    {[
                      ["薪资", detail.job?.salary], ["学历", detail.job?.education],
                      ["经验", detail.job?.experience], ["工作性质", detail.job?.nature],
                      ["专业", detail.job?.major], ["公司规模", detail.job?.companySize],
                      ["来源平台", detail.job?.sourcePlatform], ["发布时间", detail.job?.publishDate?.slice(0, 10)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between" style={{ borderBottom: `1px dashed ${T.cloud}` }}>
                        <span style={{ color: T.info }}>{k}</span>
                        <span className="text-right" style={{ color: T.ink }}>{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 关联专业 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>关联专业</div>
                  {detail.major ? (
                    <div className="rounded-lg p-3" style={{ background: T.cloud }}>
                      <div className="text-[13px] font-medium" style={{ color: T.ink }}>{detail.major.name}</div>
                      <div className="mt-0.5 flex gap-3 text-[12px]" style={{ color: T.info }}>
                        {detail.major.code && <span>编码：{detail.major.code}</span>}
                        <span className="font-mono">ID：{detail.major.id}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px]" style={{ color: T.info }}>尚未关联规范专业</div>
                  )}
                </section>

                {/* 关联职业 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>关联职业</div>
                  {detail.occupation ? (
                    <div className="rounded-lg p-3" style={{ background: T.cloud }}>
                      <div className="text-[13px] font-medium" style={{ color: T.ink }}>{detail.occupation.name}</div>
                      {detail.occupation.code && <div className="text-[12px] mt-0.5" style={{ color: T.info }}>编码：{detail.occupation.code}</div>}
                      <div className="font-mono text-[12px] mt-0.5" style={{ color: T.info }}>ID：{detail.occupation.id}</div>
                      {detail.occupation.description && <div className="text-[12px] mt-0.5" style={{ color: T.info }}>{detail.occupation.description}</div>}
                    </div>
                  ) : (
                    <div className="text-[13px]" style={{ color: T.info }}>尚未归类</div>
                  )}
                </section>

                {/* 岗位能力图谱 */}
                <section>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>
                    能力图谱（{detail.jobSkills?.length ?? 0}）
                  </div>
                  {detail.jobSkills?.length ? (
                    <div className="rounded-lg p-3" style={{ background: "white", border: `1px solid ${T.border}` }}>
                      <AbilityRadialGraph
                        centerLabel={detail.job?.name || "岗位"}
                        abilities={detail.jobSkills.map(s => ({
                          name: s.skillName,
                          proficiency: s.skillProficiency,
                          evidence: s.evidence,
                        }))}
                        emptyHint="暂无正式技能"
                      />
                    </div>
                  ) : (
                    <div className="text-[13px]" style={{ color: T.info }}>暂无正式技能</div>
                  )}
                </section>

                {/* 岗位技能明细 */}
                {detail.jobSkills?.length ? (
                  <section>
                    <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>技能明细</div>
                    <div className="space-y-2">
                      {detail.jobSkills.map(s => (
                        <div key={String(s.id)} className="rounded-lg p-3" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium" style={{ color: T.ink }}>{s.skillName}</span>
                            <div className="flex items-center gap-2">
                              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{
                                background: s.skillId ? `${T.emerging}12` : `${T.pending}12`,
                                color: s.skillId ? T.emerging : T.pending,
                              }}>
                                {s.skillId ? "已归一" : "待归一"}
                              </span>
                              <span className="text-[12px]" style={{ color: T.teal }}>{s.skillProficiency || "—"}</span>
                            </div>
                          </div>
                          {s.skillId && <div className="font-mono text-[11px] mt-1" style={{ color: T.info }}>规范技能 ID：{s.skillId}</div>}
                          {s.evidence && <div className="text-[12px] mt-1" style={{ color: T.info }}>{s.evidence}</div>}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* 职位描述 */}
                {detail.job?.jobDescription && (
                  <section>
                    <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>职位描述</div>
                    <div className="rounded-lg p-3 text-[13px] leading-relaxed whitespace-pre-wrap"
                      style={{ background: T.cloud, color: T.ink }}>{detail.job.jobDescription}</div>
                  </section>
                )}

                {/* 人岗匹配 */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] font-medium" style={{ color: T.info }}>人岗匹配</div>
                    <Btn size="sm" icon={Sparkles} onClick={handleMatch} disabled={matching}>
                      {matching ? "匹配中…" : match ? "重新匹配" : "匹配我的简历"}
                    </Btn>
                  </div>

                  {matchLoading ? (
                    <div className="rounded-lg p-4 text-center text-[12px]" style={{ background: T.cloud, color: T.info }}>
                      正在读取最近一次匹配结果…
                    </div>
                  ) : match ? (
                    <div className="rounded-lg p-4 space-y-3" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]" style={{ color: T.info }}>
                        <span>结果 ID：{match.id}</span>
                        <span>简历 ID：{match.resumeId}</span>
                        <span>生成时间：{match.createdAt || "—"}</span>
                      </div>
                      {/* 匹配度分数 */}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "white", border: `3px solid ${scoreColor(match.score)}` }}>
                          <span className="text-[18px] font-bold font-mono" style={{ color: scoreColor(match.score) }}>
                            {match.score}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium" style={{ color: T.ink }}>匹配度评分</div>
                          {match.summary && (
                            <div className="text-[12px] mt-1 leading-relaxed" style={{ color: T.info }}>{match.summary}</div>
                          )}
                        </div>
                      </div>

                      {/* 待学习技能 */}
                      {match.skillsToLearn?.length > 0 && (
                        <div>
                          <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>
                            待学习技能（{match.skillsToLearn.length}）
                          </div>
                          <div className="space-y-2">
                            {match.skillsToLearn.map((s, i) => (
                              <div key={i} className="rounded-md p-2.5 text-[12px]" style={{ background: "white", border: `1px solid ${T.border}` }}>
                                <div className="font-medium" style={{ color: T.ink }}>{s.skillName}</div>
                                {s.reason && <div className="mt-0.5" style={{ color: T.info }}>原因：{s.reason}</div>}
                                {s.suggestion && <div className="mt-0.5" style={{ color: T.teal }}>建议：{s.suggestion}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 行动建议 */}
                      {match.actionSuggestions?.length > 0 && (
                        <div>
                          <div className="text-[12px] font-medium mb-2" style={{ color: T.ink }}>行动建议</div>
                          <ul className="space-y-1">
                            {match.actionSuggestions.map((a, i) => (
                              <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: T.ink }}>
                                <span style={{ color: T.teal }}>•</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    !matching && (
                      <div className="rounded-lg p-4 text-center text-[12px]" style={{ background: T.cloud, color: T.info }}>
                        尚无已保存的匹配结果。点击「匹配我的简历」使用最新简历开始分析
                      </div>
                    )
                  )}
                </section>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 匹配度分数颜色：低分警示、中等提醒、高分达标
function scoreColor(score: number): string {
  if (score >= 80) return T.emerging;
  if (score >= 60) return T.pending;
  return T.risk;
}
