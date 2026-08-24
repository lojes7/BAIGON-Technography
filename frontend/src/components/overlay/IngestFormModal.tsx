// 百工谱 — 模拟采集（注入数据）表单
// 支持两种方式：① 手动填写单条岗位；② 上传 Excel 批量解析（前端用 xlsx 解析）。
// 提交成功后展示成功态（trace_id 可复制 + 引导跳转），支持连续注入。
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { X, Upload, FileSpreadsheet, Trash2, CheckCircle, Copy, Check, AlertCircle, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import T from "../../constants/tokens";
import { ingestData } from "../../services/engineer";
import type { IngestJob } from "../../types/api";
import { Btn } from "../ui";

// 表单字段：key 对应 IngestJob 字段，labelKey 复用 rawRecords 的 i18n 文案
const INGEST_FIELDS: { key: keyof IngestJob; labelKey: string; required?: boolean; textarea?: boolean }[] = [
  { key: "job_name", labelKey: "jobName", required: true },
  { key: "company_name", labelKey: "companyName" },
  { key: "salary", labelKey: "jobSalary" },
  { key: "city", labelKey: "jobCity" },
  { key: "province", labelKey: "jobProvince" },
  { key: "experience", labelKey: "jobExp" },
  { key: "education", labelKey: "jobEdu" },
  { key: "major", labelKey: "jobMajor" },
  { key: "nature", labelKey: "jobNature" },
  { key: "tags", labelKey: "jobTags" },
  { key: "company_size", labelKey: "jobCompanySize" },
  { key: "source_platform", labelKey: "sourcePlatform" },
  { key: "source_url", labelKey: "jobSourceUrl" },
  { key: "publish_date", labelKey: "publishDate" },
  { key: "job_description", labelKey: "jobDesc", textarea: true },
];

// Excel 表头（中文）→ 字段 key 映射
const EXCEL_HEADER_MAP: Record<string, keyof IngestJob> = {
  岗位名称: "job_name",
  公司名称: "company_name",
  薪资: "salary",
  城市: "city",
  省份: "province",
  经验要求: "experience",
  学历要求: "education",
  专业: "major",
  工作性质: "nature",
  技能标签: "tags",
  公司规模: "company_size",
  来源平台: "source_platform",
  来源链接: "source_url",
  发布日期: "publish_date",
  职位描述: "job_description",
};

const EMPTY_FORM: IngestJob = { job_name: "" };

// 提交成功结果
interface SubmitOk {
  count: string;
  trace_id: string;
}

export default function IngestFormModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"manual" | "excel">("manual");
  const [form, setForm] = useState<IngestJob>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parsedJobs, setParsedJobs] = useState<IngestJob[]>([]);
  const [fileName, setFileName] = useState("");
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [excelError, setExcelError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<SubmitOk | null>(null);
  const [traceCopied, setTraceCopied] = useState(false);

  const setField = (key: keyof IngestJob, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 编辑时清除该字段的校验错误
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const label = (labelKey: string) => t(`page.rawRecords.${labelKey}`);

  // 校验单条岗位数据，返回错误映射（空对象表示通过）
  const validate = (job: IngestJob): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!job.job_name?.trim()) errs.job_name = "岗位名称为必填项";
    if (job.publish_date?.trim() && !/^\d{4}-\d{2}-\d{2}/.test(job.publish_date.trim())) {
      errs.publish_date = "日期格式应为 YYYY-MM-DD";
    }
    if (job.source_url?.trim() && !/^https?:\/\/.+/.test(job.source_url.trim())) {
      errs.source_url = "来源链接应为 http(s) 开头的有效地址";
    }
    return errs;
  };

  // 重置为初始表单态（连续注入时复用）
  const resetAll = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setParsedJobs([]);
    setFileName("");
    setUnknownHeaders([]);
    setExcelError("");
    setSubmitError("");
    setSuccess(null);
    setTab("manual");
  };

  // 解析 Excel → IngestJob[]
  const handleFile = (file: File) => {
    setFileName(file.name);
    setExcelError("");
    setUnknownHeaders([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        // 收集表头，标记未识别列
        const headers = new Set<string>();
        rows.forEach((row) => Object.keys(row).forEach((k) => headers.add(String(k).trim())));
        const unrecognized = [...headers].filter((h) => h && !EXCEL_HEADER_MAP[h]);
        setUnknownHeaders(unrecognized);

        const jobs = rows
          .map((row) => {
            const job: IngestJob = { job_name: "" };
            for (const [header, value] of Object.entries(row)) {
              const key = EXCEL_HEADER_MAP[String(header).trim()];
              if (key && value != null) {
                (job as unknown as Record<string, unknown>)[key] = String(value);
              }
            }
            return job;
          })
          .filter((j) => j.job_name && j.job_name.trim());
        if (jobs.length === 0) {
          setExcelError("未能解析出有效数据，请检查表头是否为：岗位名称、公司名称等");
          setParsedJobs([]);
        } else {
          setParsedJobs(jobs);
          toast.success(`已解析 ${jobs.length} 条岗位数据`);
        }
      } catch (err) {
        setExcelError("Excel 解析失败：" + (err as Error).message);
        setParsedJobs([]);
      }
    };
    reader.onerror = () => {
      setExcelError("文件读取失败");
      setParsedJobs([]);
    };
    reader.readAsArrayBuffer(file);
  };

  // 提交（成功后展示成功态，不关闭弹窗，支持连续注入）
  const doSubmit = async (jobs: IngestJob[]) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await ingestData(jobs);
      setSuccess({ count: res.data.count, trace_id: res.data.trace_id });
      // 清空输入，成功态下可「继续注入」
      setForm(EMPTY_FORM);
      setErrors({});
      setParsedJobs([]);
      setFileName("");
      setUnknownHeaders([]);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitManual = () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    doSubmit([form]);
  };

  const submitExcel = () => {
    if (parsedJobs.length === 0) {
      setExcelError("请先上传并解析 Excel");
      return;
    }
    doSubmit(parsedJobs);
  };

  const copyTrace = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.trace_id);
      setTraceCopied(true);
      setTimeout(() => setTraceCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  const goReview = () => {
    onClose();
    navigate("/raw-records");
  };

  const inputCls =
    "w-full px-3 py-2 rounded-md text-[13px] outline-none bg-white";
  const inputStyle: React.CSSProperties = { border: `1px solid ${T.border}`, color: T.ink };
  const errorInputStyle: React.CSSProperties = { border: `1px solid ${T.risk}`, color: T.ink };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-[720px] max-h-[90vh] flex flex-col shadow-2xl" style={{ border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>模拟采集（注入数据）</h3>
          <button onClick={onClose} style={{ color: T.info }}><X size={18} /></button>
        </div>

        {success ? (
          /* ── 成功态：注入结果 + trace_id 复制 + 引导 ── */
          <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col items-center justify-center gap-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${T.emerging}12` }}>
              <CheckCircle size={30} style={{ color: T.emerging }} />
            </div>
            <div className="text-center">
              <div className="text-[16px] font-medium mb-1" style={{ color: T.ink }}>
                注入成功，共 {success.count} 条数据
              </div>
              <div className="text-[13px]" style={{ color: T.info }}>
                已走完整落库、清洗、Kafka 流程，可在「数据复核」中查看
              </div>
            </div>
            {/* trace_id 复制 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: T.cloud, border: `1px solid ${T.border}` }}>
              <span className="text-[12px] font-mono" style={{ color: T.info }}>trace_id:</span>
              <span className="text-[12px] font-mono" style={{ color: T.ink }}>{success.trace_id}</span>
              <button onClick={copyTrace} className="flex items-center gap-1 text-[12px]" style={{ color: T.teal }}>
                {traceCopied ? <Check size={13} /> : <Copy size={13} />}
                {traceCopied ? "已复制" : "复制"}
              </button>
            </div>
            {/* 操作按钮 */}
            <div className="flex items-center gap-2 mt-1">
              <Btn icon={ArrowRight} onClick={resetAll}>继续注入</Btn>
              <Btn variant="secondary" onClick={goReview}>前往数据复核</Btn>
              <Btn variant="ghost" onClick={onClose}>关闭</Btn>
            </div>
          </div>
        ) : (
          <>
            {/* Tab 切换 */}
            <div className="flex gap-2 px-5 pt-4 flex-shrink-0">
              {([
                { key: "manual", label: "手动填写" },
                { key: "excel", label: "Excel 导入" },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors"
                  style={{
                    border: `1px solid ${tab === item.key ? T.teal : T.border}`,
                    color: tab === item.key ? "white" : T.ink,
                    background: tab === item.key ? T.teal : "white",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "manual" ? (
                <div className="grid grid-cols-2 gap-3">
                  {INGEST_FIELDS.map((f) => (
                    <div key={f.key} className={f.textarea ? "col-span-2" : ""}>
                      <label className="text-[12px] font-medium block mb-1.5" style={{ color: T.ink }}>
                        {label(f.labelKey)}{f.required && <span style={{ color: T.risk }}> *</span>}
                      </label>
                      {f.textarea ? (
                        <textarea
                          className={inputCls}
                          style={{ ...(errors[f.key] ? errorInputStyle : inputStyle), height: 80, resize: "none" }}
                          value={String(form[f.key] ?? "")}
                          onChange={(e) => setField(f.key, e.target.value)}
                        />
                      ) : (
                        <input
                          className={inputCls}
                          style={errors[f.key] ? errorInputStyle : inputStyle}
                          value={String(form[f.key] ?? "")}
                          onChange={(e) => setField(f.key, e.target.value)}
                        />
                      )}
                      {errors[f.key] && (
                        <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: T.risk }}>
                          <AlertCircle size={12} />{errors[f.key]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 上传区 */}
                  <div
                    className="rounded-lg p-6 text-center cursor-pointer transition-colors"
                    style={{ border: `1px dashed ${T.teal}50`, background: `${T.teal}06` }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSpreadsheet size={28} className="mx-auto mb-2" style={{ color: T.teal }} />
                    <div className="text-[13px] font-medium" style={{ color: T.ink }}>
                      {fileName || "点击上传 Excel（.xlsx / .csv）"}
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: T.info }}>
                      表头需包含：岗位名称、公司名称、薪资、城市、省份、学历要求、经验要求等
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                  </div>

                  {/* 解析错误态 */}
                  {excelError && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                      style={{ background: `${T.risk}10`, color: T.risk, border: `1px solid ${T.risk}30` }}>
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{excelError}</span>
                    </div>
                  )}

                  {/* 未识别表头提示 */}
                  {unknownHeaders.length > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                      style={{ background: `${T.pending}10`, color: T.pending, border: `1px solid ${T.pending}30` }}>
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>以下表头未被识别，已忽略：{unknownHeaders.join("、")}</span>
                    </div>
                  )}

                  {/* 解析预览 */}
                  {parsedJobs.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium" style={{ color: T.ink }}>
                          已解析 {parsedJobs.length} 条
                        </span>
                        <button className="flex items-center gap-1 text-[12px]" style={{ color: T.risk }} onClick={() => { setParsedJobs([]); setFileName(""); setUnknownHeaders([]); setExcelError(""); }}>
                          <Trash2 size={13} />清空
                        </button>
                      </div>
                      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr style={{ background: T.cloud }}>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: T.info }}>岗位名称</th>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: T.info }}>公司名称</th>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: T.info }}>城市</th>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: T.info }}>薪资</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedJobs.slice(0, 20).map((j, i) => (
                              <tr key={i} style={{ borderTop: `1px solid ${T.cloud}` }}>
                                <td className="px-3 py-2" style={{ color: T.ink }}>{j.job_name}</td>
                                <td className="px-3 py-2" style={{ color: T.ink }}>{j.company_name || "—"}</td>
                                <td className="px-3 py-2" style={{ color: T.ink }}>{j.city || "—"}</td>
                                <td className="px-3 py-2" style={{ color: T.ink }}>{j.salary || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {parsedJobs.length > 20 && (
                          <div className="px-3 py-2 text-[12px]" style={{ color: T.info, borderTop: `1px solid ${T.cloud}` }}>
                            仅预览前 20 条，共 {parsedJobs.length} 条
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="flex-shrink-0 px-5 py-4 space-y-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
              {submitError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                  style={{ background: `${T.risk}10`, color: T.risk, border: `1px solid ${T.risk}30` }}>
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" onClick={onClose}>取消</Btn>
                <Btn icon={Upload} onClick={tab === "manual" ? submitManual : submitExcel} disabled={submitting}>
                  {submitting ? "提交中…" : "提交注入"}
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
