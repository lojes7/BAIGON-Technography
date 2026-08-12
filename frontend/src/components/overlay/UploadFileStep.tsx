import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import T from "../../constants/tokens";
import { MOCK_FILE, fileChecks } from "../../data";
import Card from "../ui/Card";
import Btn from "../ui/Btn";

function UploadFileStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [hasFile, setHasFile] = useState(true);
  const [dragging, setDragging] = useState(false);

  return (
    <Card title="上传文件">
      <div className="px-6 py-5 space-y-4">
        {hasFile ? (
          <>
            <div className="flex items-start gap-4 p-4 rounded-lg"
              style={{ border: `1px solid ${T.border}`, background: `${T.emerging}04` }}>
              <div className="w-10 h-12 rounded flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: "#217346", color: "white" }}>
                <div className="text-[9px] font-bold tracking-wide">XLS</div>
                <div className="text-[8px] opacity-70">X</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate" style={{ color: T.ink }}>{MOCK_FILE.name}</div>
                <div className="flex items-center gap-3 mt-1 text-[12px] flex-wrap" style={{ color: T.info }}>
                  <span className="font-mono">{MOCK_FILE.size}</span>
                  <span>·</span>
                  <span>{MOCK_FILE.rows} 行数据</span>
                  <span>·</span>
                  <span>{MOCK_FILE.sheets.length} 个工作表</span>
                  <span>·</span>
                  <span>修改于 {MOCK_FILE.modified}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MOCK_FILE.sheets.map((s, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded"
                      style={{ background: T.cloud, color: T.info }}>{s}</span>
                  ))}
                </div>
              </div>
              <button className="text-[12px] flex-shrink-0" style={{ color: T.risk }}
                onClick={() => setHasFile(false)}>移除</button>
            </div>

            <div className="space-y-1.5">
              {fileChecks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  {c.ok && !c.warn
                    ? <CheckCircle size={13} style={{ color: T.emerging, flexShrink: 0 }} />
                    : c.warn
                    ? <AlertTriangle size={13} style={{ color: T.pending, flexShrink: 0 }} />
                    : <AlertCircle size={13} style={{ color: T.risk, flexShrink: 0 }} />}
                  <span style={{ color: c.warn ? T.pending : c.ok ? T.ink : T.risk }}>{c.msg}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>
                数据预览（前 3 行）
              </div>
              <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: T.cloud }}>
                      {["job_name", "description", "publish_date", "company", "city"].map(h => (
                        <th key={h} className="px-3 py-1.5 text-left font-mono font-medium" style={{ color: T.teal }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["大模型应用工程师", "负责基于LangChain…", "2026/06/15", "企业A", "常州"],
                      ["机器视觉工程师", "主导工业视觉检测…", "2026/06/14", "企业B", "常州"],
                      ["AI平台工程师", "负责公司内部AI平台…", "2026/06/12", "企业C", "常州"],
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${T.cloud}` }}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 max-w-[120px] truncate" style={{ color: T.ink }}
                            title={cell}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: T.info }}>
                共 {MOCK_FILE.rows} 行 · 显示前 3 行
              </div>
            </div>
          </>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-14 cursor-pointer transition-all"
            style={{
              borderColor: dragging ? T.teal : T.border,
              background: dragging ? `${T.teal}08` : T.cloud,
            }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setHasFile(true); setDragging(false); }}
            onClick={() => setHasFile(true)}>
            <Upload size={30} style={{ color: dragging ? T.teal : T.info, marginBottom: 10 }} />
            <div className="text-[14px] font-medium mb-1" style={{ color: dragging ? T.teal : T.ink }}>
              {dragging ? "松开以上传文件" : "拖放文件至此，或点击选择"}
            </div>
            <div className="text-[12px]" style={{ color: T.info }}>
              支持 CSV、XLSX、JSON · 单文件最大 50 MB
            </div>
            <div className="mt-4 px-3 py-2 rounded text-[12px]" style={{ background: T.cloud, color: T.info }}>
              演示模式：点击区域将加载示例文件
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex justify-between" style={{ borderTop: `1px solid ${T.cloud}` }}>
        <Btn variant="secondary" onClick={onBack}>上一步</Btn>
        <Btn onClick={onNext} disabled={!hasFile}>保存并下一步</Btn>
      </div>
    </Card>
  );
}

export default UploadFileStep;
