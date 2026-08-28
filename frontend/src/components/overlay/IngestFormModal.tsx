import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  Download,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  CSV_TEMPLATE_FILENAME,
  CSV_TEMPLATE_URL,
  INGEST_CSV_COLUMNS,
  decodeUtf8Csv,
  parseIngestCsv,
  validateCsvFileMetadata,
} from "../../features/ingest/csv";
import { ingestData } from "../../services/engineer";
import type { IngestJob } from "../../types/api";

const N = {
  primary: "#2563EB",      // 品牌主色
  primarySoft: "#EFF6FF",  // 主色浅底
  neutral900: "#111827",   // 一级标题
  neutral600: "#4B5563",   // 正文
  neutral400: "#9CA3AF",   // 辅助信息
  surface: "#FFFFFF",      // 卡片表面
  border: "#E5E7EB",       // 分割线/边框
  success: "#10B981",      // 成功
  warning: "#F59E0B",      // 警告/待审核
  error: "#EF4444",        // 错误/驳回
};

const CARD_SHADOW = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
const BTN_PRIMARY_SHADOW = "0 4px 6px -1px rgba(37,99,235,0.3)";

interface SubmitOk {
  count: number;
  trace_id: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

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
    <div className="rounded-xl bg-white" style={{ border: `1px solid ${N.border}`, boxShadow: CARD_SHADOW }}>
      <div
        className="flex items-center justify-between px-8 py-5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${N.border}` }}
      >
        <div>
          <h3 className="text-[16px] font-semibold leading-6" style={{ color: N.neutral900 }}>注入数据</h3>
          <p className="text-[14px] leading-[22px] mt-0.5" style={{ color: N.neutral600 }}>解析 CSV 后提交至完整采集与清洗链路</p>
        </div>
        {!success && (
          <div className="flex items-center gap-2">
            <a
              href={CSV_TEMPLATE_URL}
              download={CSV_TEMPLATE_FILENAME}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium bg-white hover:bg-gray-50"
              style={{ color: N.neutral600, border: `1px solid ${N.border}` }}
            >
              <Download size={14} />
              下载模板
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium bg-white hover:bg-gray-50"
              style={{ color: N.neutral600, border: `1px solid ${N.border}` }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={14} />
              选择文件
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-medium text-white"
              style={{ background: N.primary, boxShadow: BTN_PRIMARY_SHADOW }}
              onClick={submitCsv}
              disabled={submitting || parsedJobs.length === 0}
            >
              <Upload size={15} />
              {submitting ? "提交中…" : "提交注入"}
            </button>
          </div>
        )}
      </div>

      {success ? (
        <div className="px-8 py-10 flex flex-col items-center justify-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#ECFDF5" }}>
            <CheckCircle size={30} style={{ color: N.success }} />
          </div>
          <div className="text-center">
            <div className="text-[16px] font-semibold mb-1" style={{ color: N.neutral900 }}>
              注入任务已启动，共 {success.count} 条待处理数据
            </div>
            <div className="text-[14px]" style={{ color: N.neutral600 }}>
              后台正在执行落库、清洗和 Kafka 流程，可通过采集状态查看进度
            </div>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md max-w-full"
            style={{ background: "#F9FAFB", border: `1px solid ${N.border}` }}
          >
            <span className="text-[12px] font-mono flex-shrink-0" style={{ color: N.neutral400 }}>trace_id:</span>
            <span className="text-[12px] font-mono truncate" style={{ color: N.neutral900 }}>{success.trace_id}</span>
            <button type="button" onClick={copyTrace} className="flex items-center gap-1 text-[12px] flex-shrink-0" style={{ color: N.primary }}>
              {traceCopied ? <Check size={13} /> : <Copy size={13} />}
              {traceCopied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium text-white" style={{ background: N.primary }} onClick={resetAll}>
              <ArrowRight size={14} />
              继续注入
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium bg-white" style={{ color: N.neutral600, border: `1px solid ${N.border}` }} onClick={goReview}>
              前往数据复核
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-8 py-6 space-y-5">
            {parsedJobs.length === 0 && (
              <div
                className="rounded-xl p-5"
                style={{ background: N.surface, border: `1px solid ${N.border}` }}
              >
                <div className="text-[14px] font-semibold mb-3" style={{ color: N.neutral900 }}>CSV 字段要求</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                  {INGEST_CSV_COLUMNS.map((column) => (
                    <div
                      key={column.header}
                      className="flex items-center gap-2 py-2 text-[12px]"
                      style={{ borderBottom: `1px solid ${N.border}` }}
                    >
                      <span className="flex-shrink-0 whitespace-nowrap font-medium" style={{ color: N.neutral900 }}>
                        {column.header}
                      </span>
                      <span
                        className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-4"
                        style={{
                          color: column.nullable ? N.neutral400 : N.error,
                          background: column.nullable ? "#F3F4F6" : "#FEF2F2",
                        }}
                      >
                        {column.nullable ? "可空" : "必填"}
                      </span>
                      <span className="min-w-0 flex-1 truncate" style={{ color: N.neutral400 }} title={column.rule}>
                        {column.rule}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{ border: `1px solid ${N.border}`, background: N.surface, boxShadow: CARD_SHADOW }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: N.primarySoft }}>
                  <FileText size={20} style={{ color: N.primary }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate" style={{ color: N.neutral900 }}>{fileName}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: N.neutral400 }}>
                    {formatFileSize(fileSize)}{parsedJobs.length > 0 ? ` · ${parsedJobs.length} 条有效数据` : ""}
                  </div>
                </div>
                <button type="button" className="flex items-center gap-1 text-[13px]" style={{ color: N.error }} onClick={clearFile}>
                  <Trash2 size={13} />移除
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium bg-white" style={{ color: N.neutral600, border: `1px solid ${N.border}` }} onClick={() => fileInputRef.current?.click()}>
                  重新选择
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full rounded-xl p-10 text-center transition-colors hover:bg-blue-50"
                style={{ border: `1px dashed ${N.primary}55`, background: N.primarySoft }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: N.surface }}>
                  <Upload size={24} style={{ color: N.primary }} />
                </div>
                <div className="text-[15px] font-medium" style={{ color: N.neutral900 }}>点击选择 CSV 文件</div>
                <div className="text-[12px] mt-1" style={{ color: N.neutral400 }}>文件不会直接上传，浏览器解析成功后才会提交结构化数据</div>
              </button>
            )}

            {parseError && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                style={{ background: "#FEF2F2", color: N.error, border: `1px solid #FECACA` }}
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {ignoredHeaders.length > 0 && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                style={{ background: "#FFFBEB", color: N.warning, border: `1px solid #FDE68A` }}
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>以下额外列不会提交：{ignoredHeaders.join("、")}</span>
              </div>
            )}

            {parsedJobs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-medium" style={{ color: N.neutral900 }}>数据预览</span>
                  <span className="text-[12px]" style={{ color: N.neutral400 }}>已通过前端校验</span>
                </div>
                <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${N.border}` }}>
                  <table className="w-full min-w-[700px] text-[14px]">
                    <thead>
                      <tr style={{ background: "#F9FAFB" }}>
                        {["职位", "公司", "城市", "薪资", "发布日期"].map((header) => (
                          <th key={header} className="px-3 py-2 text-left font-medium" style={{ color: N.neutral600 }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedJobs.slice(0, 20).map((job, index) => (
                        <tr key={`${job.job_name}-${index}`} style={{ borderTop: `1px solid ${N.border}` }}>
                          <td className="px-3 py-2" style={{ color: N.neutral900 }}>{job.job_name}</td>
                          <td className="px-3 py-2" style={{ color: N.neutral900 }}>{job.company_name || "—"}</td>
                          <td className="px-3 py-2" style={{ color: N.neutral900 }}>{job.city || "—"}</td>
                          <td className="px-3 py-2" style={{ color: N.neutral900 }}>{job.salary || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: N.neutral900 }}>{job.publish_date || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedJobs.length > 20 && (
                    <div className="px-3 py-2 text-[12px]" style={{ color: N.neutral400, borderTop: `1px solid ${N.border}` }}>
                      仅预览前 20 条，共 {parsedJobs.length} 条
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <div className="flex-shrink-0 px-5 py-3" style={{ borderTop: `1px solid ${N.border}` }}>
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                style={{ background: "#FEF2F2", color: N.error, border: `1px solid #FECACA` }}
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
