import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, X, Download, Eye, Search, Pencil } from "lucide-react";
import T from "../constants/tokens";
import { getResumeList, uploadResume, getResumeDetail, confirmResume, updateResume } from "../services/student";
import type { ResumeItem, ResumeDetail } from "../types/api";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";

export default function MyResume() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileUrl = (path: string) => `http://localhost:8000${path}`;
  const [resumeDetail, setResumeDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    education_experiences: { school_name: string; degree: string; major: string }[];
    work_experiences: { company_name: string; position: string; project_experience: { project_name: string; position: string; project_description: string }[] }[];
    project_experiences: { project_name: string; position: string; project_description: string }[];
    professional_skills: { skill_name: string; skill_description: string }[];
    awards: { award_name: string; award_description: string }[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewFile, setViewFile] = useState<ResumeItem | null>(null);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);

  const fetchResumes = () => {
    getResumeList().then(res => setResumes(res.data)).catch(() => {});
  };
  useEffect(() => { fetchResumes(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadResume(file);
      toast.success("上传成功");
      fetchResumes();
    } catch (err) { toast.error((err as Error).message); }
    if (fileRef.current) fileRef.current.value = "";
  };


  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personalCenter"), t("nav.myResume")]}
        title={t("page.myResume.title")}
        description="上传简历文件，系统自动解析提取技能信息"
      />

      <Card title={t("page.myResume.uploadArea")}>
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <input type="file" accept=".pdf,.docx" ref={fileRef} onChange={handleUpload} style={{ display: "none" }} />
          <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-12 w-full cursor-pointer transition-colors"
            style={{ borderColor: T.border, background: T.cloud }}
            onClick={() => fileRef.current?.click()}>
            <Upload size={32} style={{ color: T.info, marginBottom: 12 }} />
            <div className="text-[14px] font-medium" style={{ color: T.ink }}>拖拽文件到此处上传</div>
            <div className="text-[12px] mt-1" style={{ color: T.info }}>或点击选择文件 · 支持 PDF / Word</div>
          </div>
          <Btn icon={Upload} onClick={() => fileRef.current?.click()}>{t("page.myResume.selectFile")}</Btn>
        </div>
      </Card>

      <Card title={t("page.myResume.uploadHistory")}>
        {resumes.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr style={{ background: T.cloud }}>{[t("page.myResume.colFile"), "大小", t("page.myResume.colParseTime"), t("page.myResume.colAction")].map(h => (<th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>))}</tr></thead>
            <tbody>{resumes.map(r => (<tr key={r.resume_id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}><td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.file_name}</td><td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : "—"}</td><td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{new Date(r.uploaded_at).toLocaleDateString()}</td><td className="px-4 py-3 flex items-center gap-2"><button className="text-[12px] font-medium" style={{ color: T.teal }} onClick={() => setViewFile(r)}><Eye size={12} className="inline mr-0.5" />查看</button><span className="mx-1.5" style={{ color: T.cloud }}>|</span><button className="text-[12px] font-medium" style={{ color: T.info }}
                        onClick={async () => { setDetailLoading(true); try { const res = await getResumeDetail(r.resume_id); setResumeDetail(res.data); } catch { toast.error("加载详情失败"); } finally { setDetailLoading(false); } }}><Search size={12} className="inline mr-0.5" />智能解析</button></td></tr>))}</tbody>
          </table>
        )}
      </Card>


      {/* AI 解析详情抽屉 */}
      {resumeDetail && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setResumeDetail(null)}>
          <div className="ml-auto w-[520px] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div className="min-w-0 flex-1 mr-2">
                <h3 className="text-[14px] font-medium truncate" style={{ color: T.ink }}>{resumeDetail.file_name}</h3>
                <div className="mt-1">
                  <StatusBadge status={resumeDetail.review_status} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!editing && (
                  <>
                    <button className="text-[12px] flex items-center gap-1" style={{ color: T.teal }}
                      onClick={() => window.open(fileUrl(resumeDetail.file_path), "_blank")} title="查看原件">
                      <Eye size={13} />原件
                    </button>
                    <button className="text-[12px] flex items-center gap-1" style={{ color: T.info }}
                      onClick={() => { setEditForm({
                        education_experiences: resumeDetail.education_experiences.map(e => ({...e})),
                        work_experiences: resumeDetail.work_experiences.map(w => ({company_name: w.company_name, position: w.position, project_experience: w.project_experience})),
                        project_experiences: resumeDetail.project_experiences.map(p => ({...p})),
                        professional_skills: resumeDetail.professional_skills.map(s => ({...s})),
                        awards: resumeDetail.awards.map(a => ({...a})),
                      }); setEditing(true); }}>
                      <Pencil size={13} />编辑
                    </button>
                  </>
                )}
                <button onClick={() => { setResumeDetail(null); setEditing(false); }} style={{ color: T.info }}><X size={18} /></button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: T.info }}>加载中...</div>
            ) : (
              <div className="px-5 py-4 space-y-5">
                {editing && editForm ? (
                  <>
                    <Section title="教育经历">
                      {editForm.education_experiences.map((e, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                          <input className="px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={e.school_name} onChange={ev => setEditForm(p => { const n = [...p!.education_experiences]; n[i] = {...n[i], school_name: ev.target.value}; return {...p!, education_experiences: n}; })} placeholder="学校" />
                          <input className="px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={e.degree} onChange={ev => setEditForm(p => { const n = [...p!.education_experiences]; n[i] = {...n[i], degree: ev.target.value}; return {...p!, education_experiences: n}; })} placeholder="学历" />
                          <input className="px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={e.major} onChange={ev => setEditForm(p => { const n = [...p!.education_experiences]; n[i] = {...n[i], major: ev.target.value}; return {...p!, education_experiences: n}; })} placeholder="专业" />
                        </div>
                      ))}
                    </Section>
                    <Section title="专业技能">
                      {editForm.professional_skills.map((s, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input className="flex-1 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={s.skill_name} onChange={ev => setEditForm(p => { const n = [...p!.professional_skills]; n[i] = {...n[i], skill_name: ev.target.value}; return {...p!, professional_skills: n}; })} placeholder="技能名" />
                        </div>
                      ))}
                    </Section>
                    <Section title="工作经历">
                      {editForm.work_experiences.map((w, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input className="flex-1 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={w.company_name} onChange={ev => setEditForm(p => { const n = [...p!.work_experiences]; n[i] = {...n[i], company_name: ev.target.value}; return {...p!, work_experiences: n}; })} placeholder="公司" />
                          <input className="w-32 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={w.position} onChange={ev => setEditForm(p => { const n = [...p!.work_experiences]; n[i] = {...n[i], position: ev.target.value}; return {...p!, work_experiences: n}; })} placeholder="职位" />
                        </div>
                      ))}
                    </Section>
                    <Section title="项目经历">
                      {editForm.project_experiences.map((p, i) => (
                        <div key={i} className="space-y-1 mb-2">
                          <div className="flex gap-2">
                            <input className="flex-1 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={p.project_name} onChange={ev => setEditForm(pf => { const n = [...pf!.project_experiences]; n[i] = {...n[i], project_name: ev.target.value}; return {...pf!, project_experiences: n}; })} placeholder="项目名" />
                            <input className="w-32 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={p.position} onChange={ev => setEditForm(pf => { const n = [...pf!.project_experiences]; n[i] = {...n[i], position: ev.target.value}; return {...pf!, project_experiences: n}; })} placeholder="角色" />
                          </div>
                          <textarea className="w-full px-2 py-1.5 rounded text-[13px] outline-none resize-none" rows={2} style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={p.project_description} onChange={ev => setEditForm(pf => { const n = [...pf!.project_experiences]; n[i] = {...n[i], project_description: ev.target.value}; return {...pf!, project_experiences: n}; })} placeholder="描述" />
                        </div>
                      ))}
                    </Section>
                    <Section title="获奖">
                      {editForm.awards.map((a, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input className="flex-1 px-2 py-1.5 rounded text-[13px] outline-none" style={{ background: T.cloud, border: `1px solid ${T.border}` }} value={a.award_name} onChange={ev => setEditForm(p => { const n = [...p!.awards]; n[i] = {...n[i], award_name: ev.target.value}; return {...p!, awards: n}; })} placeholder="奖项名" />
                        </div>
                      ))}
                    </Section>
                  </>
                ) : (
                  <>
                    {resumeDetail.education_experiences?.length > 0 && (
                      <Section title="教育经历">
                        {resumeDetail.education_experiences.map((e, i) => (
                          <div key={i} className="p-3 rounded-md text-[13px]" style={{ background: T.cloud }}>
                            <div className="font-medium" style={{ color: T.ink }}>{e.school_name}</div>
                            <div style={{ color: T.info }}>{e.degree} · {e.major}</div>
                          </div>
                        ))}
                      </Section>
                    )}
                    {resumeDetail.professional_skills?.length > 0 && (
                      <Section title="专业技能">
                        <div className="flex flex-wrap gap-2">
                          {resumeDetail.professional_skills.map((s, i) => (
                            <span key={i} className="px-3 py-1 rounded-md text-[13px]" style={{ background: T.cloud, color: T.ink }}>{s.skill_name}</span>
                          ))}
                        </div>
                      </Section>
                    )}
                    {resumeDetail.work_experiences?.length > 0 && (
                      <Section title="工作经历">
                        {resumeDetail.work_experiences.map((w, i) => (
                          <div key={i} className="mb-2 p-3 rounded-md text-[13px]" style={{ background: T.cloud }}>
                            <div className="font-medium" style={{ color: T.ink }}>{w.company_name} · {w.position}</div>
                            {w.project_experience?.map((p, j) => <div key={j} className="mt-1 text-[12px]" style={{ color: T.info }}>· {p.project_name}</div>)}
                          </div>
                        ))}
                      </Section>
                    )}
                    {resumeDetail.project_experiences?.length > 0 && (
                      <Section title="项目经历">
                        {resumeDetail.project_experiences.map((p, i) => (
                          <div key={i} className="mb-2 p-3 rounded-md text-[13px]" style={{ background: T.cloud }}>
                            <div className="font-medium" style={{ color: T.ink }}>{p.project_name} · {p.position}</div>
                            <div className="mt-1 text-[12px]" style={{ color: T.info }}>{p.project_description}</div>
                          </div>
                        ))}
                      </Section>
                    )}
                    {resumeDetail.awards?.length > 0 && (
                      <Section title="获奖">
                        {resumeDetail.awards.map((a, i) => <div key={i} className="text-[13px]" style={{ color: T.ink }}>· {a.award_name}</div>)}
                      </Section>
                    )}
                    {!resumeDetail.education_experiences?.length && !resumeDetail.professional_skills?.length && !resumeDetail.work_experiences?.length && !resumeDetail.project_experiences?.length && !resumeDetail.awards?.length && (
                      <div className="text-center py-8 text-[13px]" style={{ color: T.info }}>暂无解析数据</div>
                    )}
                  </>
                )}

                <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  {editing ? (
                    <>
                      <Btn size="sm" onClick={async () => {
                        if (!editForm) return;
                        setSaving(true);
                        try {
                          await updateResume(resumeDetail.resume_id, editForm);
                          const updated = await getResumeDetail(resumeDetail.resume_id);
                          setResumeDetail(updated.data);
                          setEditing(false);
                          toast.success("已保存");
                        } catch { toast.error("保存失败"); }
                        finally { setSaving(false); }
                      }} disabled={saving}>{saving ? "保存中..." : "保存修订"}</Btn>
                      <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>取消</Btn>
                    </>
                  ) : (
                    <>
                      <Btn size="sm" onClick={async () => { try { await confirmResume(resumeDetail.resume_id); toast.success("已确认"); setResumeDetail(null); } catch { toast.error("确认失败"); } }}>确认并更新技能画像</Btn>
                      <Btn variant="secondary" size="sm" onClick={() => toast("功能开发中")}>重新解析</Btn>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 文件预览抽屉 */}
      {viewFile && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setViewFile(null)}>
          <div className="ml-auto w-[720px] h-full bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <div className="text-[14px] font-medium" style={{ color: T.ink }}>{viewFile.file_name}</div>
                <div className="text-[12px] mt-0.5" style={{ color: T.info }}>
                  {viewFile.file_size ? `${(viewFile.file_size / 1024).toFixed(0)} KB` : "—"} · {new Date(viewFile.uploaded_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-[12px] flex items-center gap-1" style={{ color: T.teal }}
                  onClick={() => window.open(fileUrl(viewFile.file_path), "_blank")}>
                  <Download size={13} />下载
                </button>
                <button onClick={() => setViewFile(null)} style={{ color: T.info }}><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1">
              {viewFile.file_name.endsWith(".pdf") ? (
                <iframe src={fileUrl(viewFile.file_path)} className="w-full h-full border-0" title={viewFile.file_name} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-[13px]" style={{ color: T.info }}>
                  <FileText size={48} style={{ color: T.cloud }} />
                  <div>DOCX 文件暂不支持在线预览</div>
                  <Btn variant="secondary" icon={Download} onClick={() => window.open(fileUrl(viewFile.file_path), "_blank")}>下载后查看</Btn>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>{title}</div>
      {children}
    </div>
  );
}
