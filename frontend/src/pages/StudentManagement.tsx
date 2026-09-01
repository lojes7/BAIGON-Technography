import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Search, ChevronDown, X } from "lucide-react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { importUsers } from "../services/student-affair";
import { PageHeader, Btn, Card } from "../components/ui";

const students = [
  { id: "S1001", name: "张三", major: "计算机科学", grade: "2023", class: "计科1", advisor: "李老师", matchScore: "72%", lastDiagnosis: "2026-07-12", hasResume: true },
  { id: "S1002", name: "李四", major: "软件工程", grade: "2023", class: "软工2", advisor: "张教授", matchScore: "65%", lastDiagnosis: "2026-06-20", hasResume: true },
  { id: "S1003", name: "王五", major: "人工智能", grade: "2024", class: "智能1", advisor: "陈老师", matchScore: "-", lastDiagnosis: "-", hasResume: false },
  { id: "S1004", name: "赵六", major: "计算机科学", grade: "2023", class: "计科1", advisor: "李老师", matchScore: "58%", lastDiagnosis: "2026-05-15", hasResume: true },
];

const sampleGrades = ["数据库原理 · 85 分", "Java 程序设计 · 78 分", "操作系统 · 82 分"];

export default function StudentManagement() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [detailOpen, setDetailOpen] = useState<typeof students[0] | null>(null);

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personnel"), t("nav.studentManagement")]}
        title={t("page.studentManagement.title")}
        description={t("page.studentManagement.desc")}
        actions={<>
          <span className="text-[11px] mr-2" style={{ color: T.info }}>格式：uid, name, department, role（student）</span>
          <input type="file" accept=".xlsx,.csv" ref={fileRef} onChange={handleImport} style={{ display: "none" }} />
          <Btn icon={Upload} onClick={() => fileRef.current?.click()}>{t("page.studentManagement.importStudents")}</Btn>
        </>}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white flex-1 max-w-64"
          style={{ border: `1px solid ${T.border}` }}>
          <Search size={14} style={{ color: T.info }} />
          <input className="bg-transparent text-[13px] flex-1 outline-none" placeholder="搜索姓名/学号…" style={{ color: T.ink }} />
        </div>
        {[t("page.studentManagement.major"), t("page.studentManagement.grade"), t("page.studentManagement.className")].map((label, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[13px] cursor-pointer"
            style={{ border: `1px solid ${T.border}`, color: T.ink }}>
            <span style={{ color: T.info }}>{label}：</span>全部
            <ChevronDown size={12} style={{ color: T.info }} />
          </div>
        ))}
      </div>

      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: P.sky }}>
              {[t("page.studentManagement.colId3"), t("page.studentManagement.colName2"), t("page.studentManagement.major"), t("page.studentManagement.grade"), t("page.studentManagement.className"), t("common.operate")].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.id}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{s.name}</td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{s.major}</td>
                <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.grade}</td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{s.class}</td>
                <td className="px-4 py-3">
                  <button className="text-[12px] font-medium" style={{ color: T.teal }}
                    onClick={() => setDetailOpen(s)}>详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between text-[12px]" style={{ borderTop: `1px solid ${T.cloud}`, color: T.info }}>
          <span>共 320 条，第 1/16 页</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded hover:bg-gray-100">上一页</button>
            <button className="px-2 py-1 rounded hover:bg-gray-100">下一页</button>
          </div>
        </div>
      </Card>

      {detailOpen && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setDetailOpen(null)}>
          <div className="flex-1" />
          <div className="w-96 h-full bg-white shadow-xl overflow-y-auto flex flex-col"
            style={{ borderLeft: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <div className="text-[15px] font-medium" style={{ color: T.ink }}>
                  {detailOpen.name} · {detailOpen.major}{detailOpen.grade}级{detailOpen.class}班
                </div>
              </div>
              <button onClick={() => setDetailOpen(null)} style={{ color: T.info }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#E4EAF2]" >
              <div className="px-5 py-4 space-y-2 text-[13px]">
                {[
                  [t("page.studentManagement.colId3"), detailOpen.id],
                  [t("page.studentManagement.major"), detailOpen.major],
                  ["指导教师", detailOpen.advisor],
                  ["账号状态", "正常"],
                ].map(([k, v], i) => (
                  <div key={i} className="flex justify-between">
                    <span style={{ color: T.info }}>{k}</span>
                    <span className="font-medium" style={{ color: T.ink }}>
                      {k === "账号状态" ? <span style={{ color: T.emerging }}>✅ {v}</span> : v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                  成绩记录
                </div>
                <div className="space-y-1">
                  {sampleGrades.map((g, i) => (
                    <div key={i} className="text-[13px]" style={{ color: T.ink }}>{g}</div>
                  ))}
                </div>
                <div className="text-[12px] mt-2" style={{ color: T.info }}>共 14 门课程</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                  能力诊断概要
                </div>
                <div className="space-y-1 text-[13px]">
                  <div><span style={{ color: T.info }}>已上传简历：</span>
                    <span style={{ color: detailOpen.hasResume ? T.emerging : T.info }}>
                      {detailOpen.hasResume ? "是" : "否"}
                    </span>
                  </div>
                  {detailOpen.lastDiagnosis !== "-" && (
                    <div><span style={{ color: T.info }}>最近诊断：</span>
                      <span style={{ color: T.ink }}>{detailOpen.lastDiagnosis} · 匹配度 {detailOpen.matchScore}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" size="sm" onClick={() => { setDetailOpen(null); toast("编辑信息：可修改基础信息"); }}>
                编辑信息
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
