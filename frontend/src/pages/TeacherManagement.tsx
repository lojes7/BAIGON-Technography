import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Search, ChevronDown, X } from "lucide-react";
import T from "../constants/tokens";
import { importUsers } from "../services/student-affair";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";

const teachers = [
  { id: "T1001", name: "李老师", college: "计算机科学", status: "confirmed" },
  { id: "T1002", name: "张教授", college: "软件工程", status: "confirmed" },
  { id: "T1003", name: "陈老师", college: "人工智能", status: "needs_review" },
  { id: "T1004", name: "刘老师", college: "计算机科学", status: "confirmed" },
];

const importPreview = [
  { id: "T1005", name: "王老师", college: "计算机科学", valid: true },
  { id: "T1006", name: "", college: "软件工程", valid: false, reason: "姓名为空" },
  { id: "T1007", name: "周老师", college: "无效学院", valid: false, reason: "学院不存在" },
];

export default function TeacherManagement() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importUsers(file);
      const d = res.data;
      const errMsg = d.errors.slice(0, 5).map(e => `行${e.row}: ${e.reason}`).join('; ');
      toast(d.success > 0 ? `导入完成：${d.success} 成功 / ${d.failed} 失败` : `${d.total} 条全部失败`, { description: errMsg || undefined });
    } catch (err) { toast.error((err as Error).message); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const [dropped, setDropped] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personnel"), t("nav.teacherManagement")]}
        title={t("page.teacherManagement.title")}
        description={t("page.teacherManagement.desc")}
        actions={<>
          <span className="text-[11px] mr-2" style={{ color: T.info }}>格式：uid, name, department, role（teacher）</span>
          <input type="file" accept=".xlsx,.csv" ref={fileRef} onChange={handleImport} style={{ display: "none" }} />
          <Btn icon={Upload} onClick={() => fileRef.current?.click()}>{t("page.teacherManagement.importTeachers")}</Btn>
        </>}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white flex-1 max-w-64"
          style={{ border: `1px solid ${T.border}` }}>
          <Search size={14} style={{ color: T.info }} />
          <input className="bg-transparent text-[13px] flex-1 outline-none" placeholder="搜索姓名/工号…" style={{ color: T.ink }} />
        </div>
        {[
          { label: t("page.teacherManagement.college"), value: "全部" },
          { label: t("common.status"), value: "全部" },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[13px] cursor-pointer"
            style={{ border: `1px solid ${T.border}`, color: T.ink }}>
            <span style={{ color: T.info }}>{f.label}：</span>{f.value}
            <ChevronDown size={12} style={{ color: T.info }} />
          </div>
        ))}
      </div>

      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {[t("page.teacherManagement.colId2"), t("page.teacherManagement.colName2"), t("page.teacherManagement.college"), t("common.status"), t("common.operate")].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{t.id}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{t.name}</td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{t.college}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3">
                  <button className="text-[12px] font-medium" style={{ color: T.teal }}>详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between text-[12px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
          <span>共 12 条，第 1/2 页</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded hover:bg-gray-100">上一页</button>
            <button className="px-2 py-1 rounded hover:bg-gray-100">下一页</button>
          </div>
        </div>
      </Card>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-lg w-[560px] max-h-[80vh] overflow-y-auto"
            style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>导入教师</h3>
              <button onClick={() => setImportOpen(false)} style={{ color: T.info }}><X size={18} /></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer"
                style={{ borderColor: dropped ? T.teal : T.border, background: dropped ? `${T.teal}05` : T.cloud }}
                onClick={() => setDropped(true)}>
                <Upload size={28} style={{ color: T.info, marginBottom: 8 }} />
                <div className="text-[14px] font-medium" style={{ color: T.ink }}>上传 Excel 文件</div>
                <div className="text-[12px] mt-1" style={{ color: T.info }}>拖拽或点击选择 · 支持 .xlsx / .xls</div>
              </div>
              <button className="text-[12px]" style={{ color: T.teal }}>下载导入模板</button>

              {dropped && (
                <div>
                  <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>导入预览</div>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: T.cloud }}>
                        {[t("page.teacherManagement.colId2"), t("page.teacherManagement.colName2"), t("page.teacherManagement.college"), "验证结果"].map(h => (
                          <th key={h} className="px-3 py-1.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${T.cloud}` }}>
                          <td className="px-3 py-2 font-mono text-[12px]" style={{ color: T.info }}>{r.id}</td>
                          <td className="px-3 py-2" style={{ color: r.valid ? T.ink : T.risk }}>{r.name || "—"}</td>
                          <td className="px-3 py-2 text-[12px]" style={{ color: T.info }}>{r.college}</td>
                          <td className="px-3 py-2">
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
                  <div className="text-[12px] mt-2" style={{ color: T.info }}>
                    {importPreview.filter(r => r.valid).length} 条通过，{importPreview.filter(r => !r.valid).length} 条失败
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" onClick={() => setImportOpen(false)}>取消</Btn>
              <Btn disabled={!dropped} onClick={() => { setImportOpen(false); toast.success("导入完成"); }}>
                确认导入通过项
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
