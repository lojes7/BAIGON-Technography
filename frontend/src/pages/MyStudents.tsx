import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import T from "../constants/tokens";
import P from "../constants/palette";
import { getTeacherStudents } from "../services/teacher";
import { getDepartmentList } from "../services/admin";
import type { TeacherStudentItem, DepartmentItem } from "../types/api";
import { PageHeader, Card, Pagination } from "../components/ui";

export default function MyStudentsPage() {
  const { t } = useTranslation();
  const [students, setStudents] = useState<TeacherStudentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const deptName = (id: string) => depts.find(d => String(d.id) === id)?.name ?? id;

  const fetchStudents = () => {
    setLoading(true);
    getTeacherStudents(page, 20)
      .then((res) => { setStudents(res.data.items); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { getDepartmentList().then(res => { console.log("系部列表:", res.data); setDepts(res.data.length ? res.data : []); }).catch(e => console.error("系部列表获取失败:", e)); }, []);
  useEffect(() => { fetchStudents(); }, [page]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("page.myStudentsPage.insight"), t("page.myStudentsPage.title")]}
        title={t("page.myStudentsPage.title")}
        description={t("page.myStudentsPage.desc")}
      />

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : students.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["colUid","colName","colDept","colStatus","colCreated"].map(k => (
                  <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: P.primaryDeep }}>{t(`page.myStudentsPage.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.student_id} className="hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.uid}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{s.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{deptName(s.department_id)}</td>
                  <td className="px-4 py-3"><span style={{ color: s.status === "NORMAL" ? T.emerging : T.risk }}>{s.status}</span></td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > 0 && (
        <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} total={total} />
      )}
    </div>
  );
}
