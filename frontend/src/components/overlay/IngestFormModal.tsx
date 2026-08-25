// 百工谱 — CSV 注入数据
// 浏览器只负责校验和解析 CSV，提交给后端的是结构化岗位数组，不上传原始文件。
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  FileText,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import T from "../../constants/tokens";
import {
  MAX_INGEST_ROWS,
  REQUIRED_CSV_HEADERS,
  parseIngestCsv,
  validateCsvFileMetadata,
} from "../../features/ingest/csv";
import { ingestData } from "../../services/engineer";
import type { IngestJob } from "../../types/api";
import { Btn } from "../ui";

interface SubmitOk {
  count: string;
  trace_id: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export default function IngestFormModal({ onClose }: { onClose: () => void }) {
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
      const parsed = parseIngestCsv(await file.text());
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
      const response = await ingestData(parsedJobs);
      setSuccess({ count: response.data.count, trace_id: response.data.trace_id });
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
    onClose();
    navigate("/raw-records");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,50,77,0.3)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-[820px] max-w-[calc(100vw-32px)] max-h-[90vh] flex flex-col shadow-2xl"
        style={{ border: `1px solid ${T.border}` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}
        >
          <div>
            <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>注入数据</h3>
            <p className="text-[12px] mt-0.5" style={{ color: T.info }}>解析 CSV 后提交至完整采集与清洗链路</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ color: T.info }}>
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col items-center justify-center gap-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${T.emerging}12` }}>
              <CheckCircle size={30} style={{ color: T.emerging }} />
            </div>
            <div className="text-center">
              <div className="text-[16px] font-medium mb-1" style={{ color: T.ink }}>
                注入成功，共 {success.count} 条数据
              </div>
              <div className="text-[13px]" style={{ color: T.info }}>
                数据已进入落库、清洗和 Kafka 流程，可前往数据复核查看
              </div>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md max-w-full"
              style={{ background: T.cloud, border: `1px solid ${T.border}` }}
            >
              <span className="text-[12px] font-mono flex-shrink-0" style={{ color: T.info }}>trace_id:</span>
              <span className="text-[12px] font-mono truncate" style={{ color: T.ink }}>{success.trace_id}</span>
              <button type="button" onClick={copyTrace} className="flex items-center gap-1 text-[12px] flex-shrink-0" style={{ color: T.teal }}>
                {traceCopied ? <Check size={13} /> : <Copy size={13} />}
                {traceCopied ? "已复制" : "复制"}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Btn icon={ArrowRight} onClick={resetAll}>继续注入</Btn>
              <Btn variant="secondary" onClick={goReview}>前往数据复核</Btn>
              <Btn variant="ghost" onClick={onClose}>关闭</Btn>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div
                className="rounded-lg p-5"
                style={{ background: T.cloud, border: `1px solid ${T.border}` }}
              >
                <div className="text-[13px] font-medium mb-2" style={{ color: T.ink }}>CSV 文件要求</div>
                <ul className="text-[12px] leading-5 list-disc pl-5" style={{ color: T.info }}>
                  <li>仅支持 UTF-8 编码的 .csv 文件，文件必须小于 10 MiB</li>
                  <li>最多 {MAX_INGEST_ROWS} 行数据；“职位”每行必填</li>
                  <li>job_url 非空时必须是 HTTP(S) 地址</li>
                  <li>crawl_time 可为空，或使用 YYYY-MM-DD / YYYY-MM-DD HH:mm:ss</li>
                </ul>
                <div className="text-[12px] mt-2" style={{ color: T.ink }}>
                  必需列：{REQUIRED_CSV_HEADERS.join("、")}
                </div>
              </div>

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
                <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ border: `1px solid ${T.border}` }}>
                  <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${T.teal}10` }}>
                    <FileText size={19} style={{ color: T.teal }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate" style={{ color: T.ink }}>{fileName}</div>
                    <div className="text-[12px]" style={{ color: T.info }}>
                      {formatFileSize(fileSize)}{parsedJobs.length > 0 ? ` · ${parsedJobs.length} 条有效数据` : ""}
                    </div>
                  </div>
                  <button type="button" className="flex items-center gap-1 text-[12px]" style={{ color: T.risk }} onClick={clearFile}>
                    <Trash2 size={13} />移除
                  </button>
                  <Btn variant="secondary" onClick={() => fileInputRef.current?.click()}>重新选择</Btn>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-lg p-8 text-center transition-colors"
                  style={{ border: `1px dashed ${T.teal}70`, background: `${T.teal}06` }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={28} className="mx-auto mb-2" style={{ color: T.teal }} />
                  <div className="text-[13px] font-medium" style={{ color: T.ink }}>点击选择 CSV 文件</div>
                  <div className="text-[12px] mt-1" style={{ color: T.info }}>文件不会直接上传，浏览器解析成功后才会提交结构化数据</div>
                </button>
              )}

              {parseError && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                  style={{ background: `${T.risk}10`, color: T.risk, border: `1px solid ${T.risk}30` }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {ignoredHeaders.length > 0 && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                  style={{ background: `${T.pending}10`, color: T.pending, border: `1px solid ${T.pending}30` }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>以下额外列不会提交：{ignoredHeaders.join("、")}</span>
                </div>
              )}

              {parsedJobs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium" style={{ color: T.ink }}>数据预览</span>
                    <span className="text-[12px]" style={{ color: T.info }}>已通过前端校验</span>
                  </div>
                  <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${T.border}` }}>
                    <table className="w-full min-w-[700px] text-[12px]">
                      <thead>
                        <tr style={{ background: T.cloud }}>
                          {["职位", "公司", "城市", "薪资", "crawl_time"].map((header) => (
                            <th key={header} className="px-3 py-2 text-left font-medium" style={{ color: T.info }}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedJobs.slice(0, 20).map((job, index) => (
                          <tr key={`${job.job_name}-${index}`} style={{ borderTop: `1px solid ${T.cloud}` }}>
                            <td className="px-3 py-2" style={{ color: T.ink }}>{job.job_name}</td>
                            <td className="px-3 py-2" style={{ color: T.ink }}>{job.company_name || "—"}</td>
                            <td className="px-3 py-2" style={{ color: T.ink }}>{job.city || "—"}</td>
                            <td className="px-3 py-2" style={{ color: T.ink }}>{job.salary || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: T.ink }}>{job.publish_date || "—"}</td>
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

            <div className="flex-shrink-0 px-5 py-4 space-y-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
              {submitError && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-md text-[12px]"
                  style={{ background: `${T.risk}10`, color: T.risk, border: `1px solid ${T.risk}30` }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" onClick={onClose}>取消</Btn>
                <Btn icon={Upload} onClick={submitCsv} disabled={submitting || parsedJobs.length === 0}>
                  {submitting ? "提交中…" : `提交注入${parsedJobs.length > 0 ? `（${parsedJobs.length} 条）` : ""}`}
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
