import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, CheckCircle, AlertTriangle, Info } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";

const previewData = [
  { id: "S1001", name: "张三", course: "数据库原理", score: 85, valid: true },
  { id: "S1001", name: "张三", course: "Java程序设计", score: 78, valid: true },
  { id: "S1002", name: "李四", course: "数据库原理", score: 92, valid: true },
  { id: "S1003", name: "王五", course: "操作系统", score: 105, valid: false, reason: "超出范围" },
  { id: "S1099", name: "—", course: "数据库原理", score: 88, valid: false, reason: "学号不存在" },
];

const importHistory = [
  { time: "07-13 14:30", file: "计科21级2026春成绩", records: 87, status: "succeeded" },
  { time: "07-10 09:00", file: "软工22级2026春成绩", records: 65, status: "succeeded" },
  { time: "07-03 16:20", file: "智能23级2026春成绩", records: 42, status: "partially_succeeded" },
];

export default function GradeImport() {
  const { t } = useTranslation();
  const [uploaded, setUploaded] = useState(false);
  const [dupStrategy, setDupStrategy] = useState("overwrite");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.grades"), t("nav.gradeImport")]}
        title={t("page.gradeImport.title")}
        description={t("page.gradeImport.desc")}
      />

      <Card title={t("page.gradeImport.uploadFile3")}>
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-12 w-full cursor-pointer transition-colors"
            style={{ borderColor: T.border, background: T.cloud }}
            onClick={() => setUploaded(true)}>
            <Upload size={32} style={{ color: T.info, marginBottom: 12 }} />
            <div className="text-[14px] font-medium" style={{ color: T.ink }}>上传成绩单 Excel 文件</div>
            <div className="text-[12px] mt-1" style={{ color: T.info }}>拖拽文件到此处或点击上传 · 支持 .xlsx / .xls / .csv</div>
          </div>
          <div className="flex gap-3">
            <Btn variant="ghost" size="sm" icon={Download}>下载导入模板</Btn>
            <Btn variant="ghost" size="sm" icon={Info}>查看模板说明</Btn>
          </div>
        </div>
      </Card>

      {uploaded && (
        <>
          <Card title={t("page.gradeImport.dataPreview")}>
            <div className="px-5 py-3 text-[13px]" style={{ color: T.info, borderBottom: `1px solid ${T.cloud}` }}>
              文件：计科21级2026春成绩单.xlsx · 87 条记录
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["学号", "姓名", "课程名", "成绩", "验证"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-2 font-mono text-[12px]" style={{ color: T.info }}>{r.id}</td>
                    <td className="px-4 py-2" style={{ color: r.valid ? T.ink : T.risk }}>{r.name}</td>
                    <td className="px-4 py-2 text-[12px]" style={{ color: T.info }}>{r.course}</td>
                    <td className="px-4 py-2 font-mono" style={{ color: r.valid ? T.ink : T.risk }}>{r.score}</td>
                    <td className="px-4 py-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ color: r.valid ? T.emerging : T.risk,
                          background: r.valid ? `${T.emerging}18` : `${T.risk}18` }}>
                        {r.valid ? "✅ 通过" : `❌ ${r.reason}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-[12px]" style={{ color: T.info, borderTop: `1px solid ${T.cloud}` }}>
              通过 {previewData.filter(r => r.valid).length} 条，失败 {previewData.filter(r => !r.valid).length} 条
            </div>
          </Card>

          <Card title={t("page.gradeImport.duplicateHandling")}>
            <div className="px-5 py-4 space-y-2 text-[13px]">
              <div className="text-[12px] mb-2" style={{ color: T.info }}>发现 3 条已有成绩：</div>
              {[
                { value: "keep", label: "保留已有成绩（不覆盖）" },
                { value: "overwrite", label: "用新成绩覆盖（推荐）" },
                { value: "merge", label: "合并（保留最高分）" },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <button className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: dupStrategy === opt.value ? T.teal : T.border }}
                    onClick={() => setDupStrategy(opt.value)}>
                    {dupStrategy === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: T.teal }} />}
                  </button>
                  <span style={{ color: T.ink }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Btn variant="secondary" onClick={() => setUploaded(false)}>取消</Btn>
            <Btn onClick={() => { setUploaded(false); toast.success(`导入完成，${previewData.filter(r => r.valid).length} 条已处理`); }}>
              确认导入 {previewData.filter(r => r.valid).length} 条通过项
            </Btn>
          </div>
        </>
      )}

      <Card title={t("page.gradeImport.importHistory2")}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["时间", "文件名", "记录数", "状态"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {importHistory.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{r.time}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.file}</td>
                <td className="px-4 py-3 font-mono">{r.records}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
