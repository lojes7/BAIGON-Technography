import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import T from "../constants/tokens";
import { getMyResume, createResumeUploadUrl, completeResumeUpload, editMyResume } from "../services/resume";
import type {
  ResumeData, ResumeFields, ResumeProficiency,
  EducationExperience, WorkExperience, ProjectExperience, ProfessionalSkill, ResumeAward,
} from "../types/api";
import { PageHeader, Btn, Card } from "../components/ui";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MiB
const ACCEPT = [".pdf", ".docx"];
const PROFICIENCIES: ResumeProficiency[] = ["", "Basic", "Familiar", "Advanced", "Expert"];
const PROFICIENCY_LABEL: Record<string, string> = {
  "": "未注明", Basic: "基础", Familiar: "熟悉", Advanced: "熟练", Expert: "精通",
};

// ── 空条目工厂 ──
const emptyEdu = (): EducationExperience => ({ major: "", university_name: "", start_date: "", end_date: "", description: "" });
const emptyWork = (): WorkExperience => ({ occupation_name: "", company: "", start_date: "", end_date: "", description: "" });
const emptyProj = (): ProjectExperience => ({ project_name: "", start_date: "", end_date: "", description: "" });
const emptySkill = (): ProfessionalSkill => ({ skill_name: "", proficiency: "" });
const emptyAward = (): ResumeAward => ({ award_name: "", date: "", description: "" });

function cloneFields(f: ResumeFields): ResumeFields {
  return {
    education_experience: f.education_experience.map(e => ({ ...e })),
    work_experience: f.work_experience.map(e => ({ ...e })),
    project_experience: f.project_experience.map(e => ({ ...e })),
    professional_skills: f.professional_skills.map(e => ({ ...e })),
    awards: f.awards.map(e => ({ ...e })),
  };
}

// 无简历时手动编辑的初始空字段
function emptyFields(): ResumeFields {
  return {
    education_experience: [],
    work_experience: [],
    project_experience: [],
    professional_skills: [],
    awards: [],
  };
}

// 首尾空格 trim，避免后端 requireString 的 strip 校验拒绝
const trimStr = (s: string) => (s ?? "").trim();

// 清洗编辑表单：trim + 过滤「身份字段全空」的空条目 + 校验日期范围。
// 规则严格对齐后端 ResumeAnalysisValidator.parseEdited（空记录/首尾空格/日期顺序均为 400）。
function sanitizeFields(f: ResumeFields): { fields: ResumeFields; error?: string } {
  const education = f.education_experience
    .map(e => ({ ...e, major: trimStr(e.major), university_name: trimStr(e.university_name), start_date: trimStr(e.start_date), end_date: trimStr(e.end_date), description: trimStr(e.description) }))
    .filter(e => e.major || e.university_name);

  const work = f.work_experience
    .map(w => ({ ...w, occupation_name: trimStr(w.occupation_name), company: trimStr(w.company), start_date: trimStr(w.start_date), end_date: trimStr(w.end_date), description: trimStr(w.description) }))
    .filter(w => w.occupation_name || w.company);

  const project = f.project_experience
    .map(p => ({ ...p, project_name: trimStr(p.project_name), start_date: trimStr(p.start_date), end_date: trimStr(p.end_date), description: trimStr(p.description) }))
    .filter(p => p.project_name);

  const skills = f.professional_skills
    .map(s => ({ ...s, skill_name: trimStr(s.skill_name), proficiency: s.proficiency }))
    .filter(s => s.skill_name);

  const awards = f.awards
    .map(a => ({ ...a, award_name: trimStr(a.award_name), date: trimStr(a.date), description: trimStr(a.description) }))
    .filter(a => a.award_name);

  // 日期范围校验：start_date 不得晚于 end_date（education / work / project 均有起止日期）
  for (const item of [...education, ...work, ...project]) {
    if (item.start_date && item.end_date && item.start_date > item.end_date) {
      return { fields: f, error: "开始日期不能晚于结束日期" };
    }
  }

  return {
    fields: {
      education_experience: education,
      work_experience: work,
      project_experience: project,
      professional_skills: skills,
      awards,
    },
  };
}

export default function MyResume() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewContent, setViewContent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ResumeFields | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchResume = () => {
    setLoading(true);
    getMyResume()
      .then((res) => setResume(res.data?.id ? res.data : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchResume(); }, []);

  const isAccepted = (name: string) => ACCEPT.some((ext) => name.toLowerCase().endsWith(ext));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAccepted(file.name)) { toast.error("仅支持 PDF / DOCX 格式"); resetInput(); return; }
    if (file.size > MAX_SIZE) { toast.error("文件超过 10 MiB 大小限制"); resetInput(); return; }

    setUploading(true);
    try {
      const urlRes = await createResumeUploadUrl({ fileName: file.name, fileSize: file.size });
      //const { uploadId, uploadUrl, method, contentType } = urlRes.data;
      //await fetch(uploadUrl, { method: method || "PUT", headers: contentType ? { "Content-Type": contentType } : {}, body: file });
      const { uploadId, uploadUrl, method } = urlRes.data;
      const body = await file.arrayBuffer();
      //await fetch(uploadUrl, { method: method || "PUT", body });
      await fetch(uploadUrl, {
        method: method || "PUT",
        body
      });
      await completeResumeUpload({ uploadId, fileName: file.name });
      toast.success("上传成功，结构化分析已完成");
      fetchResume();
    } catch (err) {
      toast.error((err as Error).message || "上传失败");
    } finally {
      setUploading(false);
      resetInput();
    }
  };

  const resetInput = () => { if (fileRef.current) fileRef.current.value = ""; };

  const openEdit = () => {
    // 已有简历则基于现有字段编辑；无简历则从空表单开始新建（后端 editMyResume 支持无文件记录）
    setEditForm(resume ? cloneFields(resume.fields) : emptyFields());
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    const { fields, error } = sanitizeFields(editForm);
    if (error) { toast.error(error); return; }
    setSaving(true);
    try {
      const res = await editMyResume({ content: resume?.content ?? undefined, fields });
      setResume(res.data);
      setEditing(false);
      setEditForm(null);
      toast.success("简历已更新");
    } catch (err) {
      toast.error((err as Error).message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const fmtSize = (n: number | null) => (n == null ? "—" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`);
  const fmtTime = (s: string) => (s ? new Date(s).toLocaleString() : "—");
  const isEdited = resume?.source === "EDITED";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personalCenter"), t("nav.myResume")]}
        title={t("page.myResume.title")}
        description="上传简历文件（PDF / DOCX），系统直传 MinIO 并自动完成结构化分析"
      />

      <Card title={t("page.myResume.uploadArea")}>
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <input type="file" accept={ACCEPT.join(",")} ref={fileRef} onChange={handleUpload} style={{ display: "none" }} />
          <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-12 w-full cursor-pointer transition-colors"
            style={{ borderColor: T.border, background: T.cloud }}
            onClick={() => fileRef.current?.click()}>
            <Upload size={32} style={{ color: T.info, marginBottom: 12 }} />
            <div className="text-[14px] font-medium" style={{ color: T.ink }}>
              {uploading ? "正在上传并分析…" : t("page.myResume.dropHint")}
            </div>
            <div className="text-[12px] mt-1" style={{ color: T.info }}>
              {t("page.myResume.clickHint")} · 最大 10 MiB
            </div>
          </div>
          <Btn icon={Upload} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "上传中…" : t("page.myResume.selectFile")}
          </Btn>
        </div>
      </Card>

      <Card
        title={t("page.myResume.title")}
        action={!editing ? <Btn icon={Pencil} size="sm" variant="secondary" onClick={openEdit}>{t("common.edit")}</Btn> : undefined}
      >
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : !resume ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>
            暂无简历，可点击右上角「编辑」手动填写，或上传文件自动解析
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {/* 文件信息 + 来源 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.cloud }}>
                <FileText size={20} style={{ color: T.teal }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate" style={{ color: T.ink }}>
                  {resume.fileName ?? "手动编辑记录（未绑定文件）"}
                </div>
                <div className="text-[12px] mt-0.5 font-mono" style={{ color: T.info }}>
                  {resume.fileName ? `${fmtSize(resume.fileSize)} · ` : ""}{fmtTime(resume.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ color: isEdited ? T.stable : T.emerging, background: isEdited ? "#EBF2FA" : "#E6F5F1" }}>
                  {isEdited ? t("page.myResume.sourceEdited") : t("page.myResume.sourceSystem")}
                </span>
                {resume.content && (
                  <button className="text-[12px] flex items-center gap-1" style={{ color: T.teal }}
                    onClick={() => setViewContent(v => !v)}>
                    <Eye size={13} />{viewContent ? "收起原文" : "查看原文"}
                  </button>
                )}
              </div>
            </div>

            {viewContent && resume.content && (
              <div className="rounded-lg p-4 text-[13px] leading-relaxed whitespace-pre-wrap max-h-[480px] overflow-y-auto"
                style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}>
                {resume.content}
              </div>
            )}

            {/* 结构化字段展示 */}
            <ResumeSections fields={resume.fields} />
          </div>
        )}
      </Card>

      {/* 编辑抽屉 */}
      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => { setEditing(false); setEditForm(null); }}>
          <div className="ml-auto w-[640px] h-full bg-white shadow-xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>{t("page.myResume.editTitle")}</h3>
              <button onClick={() => { setEditing(false); setEditForm(null); }} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* 教育经历 */}
              <EditSection title="教育经历" onAdd={() => setEditForm(f => ({ ...f!, education_experience: [...f!.education_experience, emptyEdu()] }))}>
                {editForm.education_experience.map((item, i) => (
                  <EditRow key={i} onRemove={() => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.filter((_, j) => j !== i) }))}>
                    <TextInput label="专业" value={item.major} onChange={v => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.map((x, j) => j === i ? { ...x, major: v } : x) }))} />
                    <TextInput label="学校" value={item.university_name} onChange={v => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.map((x, j) => j === i ? { ...x, university_name: v } : x) }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <DateInput label="开始日期" value={item.start_date} onChange={v => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.map((x, j) => j === i ? { ...x, start_date: v } : x) }))} />
                      <DateInput label="结束日期" value={item.end_date} onChange={v => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.map((x, j) => j === i ? { ...x, end_date: v } : x) }))} />
                    </div>
                    <TextArea label="描述" value={item.description} onChange={v => setEditForm(f => ({ ...f!, education_experience: f!.education_experience.map((x, j) => j === i ? { ...x, description: v } : x) }))} />
                  </EditRow>
                ))}
              </EditSection>

              {/* 工作经历 */}
              <EditSection title="工作经历" onAdd={() => setEditForm(f => ({ ...f!, work_experience: [...f!.work_experience, emptyWork()] }))}>
                {editForm.work_experience.map((item, i) => (
                  <EditRow key={i} onRemove={() => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.filter((_, j) => j !== i) }))}>
                    <TextInput label="职位" value={item.occupation_name} onChange={v => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.map((x, j) => j === i ? { ...x, occupation_name: v } : x) }))} />
                    <TextInput label="公司" value={item.company} onChange={v => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.map((x, j) => j === i ? { ...x, company: v } : x) }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <DateInput label="开始日期" value={item.start_date} onChange={v => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.map((x, j) => j === i ? { ...x, start_date: v } : x) }))} />
                      <DateInput label="结束日期" value={item.end_date} onChange={v => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.map((x, j) => j === i ? { ...x, end_date: v } : x) }))} />
                    </div>
                    <TextArea label="描述" value={item.description} onChange={v => setEditForm(f => ({ ...f!, work_experience: f!.work_experience.map((x, j) => j === i ? { ...x, description: v } : x) }))} />
                  </EditRow>
                ))}
              </EditSection>

              {/* 项目经历 */}
              <EditSection title="项目经历" onAdd={() => setEditForm(f => ({ ...f!, project_experience: [...f!.project_experience, emptyProj()] }))}>
                {editForm.project_experience.map((item, i) => (
                  <EditRow key={i} onRemove={() => setEditForm(f => ({ ...f!, project_experience: f!.project_experience.filter((_, j) => j !== i) }))}>
                    <TextInput label="项目名称" value={item.project_name} onChange={v => setEditForm(f => ({ ...f!, project_experience: f!.project_experience.map((x, j) => j === i ? { ...x, project_name: v } : x) }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <DateInput label="开始日期" value={item.start_date} onChange={v => setEditForm(f => ({ ...f!, project_experience: f!.project_experience.map((x, j) => j === i ? { ...x, start_date: v } : x) }))} />
                      <DateInput label="结束日期" value={item.end_date} onChange={v => setEditForm(f => ({ ...f!, project_experience: f!.project_experience.map((x, j) => j === i ? { ...x, end_date: v } : x) }))} />
                    </div>
                    <TextArea label="描述" value={item.description} onChange={v => setEditForm(f => ({ ...f!, project_experience: f!.project_experience.map((x, j) => j === i ? { ...x, description: v } : x) }))} />
                  </EditRow>
                ))}
              </EditSection>

              {/* 专业技能 */}
              <EditSection title="专业技能" onAdd={() => setEditForm(f => ({ ...f!, professional_skills: [...f!.professional_skills, emptySkill()] }))}>
                {editForm.professional_skills.map((item, i) => (
                  <EditRow key={i} onRemove={() => setEditForm(f => ({ ...f!, professional_skills: f!.professional_skills.filter((_, j) => j !== i) }))}>
                    <TextInput label="技能名称" value={item.skill_name} onChange={v => setEditForm(f => ({ ...f!, professional_skills: f!.professional_skills.map((x, j) => j === i ? { ...x, skill_name: v } : x) }))} />
                    <ProficiencySelect value={item.proficiency} onChange={v => setEditForm(f => ({ ...f!, professional_skills: f!.professional_skills.map((x, j) => j === i ? { ...x, proficiency: v } : x) }))} />
                  </EditRow>
                ))}
              </EditSection>

              {/* 获奖 */}
              <EditSection title="获奖" onAdd={() => setEditForm(f => ({ ...f!, awards: [...f!.awards, emptyAward()] }))}>
                {editForm.awards.map((item, i) => (
                  <EditRow key={i} onRemove={() => setEditForm(f => ({ ...f!, awards: f!.awards.filter((_, j) => j !== i) }))}>
                    <TextInput label="奖项名称" value={item.award_name} onChange={v => setEditForm(f => ({ ...f!, awards: f!.awards.map((x, j) => j === i ? { ...x, award_name: v } : x) }))} />
                    <DateInput label="获奖日期" value={item.date} onChange={v => setEditForm(f => ({ ...f!, awards: f!.awards.map((x, j) => j === i ? { ...x, date: v } : x) }))} />
                    <TextArea label="描述" value={item.description} onChange={v => setEditForm(f => ({ ...f!, awards: f!.awards.map((x, j) => j === i ? { ...x, description: v } : x) }))} />
                  </EditRow>
                ))}
              </EditSection>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" onClick={() => { setEditing(false); setEditForm(null); }}>{t("common.cancel")}</Btn>
              <Btn onClick={saveEdit} disabled={saving}>{saving ? "保存中…" : t("common.save")}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 只读展示：五类结构化字段 ──
function ResumeSections({ fields }: { fields: ResumeFields }) {
  const has = (arr: unknown[]) => arr.length > 0;
  return (
    <div className="space-y-5">
      {has(fields.education_experience) && (
        <Section title="教育经历">
          {fields.education_experience.map((e, i) => (
            <KV key={i}
              title={e.university_name}
              sub={e.major}
              date={dateRange(e.start_date, e.end_date)}
              desc={e.description} />
          ))}
        </Section>
      )}
      {has(fields.work_experience) && (
        <Section title="工作经历">
          {fields.work_experience.map((w, i) => (
            <KV key={i}
              title={w.occupation_name}
              sub={w.company}
              date={dateRange(w.start_date, w.end_date)}
              desc={w.description} />
          ))}
        </Section>
      )}
      {has(fields.project_experience) && (
        <Section title="项目经历">
          {fields.project_experience.map((p, i) => (
            <KV key={i} title={p.project_name} date={dateRange(p.start_date, p.end_date)} desc={p.description} />
          ))}
        </Section>
      )}
      {has(fields.professional_skills) && (
        <Section title="专业技能">
          <div className="flex flex-wrap gap-2">
            {fields.professional_skills.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md"
                style={{ background: T.cloud, color: T.ink }}>
                {s.skill_name}
                {s.proficiency && (
                  <span className="text-[11px]" style={{ color: T.teal }}>{PROFICIENCY_LABEL[s.proficiency] ?? s.proficiency}</span>
                )}
              </span>
            ))}
          </div>
        </Section>
      )}
      {has(fields.awards) && (
        <Section title="获奖">
          {fields.awards.map((a, i) => (
            <KV key={i} title={a.award_name} date={a.date} desc={a.description} />
          ))}
        </Section>
      )}
      {!has(fields.education_experience) && !has(fields.work_experience) && !has(fields.project_experience) && !has(fields.professional_skills) && !has(fields.awards) && (
        <div className="text-center py-8 text-[13px]" style={{ color: T.info }}>暂无结构化字段</div>
      )}
    </div>
  );
}

function dateRange(start: string, end: string) {
  if (!start && !end) return "";
  return `${start || "—"} ~ ${end || "—"}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ title, sub, date, desc }: { title: string; sub?: string; date?: string; desc?: string }) {
  return (
    <div className="p-3 rounded-md text-[13px] mb-2" style={{ background: T.cloud }}>
      <div className="flex items-center gap-2">
        <span className="font-medium" style={{ color: T.ink }}>{title || "—"}</span>
        {sub && <span style={{ color: T.info }}>· {sub}</span>}
        {date && <span className="ml-auto font-mono text-[11px]" style={{ color: T.info }}>{date}</span>}
      </div>
      {desc && <div className="mt-1 text-[12px]" style={{ color: T.info }}>{desc}</div>}
    </div>
  );
}

// ── 编辑表单小组件 ──
function EditSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium" style={{ color: T.info }}>{title}</span>
        <button className="text-[12px] flex items-center gap-1" style={{ color: T.teal }} onClick={onAdd}>
          <Plus size={12} />新增
        </button>
      </div>
      {children}
    </div>
  );
}

function EditRow({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="relative rounded-lg p-3 mb-2 space-y-2" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
      <button className="absolute top-2 right-2" style={{ color: T.risk }} onClick={onRemove} title="删除">
        <Trash2 size={14} />
      </button>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] block mb-1" style={{ color: T.info }}>{label}</label>
      <input className="w-full px-2 py-1.5 rounded text-[13px] outline-none"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] block mb-1" style={{ color: T.info }}>{label}</label>
      <input type="date" className="w-full px-2 py-1.5 rounded text-[13px] outline-none"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] block mb-1" style={{ color: T.info }}>{label}</label>
      <textarea className="w-full px-2 py-1.5 rounded text-[13px] outline-none resize-none" rows={2}
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ProficiencySelect({ value, onChange }: { value: ResumeProficiency; onChange: (v: ResumeProficiency) => void }) {
  return (
    <div>
      <label className="text-[11px] block mb-1" style={{ color: T.info }}>熟练度</label>
      <select className="w-full px-2 py-1.5 rounded text-[13px] outline-none"
        style={{ background: "white", border: `1px solid ${T.border}`, color: T.ink }}
        value={value} onChange={e => onChange(e.target.value as ResumeProficiency)}>
        {PROFICIENCIES.map(p => (
          <option key={p} value={p}>{PROFICIENCY_LABEL[p] ?? p}</option>
        ))}
      </select>
    </div>
  );
}
