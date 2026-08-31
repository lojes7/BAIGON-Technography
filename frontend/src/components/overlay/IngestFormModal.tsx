import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowRight, Check, CheckCircle, Copy,
  Download, FileText, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  CSV_TEMPLATE_FILENAME, CSV_TEMPLATE_URL,
  decodeUtf8Csv, parseIngestCsv, validateCsvFileMetadata,
} from "../../features/ingest/csv";
import { ingestData } from "../../services/engineer";
import type { IngestJob } from "../../types/api";

/* 深蓝主色系（确认后与工作台一起沉淀到 tokens.ts） */
const P = {
  primary: "#1E4C8F",
  primaryDeep: "#12305E",
  sky: "#A9C8EC",
  skySoft: "#DCE8F6",
  ink: "#16283E",
  muted: "#5E6E82",
  faint: "#8B99AB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  redBg: "#FBEAE7",
  border: "#E4EAF2",
} as const;

interface SubmitOk {
  count: number;
  trace_id: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

const STEPS = ["选择文件", "校验预览", "提交入库"];

export default function IngestFormModal() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedJobs, setParsedJobs] = useState<IngestJob[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [ignoredHeaders, setIgnoredHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<SubmitOk | null>(null);
  const [traceCopied, setTraceCopied] = useState(false);

  const step = success ? 3 : parsedJobs.length > 0 ? 2 : 1;

  const clearFile = () => {
    setParsedJobs([]);
    setFileName("");
    setFileSize(0);
    setIgnoredHeaders([]);
    setParseError("");
    setSubmitError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetAll = () => {
    clearFile();
    setSuccess(null);
    setTraceCopied(false);
  };

  const handleFile = async (file: File) => {
    setParsedJobs([]);
    setIgnoredHeaders([]);
    setSubmitError("");
    setParseError("");
    setFileName(file.name);
    setFileSize(file.size);

    try {
      validateCsvFileMetadata(file);
      const parsed = parseIngestCsv(decodeUtf8Csv(await file.arrayBuffer()));
      setParsedJobs(parsed.jobs);
      setIgnoredHeaders(parsed.ignoredHeaders);
      toast.success(`已解析 ${parsed.jobs.length} 条岗位数据`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "CSV 解析失败");
    }
  };

  const submitCsv = async () => {
    if (parsedJobs.length === 0) {
      setParseError("请先选择并成功解析 CSV 文件");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const submittedCount = parsedJobs.length;
      const response = await ingestData(parsedJobs);
      setSuccess({
        count: submittedCount,
        trace_id: response.data.trace_id,
      });
      clearFile();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "注入请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  const copyTrace = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.trace_id);
      setTraceCopied(true);
      window.setTimeout(() => setTraceCopied(false), 1500);
    } catch {
      toast.error("浏览器无法访问剪贴板，请手动复制 trace_id");
    }
  };

  const goReview = () => {
    navigate("/raw-records");
  };

  return (
    <div className="bg-white rounded-2xl flex flex-col flex-1" style={{ border: `1px solid ${P.border}` }}>
      {/* 卡片头：标题 + 操作 */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 flex-wrap gap-3"
        style={{ borderBottom: `1px solid ${P.border}` }}>
        <div>
          <div className="text-[15px] font-semibold" style={{ color: P.ink }}>注入岗位数据</div>
          <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>解析 CSV 后提交至采集与清洗链路</div>
        </div>
        {!success && (
          <div className="flex items-center gap-2">
            <a href={CSV_TEMPLATE_URL} download={CSV_TEMPLATE_FILENAME}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium bg-white hover:bg-gray-50 transition-colors"
              style={{ color: P.muted, border: `1px solid ${P.border}` }}>
              <Download size={14} /> 下载模板
            </a>
            <button type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed"
              style={{ background: P.primary, boxShadow: "0 8px 16px -6px rgba(30,76,143,0.45)", opacity: submitting || parsedJobs.length === 0 ? 0.45 : 1 }}
              onClick={submitCsv}
              disabled={submitting || parsedJobs.length === 0}>
              <Upload size={14} /> {submitting ? "提交中…" : "提交注入"}
            </button>
          </div>
        )}
      </div>

      {/* 步骤条 */}
      <div className="flex items-center px-5 pt-4 gap-0">
        {STEPS.map((label, i) => {
          const no = i + 1;
          const done = step > no;
          const active = step === no;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                  style={done
                    ? { background: P.greenBg, color: P.green }
                    : active
                      ? { background: P.primary, color: "#fff", boxShadow: "0 4px 10px -2px rgba(30,76,143,0.4)" }
                      : { background: P.skySoft, color: P.faint }}>
                  {done ? <Check size={12} /> : no}
                </span>
                <span className="text-[12px] font-medium whitespace-nowrap"
                  style={{ color: active ? P.ink : done ? P.green : P.faint }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="flex-1 h-px mx-3" style={{ background: step > no ? P.green : P.skySoft }} />
              )}
            </div>
          );
        })}
      </div>

      {success ? (
        /* ===== 步骤三：提交成功 ===== */
        <div className="px-5 py-10 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: P.greenBg }}>
            <CheckCircle size={30} style={{ color: P.green }} />
          </div>
          <div className="text-center">
            <div className="text-[16px] font-semibold mb-1" style={{ color: P.ink }}>
              注入任务已启动，共 {success.count} 条待处理数据
            </div>
            <div className="text-[13px]" style={{ color: P.muted }}>
              后台正在执行落库、清洗和 Kafka 流程，可在下方批次记录中查看进度
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full max-w-full"
            style={{ background: P.skySoft, border: `1px solid ${P.border}` }}>
            <span className="text-[12px] font-mono flex-shrink-0" style={{ color: P.faint }}>trace_id:</span>
            <span className="text-[12px] font-mono truncate" style={{ color: P.ink }}>{success.trace_id}</span>
            <button type="button" onClick={copyTrace} className="flex items-center gap-1 text-[12px] flex-shrink-0" style={{ color: P.primary }}>
              {traceCopied ? <Check size={13} /> : <Copy size={13} />}
              {traceCopied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium text-white"
              style={{ background: P.primary, boxShadow: "0 8px 16px -6px rgba(30,76,143,0.45)" }}
              onClick={resetAll}>
              <ArrowRight size={14} /> 继续注入
            </button>
            <button type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium bg-white hover:bg-gray-50"
              style={{ color: P.muted, border: `1px solid ${P.border}` }}
              onClick={goReview}>
              前往数据复核
            </button>
          </div>
        </div>
      ) : (
        /* ===== 步骤一 / 二 ===== */
        <div className="px-5 py-4 space-y-4 flex-1 flex flex-col min-h-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void handleFile(file);
            }}
          />

          {fileName ? (
            /* 文件信息卡 */
            <div className="rounded-xl px-4 py-3.5 flex items-center gap-4" style={{ border: `1px solid ${P.border}`, background: P.skySoft }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: P.primary }}>
                <FileText size={19} color="#fff" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate" style={{ color: P.ink }}>{fileName}</div>
                <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>
                  {formatFileSize(fileSize)}{parsedJobs.length > 0 ? ` · ${parsedJobs.length} 条有效数据` : ""}
                </div>
              </div>
              <button type="button" className="flex items-center gap-1 text-[13px] flex-shrink-0" style={{ color: P.red }} onClick={clearFile}>
                <Trash2 size={13} /> 移除
              </button>
              <button type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-white flex-shrink-0"
                style={{ color: P.muted, border: `1px solid ${P.border}` }}
                onClick={() => fileInputRef.current?.click()}>
                重新选择
              </button>
            </div>
          ) : (
            /* 步骤一：上传拖放区 */
            <button
              type="button"
              className="w-full flex-1 min-h-[240px] rounded-xl py-10 text-center transition-colors flex flex-col items-center justify-center"
              style={{ border: `1.5px dashed ${P.sky}`, background: P.skySoft }}
              onClick={() => fileInputRef.current?.click()}>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: "#fff" }}>
                <Upload size={22} style={{ color: P.primary }} />
              </div>
              <div className="text-[15px] font-medium" style={{ color: P.ink }}>点击选择 CSV 文件</div>
              <div className="text-[12px] mt-1" style={{ color: P.faint }}>文件不会直接上传，浏览器解析成功后才会提交结构化数据</div>
            </button>
          )}

          {parseError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: P.redBg, color: P.red }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {ignoredHeaders.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: P.amberBg, color: P.amber }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>以下额外列不会提交：{ignoredHeaders.join("、")}</span>
            </div>
          )}

          {parsedJobs.length > 0 && (
            /* 步骤二：数据预览 */
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] font-medium" style={{ color: P.ink }}>数据预览</span>
                <span className="text-[12px] flex items-center gap-1.5" style={{ color: P.green }}>
                  <CheckCircle size={13} /> 已通过前端校验
                </span>
              </div>
              <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${P.border}` }}>
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr style={{ background: P.skySoft }}>
                      {["职位", "公司", "城市", "薪资", "发布日期"].map((header) => (
                        <th key={header} className="px-3 py-2 text-left font-medium text-[12px]" style={{ color: P.muted }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedJobs.slice(0, 20).map((job, index) => (
                      <tr key={`${job.job_name}-${index}`} style={{ borderTop: `1px solid ${P.border}` }}>
                        <td className="px-3 py-2 font-medium" style={{ color: P.ink }}>{job.job_name}</td>
                        <td className="px-3 py-2" style={{ color: P.muted }}>{job.company_name || "—"}</td>
                        <td className="px-3 py-2" style={{ color: P.muted }}>{job.city || "—"}</td>
                        <td className="px-3 py-2" style={{ color: P.muted }}>{job.salary || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px]" style={{ color: P.muted }}>{job.publish_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedJobs.length > 20 && (
                  <div className="px-3 py-2 text-[12px]" style={{ color: P.faint, borderTop: `1px solid ${P.border}` }}>
                    仅预览前 20 条，共 {parsedJobs.length} 条
                  </div>
                )}
              </div>
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: P.redBg, color: P.red }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
